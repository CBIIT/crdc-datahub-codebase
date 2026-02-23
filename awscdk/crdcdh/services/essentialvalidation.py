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

class essentialvalidationService:
  def createService(self, config):

    ### EssentialValidation Service ############################################################################################################
    service = "essentialvalidation"

    # Set container configs
    if config.has_option(service, 'entrypoint'):
        entry_point = ["/bin/sh", "-c", config[service]['entrypoint']]
    else:
        entry_point = None

    environment={
            "DATE":date.today().isoformat(),
            "PROJECT":"crdc-hub",
            "VERSION":config[service]['image'],
            "FARGATE":"true",
            "SESSION_SECRET":"abcd256asghaaamnkloofghj",
            "NEW_RELIC_APP_NAME":"{}-{}".format(self.namingPrefix, service),
            "NEW_RELIC_DISTRIBUTED_TRACING_ENABLED":"true",
            "NEW_RELIC_HOST":"gov-collector.newrelic.com",
            "NEW_RELIC_LABELS":"Project:{};Environment:{}".format('crdc-hub', config['main']['tier']),
            "NEW_RELIC_LOG_FILE_NAME":"STDOUT",
            "NRIA_IS_FORWARD_ONLY":"true",
            "NRIA_PASSTHROUGH_ENVIRONMENT":"ECS_CONTAINER_METADATA_URI,ECS_CONTAINER_METADATA_URI_V4,FARGATE",
            "NRIA_CUSTOM_ATTRIBUTES":"{\"nrDeployMethod\":\"downloadPage\"}",
            "NRIA_OVERRIDE_HOST_ROOT":"",
            "JAVA_OPTS": "-javaagent:/usr/local/tomcat/newrelic/newrelic.jar",
        }

    secrets={
            "NEW_RELIC_LICENSE_KEY":ecs.Secret.from_secrets_manager(secretsmanager.Secret.from_secret_name_v2(self, "essential_newrelic", secret_name='monitoring/newrelic'), 'api_key'),
            "MONGO_DB_HOST":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_host'),
            "MONGO_DB_PORT":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_port'),
            "MONGO_DB_PASSWORD":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_password'),
            "MONGO_DB_USER":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_user'),
            "DATABASE_NAME":ecs.Secret.from_secrets_manager(self.secret, 'database_name'),
        }   
    
    # create sqs
    queue = sqs.Queue(self, f"{self.namingPrefix}-{service}-queue",
        queue_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-{config[service]['queue_name']}-queue.fifo",
        fifo=True
    )
 
    taskDefinition = ecs.FargateTaskDefinition(self,
        "{}-{}-taskDef".format(self.namingPrefix, service),
        family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-essentialvalidation",
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
        #port_mappings=[ecs.PortMapping(app_protocol=ecs.AppProtocol.http, container_port=config.getint(service, 'port'), name=service)],
        entry_point=entry_point,
        environment=environment,
        secrets=secrets,
        logging=ecs.LogDrivers.aws_logs(
            stream_prefix="{}-{}".format(self.namingPrefix, service)
        )
    )


    bucket = s3.Bucket.from_bucket_name(self, f"{self.namingPrefix}-submission-essential-ref", f"{self.namingPrefix}-submission")
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

    # Grant SQS permissions to the task role
    queue.grant_send_messages(taskDefinition.task_role)
    queue.grant_consume_messages(taskDefinition.task_role)

    # get subnet for the ecs service
    subnet_es1 = config.get(service, 'subnet_es1')
    subnet_es2 = config.get(service, 'subnet_es2')
    subnets_es = ec2.SubnetSelection(
        subnets=[
          ec2.Subnet.from_subnet_id(self, "Subnet_es1", subnet_es1),
          ec2.Subnet.from_subnet_id(self, "Subnet_es2", subnet_es2)
        ]
    )
    ecsService = ecs.FargateService(self,
        "{}-{}-service".format(self.namingPrefix, service),
        service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-essentialvalidation",
        cluster=self.ECSCluster,
        task_definition=taskDefinition,
        enable_execute_command=True,
        desired_count=1,
        min_healthy_percent=50,
        max_healthy_percent=200,
        circuit_breaker=ecs.DeploymentCircuitBreaker(
            enable=True,
            rollback=True
        ),
        vpc_subnets=subnets_es
    )

    #Attach scalable target
    scalable_target = appscaling.ScalableTarget(self,
        "{}-{}-scalableTarget".format(self.namingPrefix, service),
        #service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-essentialvalidation",
        service_namespace=appscaling.ServiceNamespace.ECS,
        #min_capacity=1,  # adjust as needed
        #max_capacity=20  # adjust as needed
        min_capacity=config.getint(service, 'autoscaling_min_capacity'),
        max_capacity=config.getint(service, 'autoscaling_max_capacity'),
        resource_id=f"service/{self.ECSCluster.cluster_name}/{ecsService.service_name}",
        scalable_dimension="ecs:service:DesiredCount"
    )

    # Define CloudWatch metric for SQS ApproximateNumberOfMessagesVisible

    sqs_metric = cloudwatch.Metric(
        namespace="AWS/SQS",
        metric_name="ApproximateNumberOfMessagesVisible",
        dimensions_map={"QueueName": queue.queue_name},
        statistic="Minimum",
        period=Duration.seconds(10)
    )

    #sqs_metric_scaleout = sqs_metric.with_(
    #    period=Duration.seconds(10)
    #)

    #sqs_metric_scalein = sqs_metric.with_(
    #    period=Duration.seconds(10)
    #)

    # Cloudwatch Scale-out Alarm
    scale_out_alarm = cloudwatch.Alarm(self,
        "{}-{}-scaleoutAlarm".format(self.namingPrefix, service),
        alarm_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-essential-scaleout-alarm",
        metric=sqs_metric,
        threshold=1,
        evaluation_periods=2,
        datapoints_to_alarm=2,
        comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    )

    # Define step-out policy
    scale_out_action = scalable_target.scale_on_metric(
        f"{config['main']['resource_prefix']}-{config['main']['tier']}-essential-scale-out",
        metric=sqs_metric,
        scaling_steps=[
            appscaling.ScalingInterval(lower=1, upper=21, change=5),   # when 1 ≤ messages < 21 → add 5 tasks
            appscaling.ScalingInterval(lower=21, change=20),           # when ≥ 21 → add 20 tasks
        ],
        adjustment_type=appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
        cooldown=Duration.seconds(300)
    )

    # Cloudwatch Scale-in alarm
    scale_in_alarm = cloudwatch.Alarm(self,
        "{}-{}-scaleinAlarm".format(self.namingPrefix, service),
        alarm_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-essential-scalein-alarm",
        metric=sqs_metric,
        threshold=0,
        evaluation_periods=3,
        datapoints_to_alarm=3,
        comparison_operator=cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD
    )

    # Define step-in policy
    scale_in_action = scalable_target.scale_on_metric(
        f"{config['main']['resource_prefix']}-{config['main']['tier']}-essential-scale-in",
        metric=sqs_metric,
        scaling_steps=[
            appscaling.ScalingInterval(upper=0, change=-1),   # remove 1 task if < or = 0
            appscaling.ScalingInterval(lower=1, change=0),
        ],
        adjustment_type=appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
        cooldown=Duration.seconds(10)    
    )

    # set service run by schedule
    tier = config['main']['tier']
    if tier.lower() != 'prod':
        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-essential-start",
            schedule=appscaling.Schedule.cron(
                minute="5",
                hour="11",
                week_day="MON-FRI"
            ),
            min_capacity=1,
            max_capacity=1,
            #schedule_time_zone="America/New_York"
        )
        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-essential-stop",
            schedule=appscaling.Schedule.cron(
                minute="0",
                hour="23",
                week_day="MON-FRI"
            ),
            min_capacity=0,
            max_capacity=0
        #    schedule_time_zone="America/New_York"
        )

    # Connect alarm to scale out policy
    #scale_out_alarm.add_alarm_action(
    #    cw_actions.ApplicationScalingAction(scale_out_action)
    #)
