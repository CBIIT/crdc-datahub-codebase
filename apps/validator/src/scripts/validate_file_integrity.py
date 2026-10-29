import os, csv
from datetime import datetime

import boto3
from botocore.exceptions import ClientError
from pymongo import MongoClient

SIZE = 'size'
URI = 'URI'
GUID = 'GUID'
RESULT = 'Result'
INTERMEDIATE_RESULT_FILE_NAME = 'intermediate_results.csv'
RELEASE_COLLECTION = "release"
DATA_FILE_LOCATION = "dataFileLocation"
PROPS = "props"
FILE_SIZE = "file_size"
NODE_ID = "nodeID"


def main():
    bucket = os.environ.get('RESULT_BUCKET', '')
    prefix = os.environ.get('RESULT_PREFIX', 'integrity-results')
    intermediate_file_path = os.path.join(prefix, INTERMEDIATE_RESULT_FILE_NAME)
    connection_str = os.environ.get('DB_CONNECTION_STRING', '')
    db_name = os.environ.get('DB_NAME', 'crdc-datahub')

    recorder = None
    try:

        now = datetime.now()
        files_list = get_files_from_db(connection_str, db_name)
        print(f'Found {len(files_list)} files')
        intermediate_results = get_intermediate_result(bucket, intermediate_file_path)
        recorder = IntermediateResultsRecorder(INTERMEDIATE_RESULT_FILE_NAME)
        succeeded_files, failed_files = validate_all_files_integrity(files_list, get_s3_header, intermediate_results, recorder.record_result)

        succeeded_file_name = get_succeeded_result_file_name(now, len(succeeded_files), len(files_list))
        failed_file_name = get_failed_result_file_name(now, len(failed_files), len(files_list))

        recorder = None
        delete_intermediate_file(bucket, intermediate_file_path)
        write_results_to_file(succeeded_files, succeeded_file_name, failed_files, failed_file_name )
        if os.path.isfile(failed_file_name):
            key = os.path.join(prefix, failed_file_name)
            upload_file_to_s3(bucket, key, failed_file_name)
        if os.path.isfile(succeeded_file_name):
            key = os.path.join(prefix, succeeded_file_name)
            upload_file_to_s3(bucket, key, succeeded_file_name)
    except Exception as e:
        print(e)
    finally:
        if recorder:
            recorder.close()
        if os.path.isfile(INTERMEDIATE_RESULT_FILE_NAME):
            upload_file_to_s3(bucket, intermediate_file_path, INTERMEDIATE_RESULT_FILE_NAME)

def validate_all_files_integrity(file_list: list, get_file_header, intermediate_results: dict = {}, result_recorder = None):
    succeeded_files = []
    failed_files = []
    for file in file_list:
        print(f'Validating file {file}')
        guid = file[GUID]
        if guid in intermediate_results:
            status = intermediate_results[guid]
        else:
            status = validate_file_integrity(file, get_file_header)
        if callable(result_recorder):
            result_recorder(guid, status)
        if status == 'Succeeded':
            succeeded_files.append(_compose_result(file, status))
        else:
            failed_files.append(_compose_result(file, status))

    return succeeded_files, failed_files

def get_files_from_db(connection_str: str, db_name: str):
    client = MongoClient(connection_str)
    db = client[db_name]
    data_collection = db[RELEASE_COLLECTION]
    query = {DATA_FILE_LOCATION: {"$exists": True, "$nin": [None, ""]}, "status": {"$ne": "Deleted"}}
    files = []
    for data in data_collection.find(query):
        location = data.get(DATA_FILE_LOCATION)
        props = data.get(PROPS, {})
        size = int(props.get(FILE_SIZE)) if props else 0
        guid = data.get(NODE_ID)
        files.append({
            GUID: guid,
            URI: location,
            SIZE: size
        })
    return files

def delete_intermediate_file(bucket: str, file_path: str):
    basename = os.path.basename(file_path)
    os.remove(basename)
    client = boto3.client('s3')
    client.delete_object(Bucket=bucket, Key=file_path)

def get_intermediate_result(bucket: str, file_path: str):
    basename = os.path.basename(file_path)
    download_file_from_s3(bucket, file_path, basename)
    result = {}
    if os.path.isfile(basename):
        with open(basename) as csv_file:
            csv_reader = csv.DictReader(csv_file, delimiter=',')
            for row in csv_reader:
                if GUID in row and RESULT in row:
                    result[row[GUID]] = row[RESULT]
    return result

def download_file_from_s3(bucket: str, key: str, local_file_name: str):
    try:
        if not bucket or not key:
            print('bucket or key not provided')
            return
        s3_client = boto3.client('s3')
        header = s3_client.head_object(Bucket=bucket, Key=key)
        s3_client.download_file(bucket, key, local_file_name)
    except Exception as e:
        print(e)

def upload_file_to_s3(bucket: str, key: str, local_file_name: str):
    try:
        if not bucket or not key:
            print('bucket or key not provided')
            return
        s3_client = boto3.client('s3')
        s3_client.upload_file(
            Filename=local_file_name,
            Bucket=bucket,
            Key=key
        )
    except Exception as e:
        print(e)


def _compose_result(file_info: dict, status: str):
    uri = file_info[URI]
    _, key = _extrac_bucket_key_from_s3_url(uri)
    return {
        'Study ID': _get_study_id_from_s3_url(uri),
         GUID: file_info[GUID],
        'File Name': os.path.basename(key),
        'Location': uri,
        RESULT: status
    }

def _get_study_id_from_s3_url(s3_url):
    if not s3_url.startswith("s3://"):
        return None
    stripped = s3_url.replace('s3://', '')
    parts = stripped.split("/")
    if len(parts) < 2:
        return None
    return parts[1]

def validate_file_integrity(file_info: dict, get_file_header):
    if not isinstance(file_info, dict) or not callable(get_file_header) or not file_info \
            or SIZE not in file_info or URI not in file_info:
        return 'Invalid Parameter'
    uri = file_info[URI]
    expected_size = int(file_info[SIZE])
    header = get_file_header(uri)
    if not header:
        return 'Missing'

    actual_size = int(header[SIZE])
    if actual_size == expected_size:
        return 'Succeeded'
    else:
        return 'Size Mismatch'


def get_s3_header(uri: str):
    bucket_name, key = _extrac_bucket_key_from_s3_url(uri)
    s3_client = boto3.client('s3')
    for i in range(2):
        try:
            response = s3_client.head_object(Bucket=bucket_name, Key=key)
            return {"size": response["ContentLength"]}
        except ClientError as e:
            if e.response['Error']['Code'] in ('404', 'NoSuchKey'):
                return None
            else:
                print('Error happened when reading file metadata')
                print(e)
    raise Exception(f'Retrieve file metadata failed! {uri}')

def _extrac_bucket_key_from_s3_url(s3_url):
    stripped = s3_url.replace('s3://', '')
    parts = stripped.split('/')
    bucket_name = parts[0]
    key = "/".join(parts[1:])
    return bucket_name, key

def get_succeeded_result_file_name(date: datetime, succeeded: int, total:int):
    return _get_result_file_name(date, succeeded, total, 'succeeded')

def get_failed_result_file_name(date: datetime, failed: int, total: int):
    return _get_result_file_name(date, failed, total, 'failed')

def _get_result_file_name(date: datetime, count: int, total: int, file_type: str):
    current_date_time_str = _get_timestamp(date)
    return f"{current_date_time_str}_{file_type}_{count}_of_{total}.csv"

def _get_timestamp(date: datetime):
    return date.strftime("%Y-%m-%dT%H-%M-%S")

def write_results_to_file(succeeded_files, succeeded_file_name,  failed_files, failed_file_name):
    headers = ["Study ID", "GUID", "File Name", "Location", "Result"]
    if len(failed_files) > 0:
        with open(failed_file_name, "w") as f:
            csv_writer = csv.DictWriter(f, fieldnames=headers)
            csv_writer.writeheader()
            csv_writer.writerows(failed_files)

    if len(succeeded_files) != 0:
        with open(succeeded_file_name, "w") as f:
            csv_writer = csv.DictWriter(f, fieldnames=headers)
            csv_writer.writeheader()
            csv_writer.writerows(succeeded_files)


class IntermediateResultsRecorder:
    def __init__(self, file_name: str):
        self.csv_file = open(file_name, 'w')
        headers = [GUID, RESULT]
        self.csv_writer = csv.writer(self.csv_file, delimiter=',')
        self.csv_writer.writerow(headers)

    def __del__(self):
        self.close()

    def record_result(self, guid: str, status: str):
        self.csv_writer.writerow([guid, status])

    def close(self):
        self.csv_file.close()


if __name__ == "__main__":
    main()