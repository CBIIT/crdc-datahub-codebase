import aws_cdk as cdk
from constructs import Construct
from configparser import ConfigParser
from aws_cdk import aws_iam as iam
from aws_cdk import RemovalPolicy, Duration
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_docdb as docdb
from aws_cdk import aws_secretsmanager as secretsmanager
from aws_cdk import SecretValue
import string

class DocumentDbCluster(Construct):
    def __init__(self, scope: Construct, id: str, vpc: ec2.Vpc, **kwargs):
        super().__init__(scope, id, **kwargs)

        # Read config file
        config = ConfigParser()
        config.read('config.ini')

        self.namingPrefix = "{}-{}".format(config['main']['resource_prefix'], config['main']['tier'])

        # Security group — allow inbound PostgreSQL from within the VPC only
        self.docdb_sg = ec2.SecurityGroup(
            self,
            f"{self.namingPrefix}-docdb-sg",
            vpc=vpc,
            security_group_name=f"{self.namingPrefix}-docdb-sg",
            description="Security group for DocDb",
            allow_all_outbound=True,
        )

        # Define all allowed IP ranges read from config.ini
        allowed_cidrs = [cidr.strip() for cidr in config['db']['allowed_cidrs'].split(',')]

        for cidr in allowed_cidrs:
            self.docdb_sg.add_ingress_rule(
                peer=ec2.Peer.ipv4(cidr),
                connection=ec2.Port.tcp(27017),
                description="Allow DocumentDb access"
            )

        # Subnet group — private subnets
        subnet_ids = [
            subnet.subnet_id
            for subnet in vpc.select_subnets(
                subnet_type=ec2.SubnetType.PRIVATE_ISOLATED
            ).subnets
        ]
        self.docdb_subnet_group = docdb.CfnDBSubnetGroup(
            self,
            f"{self.namingPrefix}-docdb-subnet-group",
            db_subnet_group_name=f"{self.namingPrefix}-docdb-subnet-group",
            db_subnet_group_description=f"Subnet group for {self.namingPrefix} DocDB",
            subnet_ids=subnet_ids,
        )


        # Credentials — password auto-generated and stored in Secrets Manager

        self.secret = secretsmanager.Secret(
            self,
            f"{self.namingPrefix}-docdb-credentials",
            secret_name=f"{self.namingPrefix}-docdb-credentials",
            secret_object_value={
                "docdb_user":     SecretValue.unsafe_plain_text(config['db']['docdb_user']),
                "docdb_password": SecretValue.unsafe_plain_text(config['db']['docdb_password']),
            }

        )


        # DocDB 8.0.0 cluster
        self.cluster = docdb.CfnDBCluster(
            self,
            f"{self.namingPrefix}-docdb-cluster",
            db_cluster_identifier=f"{self.namingPrefix}-docdb",
            engine_version="8.0.0",
            master_username=config['db']['docdb_user'],
            master_user_password=config['db']['docdb_password'],
            db_subnet_group_name=self.docdb_subnet_group.db_subnet_group_name,
            vpc_security_group_ids=[self.docdb_sg.security_group_id],
            storage_type="iopt1",
            storage_encrypted=True,
            copy_tags_to_snapshot=True,
            backup_retention_period=int(config['db']['docdb_backup_retention_days']),
            deletion_protection=config.getboolean('db', 'docdb_deletion_protection'),
        )

        self.cluster.add_dependency(self.docdb_subnet_group)
        self.cluster.apply_removal_policy(RemovalPolicy.DESTROY)

        # need to create instance because we have to use L1 for db 8.0.0, L2 only supports db 5
        self.instances = []
        for i in range(int(config['db']['docdb_instances'])):
            instance = docdb.CfnDBInstance(
                self,
                f"{self.namingPrefix}-docdb-instance-{i+1}",
                db_cluster_identifier=self.cluster.ref,
                db_instance_class=config['db']['docdb_instance_type'],
                db_instance_identifier=f"{self.namingPrefix}-docdb-{i+1}",
                enable_performance_insights=config.getboolean('db', 'docdb_performance_insights'),
                auto_minor_version_upgrade=config.getboolean('db', 'docdb_auto_minor_version_upgrade'),
            )
            instance.apply_removal_policy(RemovalPolicy.DESTROY)
            instance.add_dependency(self.cluster)
            self.instances.append(instance)
