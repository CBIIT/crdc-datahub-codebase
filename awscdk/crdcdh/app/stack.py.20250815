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
#from aws_cdk import aws_opensearchservice as opensearch
from aws_cdk import aws_kms as kms
from aws_cdk import aws_secretsmanager as secretsmanager
from aws_cdk import aws_certificatemanager as cfm
#from aws_cdk import aws_rds as rds
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_ssm as ssm
from aws_cdk import aws_iam as iam
from aws_cdk import aws_sqs as sqs
from aws_cdk import aws_sns as sns
from aws_cdk import aws_sns_subscriptions as subs
from aws_cdk import Duration
from aws_cdk import RemovalPolicy
from services import frontend, backend, authn, essentialvalidation, metadatavalidation, filevalidation, exportvalidation, pvpuller

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
#        if config['os']['endpoint_type'] == 'vpc':
#            vpc = self.VPC
#            vpc_subnets=[{
#                'subnets': [self.VPC.private_subnets[0]],
#            }]
#        else:
#            vpc = None
#            vpc_subnets=[{}]

#        self.osDomain = opensearch.Domain(self,
#            "opensearch",
#            version=opensearch.EngineVersion.open_search(config['os']['version']),
#            vpc=vpc,
#            domain_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-opensearch",
#            zone_awareness=opensearch.ZoneAwarenessConfig(
#                enabled=False
#            ),
#            capacity=opensearch.CapacityConfig(
#                data_node_instance_type=config['os']['data_node_instance_type'],
#                multi_az_with_standby_enabled=False
#            ),
#            vpc_subnets=vpc_subnets,
#            removal_policy=RemovalPolicy.DESTROY,
            #advanced_options={"override_main_response_version" : "true"}
#        )

        # Policy to allow access for dataloader instances
#        os_policy = iam.PolicyStatement(
#            actions=[
#                "es:ESHttpGet",
#                "es:ESHttpPut",
#                "es:ESHttpPost",
#                "es:ESHttpPatch",
#                "es:ESHttpHead",
#                "es:ESHttpGet",
#                "es:ESHttpDelete",
#            ],
#            resources=["{}/*".format(self.osDomain.domain_arn)],
#            principals=[iam.AnyPrincipal()],
#        )
#        self.osDomain.add_access_policies(os_policy)
#        self.osDomain.connections.allow_from(ec2.Peer.ipv4("10.208.0.0/21"), ec2.Port.HTTPS)
        #self.osDomain.connections.allow_from(ec2.Peer.ipv4("10.210.0.0/24"), ec2.Port.HTTPS)


        ### Cloudfront
        
            
#        if(config['cloudfront']['deploy'] == "true"):
#            self.cfOrigin = s3.Bucket.from_bucket_name(
#            self, "CFBucket",
#            bucket_name="crdc-cds-nonprod-interoperation-files"
#            )

#            self.cfKeys = KeyPair(self, "CFKeyPair",
#                key_pair_name="CF-key-{}-{}".format(config['main']['resource_prefix'], config['main']['tier']),
#                expose_public_key=True,
#                public_key_format=PublicKeyFormat.PEM
#            )

#            CFPublicKey = cloudfront.PublicKey(self, "CFPublicKey",
#                encoded_key=self.cfKeys.public_key_value
#            )
#            CFKeyGroup = cloudfront.KeyGroup(self, "CFKeyGroup",
#                items=[CFPublicKey]
#            )
        
#            tier = config['main']['tier']
#            self.cfDistribution = cloudfront.Distribution(self, "CFDistro",
#                default_behavior=cloudfront.BehaviorOptions(
#                    origin=origins.S3Origin(self.cfOrigin),
#                    allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
#                    trusted_key_groups=[CFKeyGroup]
#                ),
#                comment=f"({config['main']['resource_prefix']}-{config['env'][tier]})"
#            )
        
        
        ### RDS
        # Create the serverless cluster
        # self.auroraCluster = rds.ServerlessCluster(self, "AuroraCluster",
        #     engine=rds.DatabaseClusterEngine.AURORA_MYSQL,
        #     vpc=vpc,
        #     credentials=rds.Credentials.from_username(config['db']['mysql_user']),
        #     default_database_name=config['db']['mysql_database']
        # )
        
        # create s3 bucket
        bucket = s3.Bucket(self, f"{self.namingPrefix}-submission",
            bucket_name=f"{self.namingPrefix}-submission",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            cors=[
                s3.CorsRule(
                    allowed_methods=[
                        s3.HttpMethods.POST,
                        s3.HttpMethods.GET,
                        s3.HttpMethods.HEAD,
                        s3.HttpMethods.PUT,
                    ],
                    allowed_origins=[
                        "*.datacommons.cancer.gov",
                        "*.cancer.gov",
                        "*.cloudfront.net",
                        "http://localhost:4010"
                    ],    
                    allowed_headers=["*"],
                    exposed_headers=["Content-Range", "ETag", "Content-Length"],
                    max_age=3000
                )
            ]
        )

#        secret_value = json.dumps({
#            "submission_bucket": bucket.bucket_name
#        })
        ### Secrets
        
        
#        if(config['cloudfront']['deploy'] == "true"):
#            public_key_id = CFPublicKey.public_key_id
#            cf_domain = self.cfDistribution.distribution_domain_name
#        else:
#            public_key_id = "K2JHABMC4EI0Q9"
#            cf_domain = "https://d2krihsuecuuhu.cloudfront.net"
            
        self.secret = secretsmanager.Secret(self, "Secret",
#            secret_name="{}/{}/{}".format(config['main']['secret_prefix'], config['main']['tier'], "crdc-dh"),
            secret_name="{}/{}".format(config['main']['resource_prefix'], config['main']['tier']),
#            secret_string_value=secretsmanager.SecretValue.unsafe_plain_text(secret_value),
            secret_object_value={
                "mongo_db_user": SecretValue.unsafe_plain_text(config['db']['mongo_db_user']),
                "mongo_db_password": SecretValue.unsafe_plain_text(config['db']['mongo_db_password']),
                "mongo_db_host": SecretValue.unsafe_plain_text(config['db']['mongo_db_host']),
                "mongo_db_port": SecretValue.unsafe_plain_text(config['db']['mongo_db_port']),
                "database_name": SecretValue.unsafe_plain_text(config['db']['database_name']),
                "neo4j_uri": SecretValue.unsafe_plain_text(config['db']['neo4j_uri']),
                "neo4j_password": SecretValue.unsafe_plain_text(config['db']['neo4j_password']),
                # "es_host": SecretValue.unsafe_plain_text(self.osDomain.domain_endpoint),
 
                #"cf_key_pair_id": SecretValue.unsafe_plain_text(public_key_id),
                #"cf_url": SecretValue.unsafe_plain_text("https://{}".format(cf_domain)),
                
                "sumo_collector_endpoint": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_endpoint']),
                "sumo_collector_token_frontend": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_frontend']),
                "sumo_collector_token_backend": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_backend']),
                "sumo_collector_token_authn": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_authn']),
                "sumo_collector_token_file_validator": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_file_validator']),
                "sumo_collector_token_essential_validation": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_essential_validation']),
                "sumo_collector_token_metadata_validation": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_metadata_validation']),
                "sumo_collector_token_export_validation": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_export_validation']),
                "sumo_collector_token_pv_puller": SecretValue.unsafe_plain_text(config['secrets']['sumo_collector_token_pv_puller']),
                #"cookie_secret": SecretValue.unsafe_plain_text(config['secrets']['cookie_secret']),
                #"token_secret": SecretValue.unsafe_plain_text(config['secrets']['token_secret']),
                "email_user": SecretValue.unsafe_plain_text(config['secrets']['email_user']),
                "email_password": SecretValue.unsafe_plain_text(config['secrets']['email_password']),
                "email_url": SecretValue.unsafe_plain_text(config['secrets']['email_url']),
                "submission_bucket": SecretValue.unsafe_plain_text(config['secrets']['submission_bucket']),
#                "google_client_id": SecretValue.unsafe_plain_text(config['secrets']['google_client_id']),
#                "google_client_secret": SecretValue.unsafe_plain_text(config['secrets']['google_client_secret']),
                "nih_client_id": SecretValue.unsafe_plain_text(config['secrets']['nih_client_id']),
                "nih_client_secret": SecretValue.unsafe_plain_text(config['secrets']['nih_client_secret']),
                "nih_base_url": SecretValue.unsafe_plain_text(config['secrets']['nih_base_url']),
                "nih_redirect_url": SecretValue.unsafe_plain_text(config['secrets']['nih_redirect_url']),
                "nih_userinfo_url": SecretValue.unsafe_plain_text(config['secrets']['nih_userinfo_url']),
                "nih_authorize_url": SecretValue.unsafe_plain_text(config['secrets']['nih_authorize_url']),
                "nih_token_url": SecretValue.unsafe_plain_text(config['secrets']['nih_token_url']),
                "nih_logout_url": SecretValue.unsafe_plain_text(config['secrets']['nih_logout_url'])
#                "newrelic_license_key": SecretValue.unsafe_plain_text(config['secrets']['newrelic_license_key'])

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
        # Extract security group ID
        #security_group_id = config.get('SecurityGroup', 'security_group_id')
        #security_group = ec2.SecurityGroup.from_security_group_id(self,
        #    f"{config['main']['resource_prefix']}-{config['main']['tier']}-SG",
        #    security_group_id
        #)

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
        #self.listener.add_action("ECS-Content-Not-Found",
        #    action=elbv2.ListenerAction.fixed_response(200,
        #        message_body="The requested resource is not available"))

        #self.listener.add_action("DefaultFixedResponse",
            #action=elbv2.ListenerAction.fixed_response(
                #status_code=200,  # or 200 if you prefer
                #message_body="The requested resource is not available",
                #content_type="text/plain")
        #)
        ### ALB Access log
        log_bucket = s3.Bucket.from_bucket_name(self, "AlbAccessLogsBucket", config['main']['alb_log_bucket_name'])
        log_prefix = f"{config['main']['program']}/{config['main']['tier']}/{config['main']['resource_prefix']}/alb-access-logs"

        self.ALB.log_access_logs(
            bucket=log_bucket,
            prefix=log_prefix
#            bucket=self.alb_logs_bucket,
#            prefix="alb-logs/"
        )

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


        # create SNS topic
        topic = sns.Topic(self, f"{self.namingPrefix}-sns-topic",
            topic_name=f"datasync-status-topic-{config['main']['tier']}",
            display_name=f"datasync-status-topic-{config['main']['tier']}"
        )

        # add email subscription
        emails = [e.strip() for e in config['main']['sns_topic_emails'].split(',')]

        for email in emails:
            topic.add_subscription(
                subs.EmailSubscription(email)
            )

        # Add policy to allow EventBridge to publish
        topic.add_to_resource_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                principals=[iam.ServicePrincipal("events.amazonaws.com")],
                actions=["sns:Publish"],
                resources=[topic.topic_arn],
            )
        )  
        # create datasync role & policy
        permission_boundary_arn = config.get('iam', 'permission_boundary')
        self.datasync_policy_role = iam.Role(self,
            f"{self.namingPrefix}-datasync-role",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            role_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-datasync-role",
            permissions_boundary=iam.ManagedPolicy.from_managed_policy_arn(self,
                f"{self.namingPrefix}-datasync-boundary",
                permission_boundary_arn
            ),
            inline_policies={
                "DataSyncPolicy": iam.PolicyDocument(statements=[
                    iam.PolicyStatement(
                        effect=iam.Effect.ALLOW,
                        actions=[
                            "s3:PutObjectTagging",
                            "s3:ListObjectsV2",
                            "s3:ListBucket",
                            "s3:ListAllMyBuckets",
                            "s3:GetObjectVersionTagging",
                            "s3:GetObjectVersion",
                            "s3:GetObjectTagging",
                            "s3:GetObject",
                            "s3:GetBucketLocation",
                            "iam:ListRoles",
                            "iam:CreateRole",
                            "iam:CreatePolicy",
                            "iam:AttachRolePolicy",
                            "datasync:TagResource",
                            "datasync:StartTaskExecution",
                            "datasync:ListTasks",
                            "datasync:ListTaskExecutions",
                            "datasync:ListLocations",
                            "datasync:DescribeTaskExecution",
                            "datasync:DescribeTask",
                            "datasync:DescribeLocation*",
                            "datasync:DeleteTask",
                            "datasync:DeleteLocation",
                            "datasync:CreateTask",
                            "datasync:CreateLocationS3",
                            "datasync:CancelTaskExecution"
                        ],
                        resources=["*"]
                    ),
                    iam.PolicyStatement(
                        effect=iam.Effect.ALLOW,
                        actions=["iam:PassRole"],
                        resources=["*"],
                        conditions={
                            "StringEquals": {
                                "iam:PassedToService": "datasync.amazonaws.com"
                            }
                        }
                    ),
                    iam.PolicyStatement(
                        effect=iam.Effect.ALLOW,
                        actions=[
                            "s3:ListObjectsV2",
                            "s3:ListBucketMultipartUploads",
                            "s3:ListBucket",
                            "s3:GetBucketLocation"
                        ],
                        resources=[
                            "arn:aws:s3:::nci-crdc-data-bucket-dev",
                            "arn:aws:s3:::icdc-cbiit-test-metadata",
                            "arn:aws:s3:::ctdc-cbiit-test-metadata",
                            "arn:aws:s3:::cds-cbiit-test-metadata"
                        ]
                    ),
                    iam.PolicyStatement(
                        effect=iam.Effect.ALLOW,
                        actions=[
                            "s3:PutObjectTagging",
                            "s3:PutObject",
                            "s3:ListObjectsV2",
                            "s3:ListMultipartUploadParts",
                            "s3:ListBucket",
                            "s3:GetObjectTagging",
                            "s3:GetObject",
                            "s3:DeleteObject",
                            "s3:AbortMultipartUpload"
                        ],
                        resources=[
                            "arn:aws:s3:::nci-crdc-data-bucket-dev/*",
                            "arn:aws:s3:::icdc-cbiit-test-metadata/*",
                            "arn:aws:s3:::ctdc-cbiit-test-metadata/*",
                            "arn:aws:s3:::cds-cbiit-test-metadata/*"
                        ]
                    )
                ])
            }
        )
        # SQS queue
       # queue = sqs.Queue(self, f"{self.namingPrefix}-{service}-queue",
       #     queue_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-{service}.fifo",
       #     fifo=True
       # )

        ### Fargate
        # Frontend Service
        frontend.frontendService.createService(self, config)

        # Backend Service
        backend.backendService.createService(self, config)

        # AuthN Service
        authn.authnService.createService(self, config)
        
        # Essential service
        essentialvalidation.essentialvalidationService.createService(self, config)

        # Metadata service
        metadatavalidation.metadatavalidationService.createService(self, config)

        # File service
        filevalidation.filevalidationService.createService(self, config)

        # Export service
        exportvalidation.exportvalidationService.createService(self, config)

        # Pvpuller Service
        pvpuller.pvpullerService.createService(self, config)

        # AuthZ Service
        #authz.authzService.createService(self, config)

        # Files Service
        # files.filesService.createService(self, config)


        # Add a fixed error message when browsing an invalid URL
        self.listener.add_action("ECS-Content-Not-Found",
            action=elbv2.ListenerAction.fixed_response(200,
                message_body="The requested resource is not available"))
