import aws_cdk as cdk
import jsii
from constructs import Construct, IConstruct
from configparser import ConfigParser
from aws_cdk import aws_iam as iam
from aws_cdk import aws_logs as logs
#import random
import string

@jsii.implements(cdk.IAspect)
class MyAspect:
    def visit(self, node):

        # Read config file
        config = ConfigParser()
        config.read('config.ini')
#        random_name = ''.join(random.choice(string.ascii_letters) for _ in range(10))
        if isinstance(node, iam.CfnRole):
            if config.has_option('iam', 'role_prefix'):
                resolvedLogicalId = cdk.Stack.of(node).resolve(node.logical_id)
                #roleName = config['iam']['role_prefix'] + '-' + config['main']['resource_prefix'] + '-' + random_name
                roleName = config['iam']['role_prefix'] + '-' + config['main']['tier'] + '-' + resolvedLogicalId
                roleName = roleName[:64]  # Ensure the role name is within the 64 character limit
                node.role_name = roleName

        # Apply the security defaults to every log group, including log groups
        # created implicitly by ECS aws_logs drivers.
        if isinstance(node, logs.CfnLogGroup):
            node.retention_in_days = 30
            node.apply_removal_policy(cdk.RemovalPolicy.DESTROY)
