import aws_cdk as cdk
from constructs import Construct
from configparser import ConfigParser
from aws_cdk import aws_iam as iam
from aws_cdk import RemovalPolicy, Duration
from aws_cdk import aws_bedrock as bedrock
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3vectors as s3vectors
#import random
import string

class KnowledgeBase(Construct):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # Read config file
        config = ConfigParser()
        config.read('config.ini')

        self.namingPrefix = "{}-{}".format(config['main']['resource_prefix'], config['main']['kb_tier'])

        # create S3 bucket for knowledge base data source

        self.datasource_bucket = s3.Bucket(
            self,
            f"{self.namingPrefix}-KnowledgeBaseDataSourceBucket",
            bucket_name=f"{self.namingPrefix}-chatbot-kb-datasource",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # create S3 bucket for vector store
        self.vector_bucket = s3vectors.CfnVectorBucket(
            self,
            f"{self.namingPrefix}-KnowledgeBaseVectorBucket",
            vector_bucket_name=f"{self.namingPrefix}-vector",
        )

        # create S3 kb bucket
        self.kb_bucket = s3.Bucket(
            self,
            f"{self.namingPrefix}-KnowledgeBaseBucket",
            bucket_name=f"{self.namingPrefix}-knowledgebase",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # Create IAM role for bedrock knowledge base

        account = config.get('main', 'account_id')
        bedrock_principal = iam.ServicePrincipal(
            "bedrock.amazonaws.com",
            conditions={
                "StringEquals": {
                    "aws:SourceAccount": account
                },
                "ArnLike": {
                    "aws:SourceArn": f"arn:aws:bedrock:{config['main']['region']}:{config['main']['account_id']}:knowledge-base/*"
                }
            }
        )

        self.kb_role = iam.Role(
            self,
            f"{self.namingPrefix}-kb-role",
            role_name=f"{self.namingPrefix}-kb-role",
            assumed_by=bedrock_principal,
        )

        self.kb_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["bedrock:InvokeModel"],
                resources=[
                    f"arn:aws:bedrock:{config['main']['region']}::foundation-model/amazon.titan-embed-text-v2:0",
                    f"arn:aws:bedrock:{config['main']['region']}::foundation-model/amazon.rerank-v1:0",
                    f"arn:aws:bedrock:{config['main']['region']}::foundation-model/cohere.rerank-v3-5:0"
                ]
            )
        )

        #Add S3 vector permissions
        self.kb_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3vectors:PutVectors",
                    "s3vectors:GetVectors",
                    "s3vectors:DeleteVectors",
                    "s3vectors:QueryVectors",
                    "s3vectors:ListVectors",
                    "s3vectors:GetIndex",
                    "bedrock:Rerank"
                ],
                resources=[
                    #f"arn:aws:s3vectors:{config['main']['region']}:{config['main']['account_id']}:bucket/{vector_bucket.bucket_name}",
                    #f"arn:aws:s3vectors:{config['main']['region']}:{config['main']['account_id']}:bucket/*",
                    #f"arn:aws:s3vectors:{config['main']['region']}:{config['main']['account_id']}:bucket/{vector_bucket.bucket_name}/index/*",
                    #f"arn:aws:s3vectors:{config['main']['region']}:{config['main']['account_id']}:bucket/*/index/*",
                    "*"
                ]

            )
        )

        #Add Bedrock Data Automation permissions if needed
        self.kb_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "bedrock:InvokeDataAutomationAsync",
                    "bedrock:InvokeDataAutomation",
                    "bedrock:GetDataAutomationStatus",
                    "bedrock:GetDataAutomationProject"
                ],
                resources=[
                    f"arn:aws:bedrock:*:{config['main']['account_id']}:data-automation-profile/*",
                    f"arn:aws:bedrock:*:{config['main']['account_id']}:data-automation-invocation/*",
                    f"arn:aws:bedrock:{config['main']['region']}:aws:data-automation-project/public-rag-default"
                ]
            )
        )

        # Grant permissions to read from data source bucket
        self.datasource_bucket.grant_read_write(self.kb_role)
        # Grant permissions to read from knowledgebase bucket
        self.kb_bucket.grant_read_write(self.kb_role)

        # Vector index inside the vector bucket
        self.vector_index = s3vectors.CfnIndex(
            self,
            f"{self.namingPrefix}-s3-vector-index",
            vector_bucket_name=self.vector_bucket.vector_bucket_name,
            index_name=f"{self.namingPrefix}-index",
            dimension=1024,
            data_type="float32",
            distance_metric="cosine",
            metadata_configuration=s3vectors.CfnIndex.MetadataConfigurationProperty(
                non_filterable_metadata_keys=[
                    "AMAZON_BEDROCK_TEXT",
                    "AMAZON_BEDROCK_METADATA"
                ]
            )
        )

        self.vector_index.add_dependency(self.vector_bucket)

        # Create Bedrock Knowledgebase with S3 vector store
        self.knowledge_base = bedrock.CfnKnowledgeBase(
            self,
            f"{self.namingPrefix}-kb",
            name=f"{self.namingPrefix}-chatbot-kb",
            description=f"Knowledge base for document retrieval with S3 vector store",
            role_arn=self.kb_role.role_arn,
            knowledge_base_configuration=bedrock.CfnKnowledgeBase.KnowledgeBaseConfigurationProperty(
                type="VECTOR",
                vector_knowledge_base_configuration=bedrock.CfnKnowledgeBase.VectorKnowledgeBaseConfigurationProperty(
                    embedding_model_arn=f"arn:aws:bedrock:{config['main']['region']}::foundation-model/amazon.titan-embed-text-v2:0",
                ),
            ),
            storage_configuration=bedrock.CfnKnowledgeBase.StorageConfigurationProperty(
                type="S3_VECTORS",
                s3_vectors_configuration=bedrock.CfnKnowledgeBase.S3VectorsConfigurationProperty(
                    #vector_bucket_arn=f"arn:aws:s3:{config['main']['region']}:{config['main']['account_id']}:bucket/{vector_bucket.bucket_name}",
                    vector_bucket_arn=self.vector_bucket.attr_vector_bucket_arn,
                    #index_name=f"{config['main']['resource_prefix']}-{config['main']['tier']}-index",
                    index_arn=self.vector_index.attr_index_arn,
                ),
            ),

        )

        self.knowledge_base.add_dependency(self.vector_index)
        self.knowledge_base.node.add_dependency(self.kb_role)

        # Data Source 1 - Unstructured PDFs with semantic chunking
        self.data_source_pdfs = bedrock.CfnDataSource(
            self,
            f"{self.namingPrefix}-datasource-pdfs",
            name="unstructured-pdfs",
            knowledge_base_id=self.knowledge_base.attr_knowledge_base_id,
            data_source_configuration=bedrock.CfnDataSource.DataSourceConfigurationProperty(
                type="S3",
                s3_configuration=bedrock.CfnDataSource.S3DataSourceConfigurationProperty(
                    bucket_arn=self.datasource_bucket.bucket_arn,
                    inclusion_prefixes=["unstructured-pdfs/"]  # Only process this folder
                ),
            ),
            vector_ingestion_configuration=bedrock.CfnDataSource.VectorIngestionConfigurationProperty(
                chunking_configuration=bedrock.CfnDataSource.ChunkingConfigurationProperty(
                    chunking_strategy="SEMANTIC",
                    semantic_chunking_configuration=bedrock.CfnDataSource.SemanticChunkingConfigurationProperty(
                        max_tokens=1024,
                        buffer_size=0,
                        breakpoint_percentile_threshold=95
                    ),
                ),
                parsing_configuration=bedrock.CfnDataSource.ParsingConfigurationProperty(
                    parsing_strategy="BEDROCK_DATA_AUTOMATION",
                )
            ),
        )

        self.data_source_pdfs.add_dependency(self.knowledge_base)

        # Data Source 2 - Unstructured Markdown with NO chunking
        self.data_source_markdown = bedrock.CfnDataSource(
            self,
            f"{self.namingPrefix}-datasource-markdown",
            name="unstructured-markdown",
            knowledge_base_id=self.knowledge_base.attr_knowledge_base_id,
            data_source_configuration=bedrock.CfnDataSource.DataSourceConfigurationProperty(
                type="S3",
                s3_configuration=bedrock.CfnDataSource.S3DataSourceConfigurationProperty(
                    bucket_arn=self.datasource_bucket.bucket_arn,
                    inclusion_prefixes=["unstructured-markdown/"]  # Only process this folder
                ),
            ),
            vector_ingestion_configuration=bedrock.CfnDataSource.VectorIngestionConfigurationProperty(
                chunking_configuration=bedrock.CfnDataSource.ChunkingConfigurationProperty(
                    chunking_strategy="NONE",  # No chunking
                ),
            ),
        )

        self.data_source_markdown.add_dependency(self.knowledge_base)


        # Data Source 3 - structured yaml
        self.data_source_yaml = bedrock.CfnDataSource(
            self,
            f"{self.namingPrefix}-datasource-structured-yaml",
            name="structured-yaml",
            knowledge_base_id=self.knowledge_base.attr_knowledge_base_id,
            data_source_configuration=bedrock.CfnDataSource.DataSourceConfigurationProperty(
                type="S3",
                s3_configuration=bedrock.CfnDataSource.S3DataSourceConfigurationProperty(
                    bucket_arn=self.datasource_bucket.bucket_arn,
                    inclusion_prefixes=["structured-yaml/"]
                ),
            ),
            vector_ingestion_configuration=bedrock.CfnDataSource.VectorIngestionConfigurationProperty(
                chunking_configuration=bedrock.CfnDataSource.ChunkingConfigurationProperty(
                    chunking_strategy="FIXED_SIZE",
                    fixed_size_chunking_configuration=bedrock.CfnDataSource.FixedSizeChunkingConfigurationProperty(
                        max_tokens=4096,
                        overlap_percentage=0,
                    ),
                ),
            ),
        )

