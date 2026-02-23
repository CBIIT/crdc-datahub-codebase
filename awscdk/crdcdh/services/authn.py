from aws_cdk import Duration

from aws_cdk import aws_elasticloadbalancingv2 as elbv2
from aws_cdk import aws_ecs as ecs
from aws_cdk import aws_ecr as ecr
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_secretsmanager as secretsmanager
from datetime import date
from aws_cdk import aws_applicationautoscaling as appscaling
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as cw_actions
from aws_cdk import aws_sqs as sqs
from aws_cdk import aws_iam as iam
from aws_cdk import aws_s3 as s3

class authnService:
  def createService(self, config):

    ### AuthN Service ###############################################################################################################
    service = "authn"

    # Set container configs
    if config.has_option(service, 'entrypoint'):
        entry_point = ["/bin/sh", "-c", config[service]['entrypoint']]
    else:
        entry_point = None

    environment={
            "FARGATE":"true",
            "NRIA_IS_FORWARD_ONLY":"true",
            "NEW_RELIC_DISTRIBUTED_TRACING_ENABLED":"true",
            "NRIA_PASSTHROUGH_ENVIRONMENT":"ECS_CONTAINER_METADATA_URI,ECS_CONTAINER_METADATA_URI_V4,FARGATE",
            "NEW_RELIC_HOST":"gov-collector.newrelic.com",
            "NEW_RELIC_LABELS":"Project:{};Environment:{}".format('crdc-hub', config['main']['tier']),
            "NEW_RELIC_LOG_FILE_NAME":"STDOUT",
            "NRIA_CUSTOM_ATTRIBUTES":"{\"nrDeployMethod\":\"downloadPage\"}",
            "NEW_RELIC_APP_NAME":"{}-{}".format(self.namingPrefix, service),
            "NRIA_OVERRIDE_HOST_ROOT":"",
            "PROJECT":"crdc-hub",
            "DATE":date.today().isoformat(),
            "VERSION":config[service]['image'],
            "SESSION_SECRET":"abcd256asghaaamnkloofghj",
            "NIH_SCOPE":"openid email profile",
            "NIH_PROMPT":"login",
            "JAVA_OPTS": "-javaagent:/usr/local/tomcat/newrelic/newrelic.jar"
            #"NIH_REDIRECT_URL":self.app_url,
            #"SESSION_TIMEOUT":"1800",
        }

    secrets={
            "NEW_RELIC_LICENSE_KEY":ecs.Secret.from_secrets_manager(secretsmanager.Secret.from_secret_name_v2(self, "authn_newrelic", secret_name='monitoring/newrelic'), 'api_key'),
            "DATABASE_NAME":ecs.Secret.from_secrets_manager(self.secret, 'database_name'),
            "MONGO_DB_HOST":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_host'),
            "MONGO_DB_PORT":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_port'),
            "MONGO_DB_PASSWORD":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_password'),
            "MONGO_DB_USER":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_user'),
            "NIH_CLIENT_ID":ecs.Secret.from_secrets_manager(self.secret, 'nih_client_id'),
            "NIH_CLIENT_SECRET":ecs.Secret.from_secrets_manager(self.secret, 'nih_client_secret'),
            "NIH_BASE_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_base_url'),
            "NIH_REDIRECT_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_redirect_url'),
            "NIH_USERINFO_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_userinfo_url'),
            "NIH_AUTHORIZE_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_authorize_url'),
            "NIH_TOKEN_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_token_url'),
            "NIH_LOGOUT_URL":ecs.Secret.from_secrets_manager(self.secret, 'nih_logout_url'),
      
        }
    
    taskDefinition = ecs.FargateTaskDefinition(self,
        "{}-{}-taskDef".format(self.namingPrefix, service),
        family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-authn",
        cpu=config.getint(service, 'cpu'),
        memory_limit_mib=config.getint(service, 'memory')
    )
    
    ecr_repo = ecr.Repository.from_repository_arn(self, "{}_repo".format(service), repository_arn=config[service]['repo'])
    
    taskDefinition.add_container(
        service,
        #image=ecs.ContainerImage.from_registry("{}:{}".format(config[service]['repo'], config[service]['image'])),
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
    bucket = s3.Bucket.from_bucket_name(self, f"{self.namingPrefix}-submission-authn-ref", f"{self.namingPrefix}-submission")
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

    #for stmt in stack.datasync_policy_role.policy.document.statements:
        #taskDefinition.task_role.add_to_policy(stmt)
        #taskDefinition.execution_role.add_to_policy(stmt)

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
    subnet_au1 = config.get(service, 'subnet_au1')
    subnet_au2 = config.get(service, 'subnet_au2')
    subnets_au = ec2.SubnetSelection(
        subnets=[
          ec2.Subnet.from_subnet_id(self, "Subnet_au1", subnet_au1),
          ec2.Subnet.from_subnet_id(self, "Subnet_au2", subnet_au2)
        ]
    )
    ecsService = ecs.FargateService(self,
        "{}-{}-service".format(self.namingPrefix, service),
        service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-authn",
        cluster=self.ECSCluster,
        task_definition=taskDefinition,
        enable_execute_command=True,
        min_healthy_percent=50,
        max_healthy_percent=200,
        circuit_breaker=ecs.DeploymentCircuitBreaker(
            enable=True,
            rollback=True
        ),
        vpc_subnets=subnets_au
    )
    #ecsService.connections.allow_to_default_port(self.auroraCluster)

    scalable_target = ecsService.auto_scale_task_count(
        min_capacity=1,  # adjust as needed
        max_capacity=1  # adjust as needed
    )

    # scale on schedule
    tier = config['main']['tier']
    if tier.lower() != 'prod':
        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-backend-start",
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
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-backend-stop",
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
        protocol=elbv2.ApplicationProtocol.HTTP,
        target_group_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-authn",
        health_check = elbv2.HealthCheck(
            path=config[service]['health_check_path'],
            timeout=Duration.seconds(config.getint(service, 'health_check_timeout')),
            interval=Duration.seconds(config.getint(service, 'health_check_interval')),),
        targets=[ecsService],)

    elbv2.ApplicationListenerRule(self, id="alb-{}-rule".format(service),
        conditions=[
            elbv2.ListenerCondition.host_headers(config[service]['host'].split(',')),
            elbv2.ListenerCondition.path_patterns(config[service]['path'].split(','))
        ],
        priority=int(config[service]['priority_rule_number']),
        listener=self.listener,
        target_groups=[ecsTarget])
