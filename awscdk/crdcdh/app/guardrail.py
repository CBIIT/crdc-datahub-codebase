import aws_cdk as cdk
from constructs import Construct, IConstruct
from configparser import ConfigParser
from aws_cdk import aws_bedrock as bedrock
#import random
import string

class Guardrail(Construct):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # Read config file
        config = ConfigParser()
        config.read('config.ini')

        self.namingPrefix = "{}-{}".format(config['main']['resource_prefix'], config['main']['kb_tier'])

        self.guardrail = bedrock.CfnGuardrail(
            self,
            f"{self.namingPrefix}-guardrail",
            name=f"{self.namingPrefix}-guardrail",
            description="Bedrock Guardrail created via CDK",
            blocked_input_messaging="Sorry, I'm unable to assist with that.",
            blocked_outputs_messaging="Sorry, I'm unable to assist with that.",

            content_policy_config=bedrock.CfnGuardrail.ContentPolicyConfigProperty(
                filters_config=[
                    bedrock.CfnGuardrail.ContentFilterConfigProperty(
                        type="SEXUAL",
                        input_strength="HIGH",
                        output_strength="HIGH",
                    ),
                    bedrock.CfnGuardrail.ContentFilterConfigProperty(
                        type="VIOLENCE",
                        input_strength="MEDIUM",
                        output_strength="MEDIUM",
                    ),
                    bedrock.CfnGuardrail.ContentFilterConfigProperty(
                        type="HATE",
                        input_strength="MEDIUM",
                        output_strength="MEDIUM",
                    ),
                    bedrock.CfnGuardrail.ContentFilterConfigProperty(
                        type="INSULTS",
                        input_strength="LOW",
                        output_strength="LOW",
                    ),
                    bedrock.CfnGuardrail.ContentFilterConfigProperty(
                        type="MISCONDUCT",
                        input_strength="LOW",
                        output_strength="LOW",
                    ),
                    bedrock.CfnGuardrail.ContentFilterConfigProperty(
                        type="PROMPT_ATTACK",
                        input_strength="MEDIUM",
                        output_strength="NONE",
                    ),
                ],
            ),

            word_policy_config=bedrock.CfnGuardrail.WordPolicyConfigProperty(
                managed_word_lists_config=[
                    bedrock.CfnGuardrail.ManagedWordsConfigProperty(
                        type="PROFANITY",
                        input_action="NONE",
                        output_action="BLOCK",
                    ),
                ],
            ),

            sensitive_information_policy_config=bedrock.CfnGuardrail.SensitiveInformationPolicyConfigProperty(
                pii_entities_config=[
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="PHONE",                             action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="AGE",                               action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="PASSWORD",                          action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="DRIVER_ID",                         action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="CREDIT_DEBIT_CARD_NUMBER",          action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="INTERNATIONAL_BANK_ACCOUNT_NUMBER", action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="SWIFT_CODE",                        action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="AWS_ACCESS_KEY",                    action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="AWS_SECRET_KEY",                    action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="US_PASSPORT_NUMBER",                action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="US_SOCIAL_SECURITY_NUMBER",         action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="US_BANK_ACCOUNT_NUMBER",            action="BLOCK"),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(type="US_BANK_ROUTING_NUMBER",            action="BLOCK"),
                ],
            ),
        )

        # Publishable guardrail version
        self.guardrail_version = bedrock.CfnGuardrailVersion(
            self,
            f"{self.namingPrefix}-guardrail-version",
            guardrail_identifier=self.guardrail.attr_guardrail_id,
            description="Initial version",
        )

        self.guardrail_version.add_dependency(self.guardrail)
