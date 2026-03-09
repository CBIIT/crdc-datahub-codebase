from aws_cdk import Duration
from aws_cdk import aws_elasticloadbalancingv2 as elbv2
from aws_cdk import aws_ecs as ecs
from aws_cdk import aws_ecr as ecr
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_secretsmanager as secretsmanager
from datetime import date
from aws_cdk import Duration
from aws_cdk import aws_applicationautoscaling as appscaling
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as cw_actions
from aws_cdk import aws_sqs as sqs
from aws_cdk import aws_iam as iam
from aws_cdk import aws_s3 as s3

class frontendService:
  def createService(self, config):

    ### Frontend Service ###############################################################################################################
    service = "frontend"

    # Set container configs
    if config.has_option(service, 'entrypoint'):
        entry_point = ["/bin/sh", "-c", config[service]['entrypoint']]
    else:
        entry_point = None

    if config.has_option('main', 'subdomain'):
        self.app_url = "https://{}.{}".format(config['main']['subdomain'], config['main']['domain'])
    else:
        self.app_url = "https://{}".format(config['main']['domain'])
    
    environment={
            "FARGATE":"true",
            "NRIA_IS_FORWARD_ONLY":"true",
            "NEW_RELIC_DISTRIBUTED_TRACING_ENABLED":"true",
            "NRIA_PASSTHROUGH_ENVIRONMENT":"ECS_CONTAINER_METADATA_URI,ECS_CONTAINER_METADATA_URI_V4,FARGATE",
            "NEW_RELIC_HOST":"gov-collector.newrelic.com",
            "NEW_RELIC_LABELS":"Project:{};Environment:{}".format('crdc-hub', config['main']['tier']),
            "NEW_RELIC_LOG_FILE_NAME":"STDOUT",
            "NEW_RELIC_NO_CONFIG_FILE":"true",
            "NRIA_CUSTOM_ATTRIBUTES":"{\"nrDeployMethod\":\"downloadPage\"}",
            "NEW_RELIC_APP_NAME":"{}-{}".format(self.namingPrefix, service),
            "NRIA_OVERRIDE_HOST_ROOT":"",
            "PROJECT":"crdc-hub",
            "DATE":date.today().isoformat(),
            "VERSION":config[service]['image'],
            "SESSION_SECRET":"abcd256asghaaamnkloofghj",
            "TIER":config['main']['tier'],
            "JAVA_OPTS": "-javaagent:/usr/local/tomcat/newrelic/newrelic.jar",
            #"REACT_APP_BACKEND_API":"{}/api/graphql".format(self.app_url),
            "REACT_APP_BACKEND_API":f"{self.app_url}/api/graphql",
            "REACT_APP_BE_VERSION":config['backend']['image'],
            "REACT_APP_FE_VERSION":config[service]['image'],
            "REACT_APP_UPLOADER_CLI":"https://github.com/CBIIT/crdc-datahub-cli-uploader/releases/download/{}/crdc-datahub-cli-uploader-src.zip".format(config['main']['upload_cli_version']),
            "REACT_APP_UPLOADER_CLI_WINDOWS":"https://github.com/CBIIT/crdc-datahub-cli-uploader/releases/download/{}/crdc-datahub-cli-uploader-windows.zip".format(config['main']['upload_cli_version']),
            "REACT_APP_UPLOADER_CLI_MAC_X64":"https://github.com/CBIIT/crdc-datahub-cli-uploader/releases/download/{}/crdc-datahub-cli-uploader-mac-x64.zip".format(config['main']['upload_cli_version']),
            "REACT_APP_UPLOADER_CLI_MAC_ARM":"https://github.com/CBIIT/crdc-datahub-cli-uploader/releases/download/{}/crdc-datahub-cli-uploader-mac-arm.zip".format(config['main']['upload_cli_version']),
            "REACT_APP_UPLOADER_CLI_VERSION":config['main']['upload_cli_version'],
            "HIDDEN_MODELS":config['main']['hidden_models'],
            "DEV_TIER":config['main']['tier'],
            "REACT_APP_GA_TRACKING_ID":config['main']['react_app_ga_tracking_id']

#            "REACT_APP_ABOUT_CONTENT_URL":config[service]['about_content_url'],
#            "REACT_APP_AUTH_API":self.app_url,
#            "REACT_APP_AUTH_SERVICE_API":"/api/auth/",
#            "REACT_APP_BACKEND_API":"/v1/graphql/",
#            "REACT_APP_BACKEND_PUBLIC_API":"/v1/public-graphql/",
#            "REACT_APP_BE_VERSION":config['backend']['image'],
#            "REACT_APP_FE_VERSION":config[service]['image'],
#            "REACT_APP_FILE_SERVICE_API":"/api/files/",
#            "REACT_APP_GA_TRACKING_ID":"",
#            "REACT_APP_USER_SERVICE_API":"/api/users/",
        }

    secrets={
            "NEW_RELIC_LICENSE_KEY":ecs.Secret.from_secrets_manager(secretsmanager.Secret.from_secret_name_v2(self, "fe_newrelic", secret_name='monitoring/newrelic'), 'api_key'),
            "NIH_CLIENT_ID":ecs.Secret.from_secrets_manager(self.secret, 'nih_client_id'),
            "NIH_REDIRECT_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_redirect_url'),
            "NIH_AUTHORIZE_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_authorize_url'),
            "REACT_APP_NIH_CLIENT_ID":ecs.Secret.from_secrets_manager(self.secret, 'nih_client_id'),
            "REACT_APP_NIH_AUTHENTICATION_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_authorize_url'),
            "REACT_APP_NIH_REDIRECT_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_redirect_url')
        }

    
    taskDefinition = ecs.FargateTaskDefinition(self,
        "{}-{}-taskDef".format(self.namingPrefix, service),
        family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-frontend",
        cpu=config.getint(service, 'cpu'),
        memory_limit_mib=config.getint(service, 'memory')
    )
    
    ecr_repo = ecr.Repository.from_repository_arn(self, "{}_repo".format(service), repository_arn=config[service]['repo'])
    
    taskDefinition.add_container(
        service,
        #image=ecs.ContainerImage.from_registry("{}:{}".format(fe_repo.repository_uri, config[service]['image'])),
        image=ecs.ContainerImage.from_ecr_repository(repository=ecr_repo, tag=config[service]['image']),
        cpu=config.getint(service, 'cpu'),
        memory_limit_mib=config.getint(service, 'memory'),
        port_mappings=[ecs.PortMapping(container_port=config.getint(service, 'port'), name=service)],
        entry_point=entry_point,
        environment=environment,
        secrets=secrets,
        logging=ecs.LogDrivers.aws_logs(
            stream_prefix="{}-{}".format(self.namingPrefix, service)
        )
    )

    #roles attached to ecs
    bucket = s3.Bucket.from_bucket_name(self, f"{self.namingPrefix}-submission-fe-ref", f"{self.namingPrefix}-submission")
    # add s3 bucket policy to allow task def role to access submission bucket
    bucket_submission_policy = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=[
            "s3:GetObject",
            "s3:PutObject",
            "s3:ListBucket",
            "s3:DeleteObject"
        ],
        resources=[
            bucket.bucket_arn,
            f"{bucket.bucket_arn}/*"
        ]
    )

    data_sync_policy = iam.PolicyStatement(
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
    )

    # pass role in datasync
    data_sync_pass_role = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=["iam:PassRole"],
        resources=["*"],
        conditions={
            "StringEquals": {
                "iam:PassedToService": "datasync.amazonaws.com"
            }
        }
    )

    # allowed access the other buckets
    data_sync_other_buckets = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=[
            "s3:ListObjectsV2",
            "s3:ListBucketMultipartUploads",
            "s3:ListBucket",
            "s3:GetBucketLocation",
            "s3:PutObjectTagging",
            "s3:PutObject",
            "s3:GetObjectTagging",
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:AbortMultipartUpload"
        ],
        resources=[
            "arn:aws:s3:::nci-crdc-data-bucket-dev",
            "arn:aws:s3:::icdc-cbiit-test-metadata",
            "arn:aws:s3:::ctdc-cbiit-test-metadata",
            "arn:aws:s3:::cds-cbiit-test-metadata",
            "arn:aws:s3:::nci-crdc-data-bucket-dev/*",
            "arn:aws:s3:::icdc-cbiit-test-metadata/*",
            "arn:aws:s3:::ctdc-cbiit-test-metadata/*",
            "arn:aws:s3:::cds-cbiit-test-metadata/*"
        ]
    )

    # attach sqs iam access
    sqs_iam_access = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=["sqs:*"],
        resources=[
            f"arn:aws:sqs:{config['main']['region']}:{config['main']['account_id']}:*"
        ]
    )

    # attach quicksight embedded policy
    quicksight_embed_policy = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=[
            "quicksight:GetDashboardEmbedUrl",
            "quicksight:GetAnonymousUserEmbedUrl",
            "quicksight:GenerateEmbedUrlForRegisteredUser",
            "quicksight:GenerateEmbedUrlForAnonymousUser"
        ],
        resources=[
            f"arn:aws:quicksight:{config['main']['region']}:{config['main']['account_id']}:dashboard/*"
        ]
    )

    # attach policy to the task role
    taskDefinition.task_role.add_to_policy(bucket_submission_policy)
    taskDefinition.task_role.add_to_policy(data_sync_policy)
    taskDefinition.task_role.add_to_policy(data_sync_pass_role)
    taskDefinition.task_role.add_to_policy(data_sync_other_buckets)
    taskDefinition.task_role.add_to_policy(sqs_iam_access)
    taskDefinition.task_role.add_to_policy(quicksight_embed_policy)

    taskDefinition.execution_role.add_to_policy(bucket_submission_policy)
    taskDefinition.execution_role.add_to_policy(data_sync_policy)
    taskDefinition.execution_role.add_to_policy(data_sync_pass_role)
    taskDefinition.execution_role.add_to_policy(data_sync_other_buckets)
    taskDefinition.execution_role.add_to_policy(sqs_iam_access)
    taskDefinition.execution_role.add_to_policy(quicksight_embed_policy)

    # attach amazon managed policy to the task role
    taskDefinition.task_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSQSFullAccess")
    )

    taskDefinition.task_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonEC2ContainerServiceEventsRole")
    )

    taskDefinition.task_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("CloudWatchLogsFullAccess")
    )

    taskDefinition.execution_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSQSFullAccess")
    )
    taskDefinition.execution_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonEC2ContainerServiceEventsRole")
    )
    taskDefinition.execution_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("CloudWatchLogsFullAccess")
    )

    # get subnet for the ecs service
    subnet_fe1 = config.get(service, 'subnet_fe1')
    subnet_fe2 = config.get(service, 'subnet_fe2')
    subnets_fe = ec2.SubnetSelection(
        subnets=[
          ec2.Subnet.from_subnet_id(self, "Subnet_fe1", subnet_fe1),
          ec2.Subnet.from_subnet_id(self, "Subnet_fe2", subnet_fe2)
        ]
    )
    ecsService = ecs.FargateService(self,
        "{}-{}-service".format(self.namingPrefix, service),
        service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-frontend",
        cluster=self.ECSCluster,
        task_definition=taskDefinition,
        enable_execute_command=True,
        min_healthy_percent=50,
        max_healthy_percent=200,
        circuit_breaker=ecs.DeploymentCircuitBreaker(
            enable=True,
            rollback=True
        ),
        vpc_subnets=subnets_fe
    )

    # added ecs run by schedule
    scalable_target = ecsService.auto_scale_task_count(
        min_capacity=1,  # adjust as needed
        max_capacity=1  # adjust as needed
    )

    # scale on schedule
    tier = config['main']['tier']
    if tier.lower() != 'prod':
        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-frontend-start",
            schedule=appscaling.Schedule.cron(
                minute="7",
                hour="11",
                week_day="MON-FRI"
            ),
            min_capacity=1,
            max_capacity=1,
            #schedule_time_zone="America/New_York"
        )

        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-frontend-stop",
            schedule=appscaling.Schedule.cron(
                minute="0",
                hour="23",
                week_day="MON-FRI"
            ),
            min_capacity=0,
            max_capacity=0
        #    schedule_time_zone="America/New_York"
        )

    ecsTarget = self.listener.add_targets("ECS-{}-Target".format(service),
        port=int(config[service]['port']),
        target_group_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-frontend",
        protocol=elbv2.ApplicationProtocol.HTTP,
        health_check = elbv2.HealthCheck(
            path=config[service]['health_check_path']),
        targets=[ecsService],)

    elbv2.ApplicationListenerRule(self, id="alb-{}-rule".format(service),
        conditions=[
            elbv2.ListenerCondition.host_headers(config[service]['host'].split(',')),
            elbv2.ListenerCondition.path_patterns(config[service]['path'].split(','))
        ],
        priority=int(config[service]['priority_rule_number']),
        listener=self.listener,
        target_groups=[ecsTarget])
