from aws_cdk import Duration

from aws_cdk import aws_elasticloadbalancingv2 as elbv2
from aws_cdk import aws_ecs as ecs
from aws_cdk import aws_ecr as ecr
from aws_cdk import aws_secretsmanager as secretsmanager
from datetime import date
from aws_cdk import Duration
from aws_cdk import aws_applicationautoscaling as appscaling
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as cw_actions
from aws_cdk import aws_sqs as sqs
from aws_cdk import aws_iam as iam
from aws_cdk import aws_events as events
from aws_cdk import aws_events_targets as targets
from aws_cdk import aws_ec2 as ec2

class pvpullerService:
  def createService(self, config):

    ### Pvpuller Service ############################################################################################################
    service = "pvpuller"

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
            "NEW_RELIC_LICENSE_KEY":ecs.Secret.from_secrets_manager(secretsmanager.Secret.from_secret_name_v2(self, "pvpuller_newrelic", secret_name='monitoring/newrelic'), 'api_key'),
            "MONGO_DB_HOST":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_host'),
            "MONGO_DB_PORT":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_port'),
            "MONGO_DB_PASSWORD":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_password'),
            "MONGO_DB_USER":ecs.Secret.from_secrets_manager(self.secret, 'mongo_db_user'),
            "DATABASE_NAME":ecs.Secret.from_secrets_manager(self.secret, 'database_name'),
        }   
    
    # create sqs
#    dead_letter_queue = sqs.Queue(self, f"{self.namingPrefix}-{service}-dlqueue",
#        queue_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-{service}-dlq",
#        fifo=False
#    )
 
    taskDefinition = ecs.FargateTaskDefinition(self,
        "{}-{}-taskDef".format(self.namingPrefix, service),
        family=f"{config['main']['resource_prefix']}-{config['main']['tier']}-pvpuller",
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


    # attach amazon full SQS access to the task role
    taskDefinition.task_role.add_managed_policy(
        iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSQSFullAccess")
    )

    # Grant SQS permissions to the task role
#    dead_letter_queue.grant_send_messages(taskDefinition.task_role)
#    dead_letter_queue.grant_consume_messages(taskDefinition.task_role)

    # Create EventBridge Rule for Scheduling
    scheduled_rule = events.Rule(self,
        f"{self.namingPrefix}-{service}-schedule-rule",
        rule_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-{service}-schedule-rule",
        description=f"Run {service} task on schedule",
        schedule=events.Schedule.expression(config[service]['cron_schedule'])
    )

    # get subnet for the ecs service
    subnet_pv1 = config.get(service, 'subnet_pv1')
    subnet_pv2 = config.get(service, 'subnet_pv2')
    subnets_pv= ec2.SubnetSelection(
        subnets=[
          ec2.Subnet.from_subnet_id(self, "Subnet_pv1", subnet_pv1),
          ec2.Subnet.from_subnet_id(self, "Subnet_pv2", subnet_pv2)
        ]
    )
    # Extract security group ID
    #security_group_id = config.get('SecurityGroup', 'security_group_id')
    security_group_id = config.get(service, 'security_group_id')
    security_group = ec2.SecurityGroup.from_security_group_id(self,
        f"{config['main']['resource_prefix']}-{config['main']['tier']}-SG",
        security_group_id
    )

    # Add ECS task as target
    scheduled_rule.add_target(
        targets.EcsTask(
        cluster=self.ECSCluster,
        task_definition=taskDefinition,
        task_count=config.getint(service, 'task_count'),
        subnet_selection=subnets_pv,
        security_groups=[security_group],
        assign_public_ip=False,
        #role=iam.Role.from_role_arn(
        #            self,
        #            f"{service}-eventsbridge-role",
        #            config[service]['eventsbridge_role_arn']
        #        ),
        platform_version=ecs.FargatePlatformVersion.LATEST,
#        dead_letter_queue=dead_letter_queue,
        )
    )

    #ecsService = ecs.FargateService(self,
    #    "{}-{}-service".format(self.namingPrefix, service),
    #    service_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-essentialvalidation",
    #    cluster=self.ECSCluster,
    #    task_definition=taskDefinition,
    #    enable_execute_command=True,
    #    desired_count=1,
    #    min_healthy_percent=50,
    #    max_healthy_percent=200,
    #    circuit_breaker=ecs.DeploymentCircuitBreaker(
    #        enable=True,
    #        rollback=True
    #    ),
    #)
