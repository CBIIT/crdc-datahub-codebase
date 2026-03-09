import boto3
import json
from botocore.exceptions import ClientError


def get_secret(secret_name, region_name="us-east-1"):
    '''
    Returns a dict that contains all secret values in a given secret
    :param secret_name:
    :param region_name:
    :return: dict that contains all secret values
    '''
    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        response = client.get_secret_value(
            SecretId=secret_name
        )
        return json.loads(response['SecretString'])
    except ClientError as e:
        # For a list of exceptions thrown, see
        # https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        raise e
