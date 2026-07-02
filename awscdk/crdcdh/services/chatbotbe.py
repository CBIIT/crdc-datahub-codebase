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

class chatbotbeService:
  def createService(self, config):

    ### Chatbot Backend Service ###############################################################################################################
    service = "chatbotbe"

    # Set container configs
    if config.has_option(service, 'entrypoint'):
        entry_point = ["/bin/sh", "-c", config[service]['entrypoint']]
    else:
        entry_point = None

    taskDefinition = ecs.FargateTaskDefinition(self,
        "{}-{}-taskDef".format(self.namingPrefix, service),
        family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-chatbotbe",
        cpu=config.getint(service, 'cpu'),
        memory_limit_mib=config.getint(service, 'memory')
    )

    exec_role = taskDefinition.obtain_execution_role()
    role_arn = exec_role.role_arn
    #task_role = taskDefinition.task_role

    # Add task role ARN to the execution role trust relationship needed buy the dev team to get temporary credential, the code needs to assume the role first.

    #exec_role.assume_role_policy.add_statements(
        #iam.PolicyStatement(
            #effect=iam.Effect.ALLOW,
            #principals=[iam.ServicePrincipal('ecs-tasks.amazonaws.com'), iam.ArnPrincipal(task_role.role_arn)],
            #actions=["sts:AssumeRole"]
        #)
    #)
    #not working - role_arn = taskDefinition.execution_role.role_arn
    #debug
    #print(f"Fargate Task Definition Execution Role ARN: {role_arn}")

    environment={
            "DATE":date.today().isoformat(),
            "DEV_TIER":config['main']['env'],
            "SERVICE_VERSION":config[service]['image'],
            "AWS_REGION": config['main']['region'],
            "MODEL_ARN": f"arn:aws:bedrock:{config['main']['region']}:{config['main']['account_id']}:inference-profile/us.anthropic.claude-opus-4-6-v1",
            "RERANK_MODEL_ARN": f"arn:aws:bedrock:{config['main']['region']}::foundation-model/cohere.rerank-v3-5:0",
            "GUARDRAIL_VERSION": "1",
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
            "PHOENIX_COLLECTOR_ENDPOINT": "https://ctos-phoenix.nci.nih.gov",
            "PHOENIX_API_KEY":config[service]['phoenix_api_key'],
            "PHOENIX_PROJECT_NAME":config[service]['phoenix_project_name'],
        }

    secrets={
            "NEW_RELIC_LICENSE_KEY":ecs.Secret.from_secrets_manager(secretsmanager.Secret.from_secret_name_v2(self, "chatbotbe_newrelic", secret_name='monitoring/newrelic'), 'api_key'),
            "KNOWLEDGE_BASE_ID":ecs.Secret.from_secrets_manager(self.secret, 'knowledge_base_id'),
            "GUARDRAIL_ID":ecs.Secret.from_secrets_manager(self.secret, 'guardrail_id'),
            "KNOWLEDGE_BASE_SOURCE_BUCKET_ARN":ecs.Secret.from_secrets_manager(self.secret, 'datasource_bucket_arn')
        }   
    
    #taskDefinition = ecs.FargateTaskDefinition(self,
        #"{}-{}-taskDef".format(self.namingPrefix, service),
        #family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-backend",
        #cpu=config.getint(service, 'cpu'),
        #memory_limit_mib=config.getint(service, 'memory')
    #)

    
    ecr_repo = ecr.Repository.from_repository_arn(self, "{}_repo".format(service), repository_arn=config[service]['repo'])
    
    #no sumolog
    taskDefinition.add_container(
        service,
        #image=ecs.ContainerImage.from_registry("{}:{}".format(config[service]['repo'], config[service]['image'])),
        image=ecs.ContainerImage.from_ecr_repository(repository=ecr_repo, tag=config[service]['image']),
        cpu=config.getint(service, 'cpu'),
        memory_limit_mib=config.getint(service, 'memory'),
        port_mappings=[ecs.PortMapping(app_protocol=ecs.AppProtocol.http, container_port=config.getint(service, 'port'), name=service)],
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


    #roles attached to ecs

    aws_market_place_policy = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=[
            "aws-marketplace:ViewSubscriptions",
            #"aws-marketplace:Subscribe"
        ],
        resources=["*"]
    )

    # AllowRetrieveAndGenerateOnKB
    bedrock_kb_policy1 = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=[
            "bedrock:Retrieve",
            "bedrock:RetrieveAndGenerate",
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream"
        ],
        resources=[
            f"arn:aws:bedrock:{config['main']['region']}:{config['main']['account_id']}:knowledge-base/*",
            f"arn:aws:bedrock:{config['main']['region']}::foundation-model/*",
            "arn:aws:bedrock:us-east-2::foundation-model/*",
            "arn:aws:bedrock:us-west-1::foundation-model/*",
            "arn:aws:bedrock:us-west-2::foundation-model/*",
            "arn:aws:bedrock:*:*:inference-profile/*",
            "arn:aws:bedrock:*:*:application-inference-profile/*"
        ]
    )

    bedrock_kb_policy2 = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=[
            "bedrock:GetInferenceProfile"
        ],
        resources=["*"]
    )

    bedrock_kb_policy3 = iam.PolicyStatement(
        effect=iam.Effect.ALLOW,
        actions=[
            "bedrock:ApplyGuardrail"
        ],
        resources=[f"arn:aws:bedrock:{config['main']['region']}:{config['main']['account_id']}:guardrail/*"]
    )

    # attach policy to the task role
    #taskDefinition.task_role.add_to_policy(aws_market_place_policy)
    taskDefinition.task_role.add_to_policy(bedrock_kb_policy1)
    taskDefinition.task_role.add_to_policy(bedrock_kb_policy2)
    taskDefinition.task_role.add_to_policy(bedrock_kb_policy3)

    taskDefinition.execution_role.add_to_policy(aws_market_place_policy)
    taskDefinition.execution_role.add_to_policy(bedrock_kb_policy1)
    taskDefinition.execution_role.add_to_policy(bedrock_kb_policy2)
    taskDefinition.execution_role.add_to_policy(bedrock_kb_policy3)


    taskDefinition.task_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("CloudWatchLogsFullAccess")
    )

    taskDefinition.execution_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("CloudWatchLogsFullAccess")
    )

    
    # get subnet for the ecs service
    #subnet_be1 = config.get(service, 'subnet_be1')
    #subnet_be2 = config.get(service, 'subnet_be2')
    #subnets_be = ec2.SubnetSelection(
        #subnets=[
          #ec2.Subnet.from_subnet_id(self, "Subnet_be1", subnet_be1),
          #ec2.Subnet.from_subnet_id(self, "Subnet_be2", subnet_be2)
        #]
    #)
    ecsService = ecs.FargateService(self,
        "{}-{}-service".format(self.namingPrefix, service),
        service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-chatbotbe",
        cluster=self.ECSCluster,
        task_definition=taskDefinition,
        enable_execute_command=True,
        min_healthy_percent=50,
        max_healthy_percent=200,
        circuit_breaker=ecs.DeploymentCircuitBreaker(
            enable=True,
            rollback=True
        ),
        vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
    )

    scalable_target = ecsService.auto_scale_task_count(
        min_capacity=1,  # adjust as needed
        max_capacity=1  # adjust as needed
    )

    scalable_target.scale_on_cpu_utilization(
        "CpuScalingPolicy",
        target_utilization_percent=80,  # target average CPU utilization
        scale_in_cooldown=Duration.seconds(60),   # wait 60s before scaling in
        scale_out_cooldown=Duration.seconds(60)   # wait 60s before scaling out
    )

    # scale on schedule
    env = config['main']['env']
    if env.lower() != 'prod':
        scalable_target.scale_on_schedule(
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-chatbotbe-start",
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
            f"{config['main']['resource_prefix']}-{config['main']['tier']}-chatbotbe-stop",
            schedule=appscaling.Schedule.cron(
                minute="0",
                hour="23",
                week_day="MON-FRI"
            ),
            min_capacity=0,
            max_capacity=0
            #schedule_time_zone="America/New_York"
        )
    ecsTarget = self.listener.add_targets("ECS-{}-Target".format(service),
        port=int(config[service]['port']),
        protocol=elbv2.ApplicationProtocol.HTTP,
        target_group_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-chatbotbe",
        health_check = elbv2.HealthCheck(
            path=config[service]['health_check_path'],
            timeout=Duration.seconds(config.getint(service, 'health_check_timeout')),
            interval=Duration.seconds(config.getint(service, 'health_check_interval')),),
        targets=[ecsService],)

    #elbv2.ApplicationListenerRule(self, id="alb-{}-rule".format(service),
        #conditions=[
            #elbv2.ListenerCondition.host_headers(config[service]['host'].split(',')),
            #elbv2.ListenerCondition.path_patterns(config[service]['path'].split(','))
        #],
        #priority=int(config[service]['priority_rule_number']),
        #listener=self.listener,
        #target_groups=[ecsTarget])

    target_group_arn = ecsTarget.target_group_arn
    cfn_rule = elbv2.CfnListenerRule(
        self,
        id=f"alb-{service}-rule",
        listener_arn=self.listener.listener_arn,
        priority=int(config[service]['priority_rule_number']),
        conditions=[
            {
                "field": "path-pattern",
                "pathPatternConfig": {
                    "values": config[service]['path'].split(",")
                }
            }    
        ],    
        actions=[
            {
                "type": "forward",
                "forwardConfig": {
                    "targetGroups": [
                        {"targetGroupArn": target_group_arn}
                    ]
                }
            }
        ],
        transforms=[
            {
                "type": "url-rewrite",
                "urlRewriteConfig": {
                    "rewrites": [
                        {
                            "regex": "^/api/chat/*",
                            "replace": "/"
                        }
                    ]
                }
            }    
        ]
    )
