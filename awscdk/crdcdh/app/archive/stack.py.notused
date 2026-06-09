import boto3
from configparser import ConfigParser
from constructs import Construct
from cdk_ec2_key_pair import KeyPair, PublicKeyFormat
from aws_cdk import Stack
from aws_cdk import RemovalPolicy
from aws_cdk import SecretValue
from aws_cdk import aws_elasticloadbalancingv2 as elbv2
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_ecs as ecs
from aws_cdk import aws_opensearchservice as opensearch
from aws_cdk import aws_kms as kms
from aws_cdk import aws_secretsmanager as secretsmanager
from aws_cdk import aws_certificatemanager as cfm
from aws_cdk import aws_rds as rds
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_ssm as ssm
from aws_cdk import aws_iam as iam
from services import frontend, backend, interoperation

class Stack(Stack):
    def __init__(self, scope: Construct, **kwargs) -> None:
        super().__init__(scope, **kwargs)

        ### Read config
        config = ConfigParser()
        config.read('config.ini')
        
        self.namingPrefix = "{}-{}".format(config['main']['resource_prefix'], config['main']['tier'])

        if config.has_option('main', 'subdomain'):
            self.app_url = "https://{}.{}".format(config['main']['subdomain'], config['main']['domain'])
        else:
            self.app_url = "https://{}".format(config['main']['domain'])
        
        ### Import VPC
        self.VPC = ec2.Vpc.from_lookup(self, "VPC",
            vpc_id = config['main']['vpc_id']
        )

        ### Opensearch Cluster
        if config['os']['endpoint_type'] == 'vpc':
            vpc = self.VPC
            vpc_subnets=[{
                'subnets': [self.VPC.private_subnets[0]],
            }]
        else:
            vpc = None
            vpc_subnets=[{}]

        self.osDomain = opensearch.Domain(self,
            "opensearch",
            version=opensearch.EngineVersion.open_search(config['os']['version']),
            vpc=vpc,
            domain_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-opensearch",
            zone_awareness=opensearch.ZoneAwarenessConfig(
                enabled=False
            ),
            capacity=opensearch.CapacityConfig(
                data_node_instance_type=config['os']['data_node_instance_type'],
                multi_az_with_standby_enabled=False
            ),
            vpc_subnets=vpc_subnets,
            removal_policy=RemovalPolicy.DESTROY,
            #advanced_options={"override_main_response_version" : "true"}
        )

        # Policy to allow access for dataloader instances
        os_policy = iam.PolicyStatement(
            actions=[
                "es:ESHttpGet",
                "es:ESHttpPut",
                "es:ESHttpPost",
                "es:ESHttpPatch",
                "es:ESHttpHead",
                "es:ESHttpGet",
                "es:ESHttpDelete",
            ],
            resources=["{}/*".format(self.osDomain.domain_arn)],
            principals=[iam.AnyPrincipal()],
        )
        self.osDomain.add_access_policies(os_policy)
        self.osDomain.connections.allow_from(ec2.Peer.ipv4("10.208.0.0/21"), ec2.Port.HTTPS)
        #self.osDomain.connections.allow_from(ec2.Peer.ipv4("10.210.0.0/24"), ec2.Port.HTTPS)


        ### Cloudfront
        
            
        if(config['cloudfront']['deploy'] == "true"):
            self.cfOrigin = s3.Bucket.from_bucket_name(
            self, "CFBucket",
            bucket_name="crdc-cds-nonprod-interoperation-files"
            )

            self.cfKeys = KeyPair(self, "CFKeyPair",
                key_pair_name="CF-key-{}-{}".format(config['main']['resource_prefix'], config['main']['tier']),
                expose_public_key=True,
                public_key_format=PublicKeyFormat.PEM
            )

            CFPublicKey = cloudfront.PublicKey(self, "CFPublicKey",
                encoded_key=self.cfKeys.public_key_value
            )
            CFKeyGroup = cloudfront.KeyGroup(self, "CFKeyGroup",
                items=[CFPublicKey]
            )
        
            tier = config['main']['tier']
            self.cfDistribution = cloudfront.Distribution(self, "CFDistro",
                default_behavior=cloudfront.BehaviorOptions(
                    origin=origins.S3Origin(self.cfOrigin),
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    trusted_key_groups=[CFKeyGroup]
                ),
                comment=f"({config['main']['resource_prefix']}-{config['env'][tier]})"
            )
        
        
        ### RDS
        # Create the serverless cluster
        # self.auroraCluster = rds.ServerlessCluster(self, "AuroraCluster",
        #     engine=rds.DatabaseClusterEngine.AURORA_MYSQL,
        #     vpc=vpc,
        #     credentials=rds.Credentials.from_username(config['db']['mysql_user']),
        #     default_database_name=config['db']['mysql_database']
        # )
        
        ### Secrets
        
        
        if(config['cloudfront']['deploy'] == "true"):
            public_key_id = CFPublicKey.public_key_id
            cf_domain = self.cfDistribution.distribution_domain_name
        else:
            public_key_id = "K2JHABMC4EI0Q9"
            cf_domain = "https://d2krihsuecuuhu.cloudfront.net"
            
        self.secret = secretsmanager.Secret(self, "Secret",
            secret_name="{}/{}/{}".format(config['main']['secret_prefix'], config['main']['tier'], "ctdc"),
            secret_object_value={
                "neo4j_user": SecretValue.unsafe_plain_text(config['db']['neo4j_user']),
                "neo4j_password": SecretValue.unsafe_plain_text(config['db']['neo4j_password']),
                # "es_host": SecretValue.unsafe_plain_text(self.osDomain.domain_endpoint),
 
                "cf_key_pair_id": SecretValue.unsafe_plain_text(public_key_id),
                "cf_url": SecretValue.unsafe_plain_text("https://{}".format(cf_domain)),
                
                "cookie_secret": SecretValue.unsafe_plain_text(config['secrets']['cookie_secret']),
                "token_secret": SecretValue.unsafe_plain_text(config['secrets']['token_secret']),
                "email_user": SecretValue.unsafe_plain_text(config['secrets']['email_user']),
                "email_password": SecretValue.unsafe_plain_text(config['secrets']['email_password']),
                "google_client_id": SecretValue.unsafe_plain_text(config['secrets']['google_client_id']),
                "google_client_secret": SecretValue.unsafe_plain_text(config['secrets']['google_client_secret']),
                "nih_client_id": SecretValue.unsafe_plain_text(config['secrets']['nih_client_id']),
                "nih_client_secret": SecretValue.unsafe_plain_text(config['secrets']['nih_client_secret']),

                # MySQL secrets will be taken from the secret entry created by the cluster creation

            }
        )

        ### ALB
        # Extract subnet IDs
        subnet1 = config.get('Subnets', 'subnet1')
        subnet2 = config.get('Subnets', 'subnet2')
        selected_subnets = ec2.SubnetSelection(
            subnets=[
                ec2.Subnet.from_subnet_id(self, "Subnet1", subnet1),
                ec2.Subnet.from_subnet_id(self, "Subnet2", subnet2)
            ]
        )
        self.ALB = elbv2.ApplicationLoadBalancer(self,
            "alb",
            load_balancer_name = f"{config['main']['resource_prefix']}-{config['main']['tier']}-alb",
            vpc=self.VPC,
            internet_facing=config.getboolean('alb', 'internet_facing'),
            vpc_subnets=selected_subnets
        )

        self.ALB.add_redirect(
            source_protocol=elbv2.ApplicationProtocol.HTTP,
            source_port=80,
            target_protocol=elbv2.ApplicationProtocol.HTTPS,
            target_port=443)

        # Get certificate ARN for specified domain name
        client = boto3.client('acm')
        response = client.list_certificates(
            CertificateStatuses=[
                'ISSUED',
            ],
        )

        for cert in response["CertificateSummaryList"]:
            if ('*.{}'.format(config['main']['domain']) in cert.values()):
                certARN = cert['CertificateArn']

        alb_cert = cfm.Certificate.from_certificate_arn(self, "alb-cert",
            certificate_arn=certARN)
        
        self.listener = self.ALB.add_listener("PublicListener",
            certificates=[
                alb_cert
            ],
            port=443)

        # Add a fixed error message when browsing an invalid URL
        self.listener.add_action("ECS-Content-Not-Found",
            action=elbv2.ListenerAction.fixed_response(200,
                message_body="The requested resource is not available"))

        ### ECS Cluster
        self.kmsKey = kms.Key(self, "ECSExecKey")

        self.ECSCluster = ecs.Cluster(self,
            "ecs",
            cluster_name = f"{config['main']['resource_prefix']}-{config['main']['tier']}-ecs",
            vpc=self.VPC,
            execute_command_configuration=ecs.ExecuteCommandConfiguration(
                kms_key=self.kmsKey
            ),
        )

        ### Fargate
        # Frontend Service
        frontend.frontendService.createService(self, config)

        # Backend Service
        backend.backendService.createService(self, config)

        # AuthN Service
        # authn.authnService.createService(self, config)

        # AuthZ Service
        #authz.authzService.createService(self, config)

        # Files Service
        # files.filesService.createService(self, config)

        # Interoperation Service
        interoperation.interoperationService.createService(self, config)