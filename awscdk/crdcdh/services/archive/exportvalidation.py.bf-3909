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

class exportvalidationService:
  def createService(self, config):

    ### ExportValidation Service ############################################################################################################
    service = "exportvalidation"

    # Set container configs
    if config.has_option(service, 'entrypoint'):
        entry_point = ["/bin/sh", "-c", config[service]['entrypoint']]
    else:
        entry_point = None

    taskDefinition = ecs.FargateTaskDefinition(self,
        "{}-{}-taskDef".format(self.namingPrefix, service),
        family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-exportvalidation",
        cpu=config.getint(service, 'cpu'),
        memory_limit_mib=config.getint(service, 'memory')
    )

    exec_role = taskDefinition.obtain_execution_role()
    role_arn = exec_role.role_arn

    environment={
            "DATE":date.today().isoformat(),
            "PROJECT":"crdc-hub",
            "VERSION":config[service]['image'],
            "FARGATE":"true",
            "SESSION_SECRET":"abcd256asghaaamnkloofghj",
            "NEW_RELIC_APP_NAME":"{}-{}".format(self.namingPrefix, service),
            "NEW_RELIC_DISTRIBUTED_TRACING_ENABLED":"true",
            "NEW_RELIC_HOST":"gov-collector.newrelic.com",
            "NEW_RELIC_LABELS":"Project:{};Environment:{}".format('crdc-hub', config['main']['env']),
            "NEW_RELIC_LOG_FILE_NAME":"STDOUT",
            "NRIA_IS_FORWARD_ONLY":"true",
            "NRIA_PASSTHROUGH_ENVIRONMENT":"ECS_CONTAINER_METADATA_URI,ECS_CONTAINER_METADATA_URI_V4,FARGATE",
            "NRIA_CUSTOM_ATTRIBUTES":"{\"nrDeployMethod\":\"downloadPage\"}",
            "NRIA_OVERRIDE_HOST_ROOT":"",
            "JAVA_OPTS": "-javaagent:/usr/local/tomcat/newrelic/newrelic.jar",
            "ROLE_ARN": exec_role.role_arn,
        }

    secrets={
            "NEW_RELIC_LICENSE_KEY":ecs.Secret.from_secrets_manager(secretsmanager.Secret.from_secret_name_v2(self, "export_newrelic", secret_name='monitoring/newrelic'), 'api_key'),
            "MONGO_DB_HOST":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_host'),
            "MONGO_DB_PORT":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_port'),
            "MONGO_DB_PASSWORD":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_password'),
            "MONGO_DB_USER":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_user'),
            "DATABASE_NAME":ecs.Secret.from_secrets_manager(self.secret, 'database_name'),
        }   
    
    # create sqs
    if(config[service]['create_sqs'] == "true"):
        queue = sqs.Queue(self, f"{self.namingPrefix}-{service}-queue",
            queue_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-{config[service]['queue_name']}-queue.fifo",
            fifo=True
        )
    else:
        queue_arn = config[service].get("queue_arn")
        queue = sqs.Queue.from_queue_arn(
            self,
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-{config[service]['queue_name']}-queue",
            queue_arn
        )
 
    #taskDefinition = ecs.FargateTaskDefinition(self,
        #"{}-{}-taskDef".format(self.namingPrefix, service),
        #family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-exportvalidation",
        #cpu=config.getint(service, 'cpu'),
        #memory_limit_mib=config.getint(service, 'memory')
    #)
    
    ecr_repo = ecr.Repository.from_repository_arn(self, "{}_repo".format(service), repository_arn=config[service]['repo'])
    
    # no sumolog
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

    # use sumo log
    #taskDefinition.add_container(
        #service,
        ##image=ecs.ContainerImage.from_registry("{}:{}".format(config[service]['repo'], config[service]['image'])),
        #image=ecs.ContainerImage.from_ecr_repository(repository=ecr_repo, tag=config[service]['image']),
        #cpu=config.getint(service, 'cpu'),
        #memory_limit_mib=config.getint(service, 'memory'),
        #port_mappings=[ecs.PortMapping(app_protocol=ecs.AppProtocol.http, container_port=config.getint(service, 'port'), name=service)],
        #entry_point=entry_point,
        #environment=environment,
        #secrets=secrets,
        #logging=ecs.LogDrivers.firelens(
            #options={
                #"Name": "http",
                #"Host": config['secrets']['sumo_collector_endpoint'],
                #"URI": "/receiver/v1/http/{}".format(config['secrets']['sumo_collector_token_backend']),
                #"Port": "443",
                #"tls": "on",
                #"tls.verify": "off",
                #"Retry_Limit": "2",
                #"Format": "json_lines"
            #}
        #)
    #)

    # Sumo Logic FireLens Log Router Container
    #sumo_logic_container = taskDefinition.add_firelens_log_router(
        #"sumologic-firelens",
        #image=ecs.ContainerImage.from_registry("public.ecr.aws/aws-observability/aws-for-fluent-bit:stable"),
        #firelens_config=ecs.FirelensConfig(
            #type=ecs.FirelensLogRouterType.FLUENTBIT,
            #options=ecs.FirelensOptions(
                #enable_ecs_log_metadata=True
            #)
        #),
    #essential=True
    #)

    # roles attached to ecs
    if(config['main']['create_bucket'] == "true"):
        bucket = s3.Bucket.from_bucket_name(self, f"{self.namingPrefix}-submission-export-ref", f"{self.namingPrefix}-submission")
    else:
        existing_bucket_name = config["secrets"].get("submission_bucket")
        bucket = s3.Bucket.from_bucket_name(self, f"{self.namingPrefix}-submission-export-existing", existing_bucket_name)

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

    bucket_names = [name.strip() for name in config['main']['datasync_buckets'].split(',')]
    bucket_arns_export = []
    for bucket_name in bucket_names:
        bucket_arns_export.append(f"arn:aws:s3:::{bucket_name}")
        bucket_arns_export.append(f"arn:aws:s3:::{bucket_name}/*")

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
        resources=bucket_arns_export
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


    # Grant SQS permissions to the task role
    queue.grant_send_messages(taskDefinition.task_role)
    queue.grant_consume_messages(taskDefinition.task_role)

    # get subnet for the ecs service
    #subnet_exp1 = config.get(service, 'subnet_exp1')
    #subnet_exp2 = config.get(service, 'subnet_exp2')
    #subnets_exp = ec2.SubnetSelection(
        #subnets=[
          #ec2.Subnet.from_subnet_id(self, "Subnet_exp1", subnet_exp1),
          #ec2.Subnet.from_subnet_id(self, "Subnet_exp2", subnet_exp2)
        #]
    #)
    ecsService = ecs.FargateService(self,
        "{}-{}-service".format(self.namingPrefix, service),
        service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-exportvalidation",
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
        vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
    )

    #Attach scalable target
    ecs_resource_id=f"service/{self.ECSCluster.cluster_name}/{ecsService.service_name}"

    scalable_target = appscaling.ScalableTarget(self,
        "{}-{}-scalableTarget".format(self.namingPrefix, service),
        #service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-exportvalidation",
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

    # Define CfnScalingPolicy for scale-OUT
    scale_out_policy = appscaling.CfnScalingPolicy(self,
        f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-out-policy",
        policy_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-out-policy",
        policy_type="StepScaling",
        resource_id=ecs_resource_id,
        scalable_dimension="ecs:service:DesiredCount",
        service_namespace="ecs",
        step_scaling_policy_configuration=appscaling.CfnScalingPolicy.StepScalingPolicyConfigurationProperty(
            adjustment_type="ExactCapacity",
            cooldown=300,
            metric_aggregation_type="Minimum",
            step_adjustments=[
                appscaling.CfnScalingPolicy.StepAdjustmentProperty(
                    scaling_adjustment=5,
                    metric_interval_lower_bound=0, # 1+0  = 1   (>= 1)
                    metric_interval_upper_bound=20, # 1+20 = 21  (< 21)
                ),
                appscaling.CfnScalingPolicy.StepAdjustmentProperty(
                    scaling_adjustment=20,
                    metric_interval_lower_bound=20, # 1+20  = 21   (>= 21)
                    metric_interval_upper_bound=50, # 1+50 = 51  (< 51)
                ),
                appscaling.CfnScalingPolicy.StepAdjustmentProperty(
                    scaling_adjustment=50,
                    metric_interval_lower_bound=50, # 1+50  = 51   (>= 51)
                    metric_interval_upper_bound=100, # 1+100 = 101  (< 101)
                ),
                appscaling.CfnScalingPolicy.StepAdjustmentProperty(
                    scaling_adjustment=100,
                    metric_interval_lower_bound=100, # 1+100  = 101   (>= 101)
                    metric_interval_upper_bound=200, # 1+200 = 201  (< 201)
                ),
                appscaling.CfnScalingPolicy.StepAdjustmentProperty(
                    scaling_adjustment=200,
                    metric_interval_lower_bound=200,  # 1+200 = 201 (>= 201) # no upper_bound = +Infinity
                ),
            ]
        )
    )

    #Manual CloudWatch Alarm — Scale OUT
    scale_out_alarm = cloudwatch.CfnAlarm(self,
        f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-out-alarm",
        alarm_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-out-alarm",
        namespace="AWS/SQS",
        metric_name="ApproximateNumberOfMessagesVisible",
        dimensions=[cloudwatch.CfnAlarm.DimensionProperty(name="QueueName", value=queue.queue_name)],
        statistic="Minimum",
        period=60,
        evaluation_periods=2,
        datapoints_to_alarm=2,
        threshold=1,
        comparison_operator="GreaterThanOrEqualToThreshold",
        treat_missing_data="notBreaching",
        alarm_actions=[scale_out_policy.ref]
    )

    # Define CfnScalingPolicy for scale-IN
    scale_in_policy = appscaling.CfnScalingPolicy(self,
        f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-in-policy",
        policy_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-in-policy",
        policy_type="StepScaling",
        resource_id=ecs_resource_id,
        scalable_dimension="ecs:service:DesiredCount",
        service_namespace="ecs",
        step_scaling_policy_configuration=appscaling.CfnScalingPolicy.StepScalingPolicyConfigurationProperty(
            adjustment_type="ChangeInCapacity",
            cooldown=10,
            metric_aggregation_type="Minimum",
            step_adjustments=[
                appscaling.CfnScalingPolicy.StepAdjustmentProperty(
                    scaling_adjustment=-1,
                    metric_interval_upper_bound=0,
                ),
            ]
        )
    )

    # Manual CloudWatch Alarm — Scale IN
    scale_in_alarm = cloudwatch.CfnAlarm(self,
        f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-in-alarm",
        alarm_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-scale-in-alarm",
        namespace="AWS/SQS",
        metric_name="ApproximateNumberOfMessagesVisible",
        dimensions=[cloudwatch.CfnAlarm.DimensionProperty(name="QueueName", value=queue.queue_name)],
        statistic="Minimum",
        period=60,
        evaluation_periods=3,
        datapoints_to_alarm=3,
        threshold=0,
        comparison_operator="LessThanOrEqualToThreshold",
        treat_missing_data="notBreaching",
        alarm_actions=[scale_in_policy.ref]
    )

    # set service run by schedule
    env = config['main']['env']
    if env.lower() != 'prod':
        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-start",
            schedule=appscaling.Schedule.cron(
                minute="5",
                hour="11",
                week_day="MON-FRI"
            ),
            min_capacity=1,
            max_capacity=200,
            #schedule_time_zone="America/New_York"
        )
        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-export-stop",
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
