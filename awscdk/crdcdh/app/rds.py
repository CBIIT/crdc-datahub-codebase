import aws_cdk as cdk
from constructs import Construct, IConstruct
from configparser import ConfigParser
from aws_cdk import aws_iam as iam
from aws_cdk import RemovalPolicy, Duration
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_rds as rds
#import random
import string

class RdsInstance(Construct):
    def __init__(self, scope: Construct, id: str, vpc: ec2.Vpc, **kwargs):
        super().__init__(scope, id, **kwargs)

        # Read config file
        config = ConfigParser()
        config.read('config.ini')

        self.namingPrefix = "{}-{}".format(config['main']['resource_prefix'], config['main']['tier'])

        # Security group — allow inbound PostgreSQL from within the VPC only
        self.rds_sg = ec2.SecurityGroup(
            self,
            f"{self.namingPrefix}-rds-sg",
            vpc=vpc,
            security_group_name=f"{self.namingPrefix}-rds-sg",
            description="Security group for RDS PostgreSQL instance",
            allow_all_outbound=True,
        )

        # Define all allowed IP ranges read from config.ini
        allowed_cidrs = [cidr.strip() for cidr in config['db']['allowed_cidrs'].split(',')]

        for cidr in allowed_cidrs:
            self.rds_sg.add_ingress_rule(
                peer=ec2.Peer.ipv4(cidr),
                connection=ec2.Port.tcp(5432),
                description="Allow PostgreSQL access"
            )

        # Subnet group — private subnets
        rds_subnet_group = rds.SubnetGroup(
            self,
            f"{self.namingPrefix}-rds-subnet-group",
            description=f"Subnet group for {self.namingPrefix} RDS instance",
            vpc=vpc,
            subnet_group_name=f"{self.namingPrefix}-rds-subnet-group",
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Engine version
        pg18 = rds.PostgresEngineVersion.of("18.3", "18")

        # Credentials — password auto-generated and stored in Secrets Manager

        rds_credentials = rds.Credentials.from_username(
            config['db']['rds_username'],
            secret_name=f"{self.namingPrefix}-rds-credentials"
        )

        # RDS PostgreSQL instance
        self.rds = rds.DatabaseInstance(
            self,
            f"{self.namingPrefix}-rds-instance",
            instance_identifier=f"{self.namingPrefix}-rds",
            engine=rds.DatabaseInstanceEngine.postgres(version=pg18),
            instance_type=ec2.InstanceType(config['db']['rds_instance_type']),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            subnet_group=rds_subnet_group,
            security_groups=[self.rds_sg],
            credentials=rds_credentials,
            database_name=config['db']['rds_db_name'],
            allocated_storage=int(config['db']['allocated_storage']),
            max_allocated_storage=int(config['db']['max_allocated_storage']),
            storage_type=rds.StorageType.GP3,
            storage_encrypted=True,
            multi_az=config.getboolean('db', 'rds_multi_az'),
            publicly_accessible=False,
            backup_retention=Duration.days(int(config['db']['rds_backup_retention_days'])),
            deletion_protection=config.getboolean('db', 'rds_deletion_protection'),
            removal_policy=RemovalPolicy.DESTROY,
            enable_performance_insights=True,
            monitoring_interval=Duration.seconds(60),

        )
