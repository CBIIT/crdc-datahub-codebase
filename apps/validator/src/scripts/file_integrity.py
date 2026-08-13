import os
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError
from pymongo import MongoClient

from ..common.constants import RELEASE_COLLECTION, STUDY_ID, DATA_FILE_LOCATION

BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")


def get_study_data_files_from_db(client, db_name, studyID):
    db = client[db_name]
    data_collection = db[RELEASE_COLLECTION]
    query = {STUDY_ID: studyID, DATA_FILE_LOCATION: {"$exists": True, "$nin": [None, ""]}}
    files = []
    for data in data_collection.find(query):
        location = data.get(DATA_FILE_LOCATION)
        props = data.get("props")
        size = float(props.get("file_size")) if props else 0
        guid = data.get("nodeID")
        files.append({
            'GUID': guid,
            DATA_FILE_LOCATION: location,
            "file_size": size
        })
    return files

def get_old_data_file_location(bucket_name, study_id, file_name):
    return f"s3://{bucket_name}/{study_id}/{file_name}"


def get_old_data_files_from_db(client, db_name):
    db = client[db_name]
    data_collection = db[RELEASE_COLLECTION]

    pipeline = [
        {
            "$match": {
            DATA_FILE_LOCATION: { "$exists": False },
            "nodeType": "file"
            }
        },
        { 
            "$lookup": {
                "as": "submissions",
                "from": "submissions",
                "foreignField": "_id",
                "localField": "submissionID"
            }
        },
        {
            "$match": {
                "submissions.dataType": "Metadata and Data Files"
            }
        }
    ]
    files = []
    for data in data_collection.aggregate(pipeline):
        props = data.get("props")
        submission = data.get("submissions", [{}])[0]
        study_id = submission.get("studyID")
        location = get_old_data_file_location(BUCKET_NAME, study_id, props.get("file_name"))
        size = float(props.get("file_size")) if props else 0
        guid = data.get("nodeID")
        files.append({
            'GUID': guid,
            DATA_FILE_LOCATION: location,
            "file_size": size
        })
    return files


def get_mongo_client(connection_str):
    return MongoClient(connection_str)

def extrac_bucket_key_from_s3_url(s3_url):
    stripped = s3_url.replace('s3://', '')
    splitted = stripped.split('/')
    bucket_name = splitted[0]
    key = "/".join(splitted[1:])
    return bucket_name, key

def check_s3_file(bucket_name, key):
    s3_client = boto3.client('s3')
    try:
        response = s3_client.head_object(Bucket=bucket_name, Key=key)
        return {"exist": True, "size": response["ContentLength"]}
    except ClientError as e:
        if e.response['Error']['Code'] in ('404', 'NoSuchKey'):
            return {"exist": False}
        raise e

def write_results_to_file(succeeded_files, missing_files, wrong_size_files, studyID):
    if len(missing_files) != 0 or len(wrong_size_files) != 0:
        with open(f"tmp/{studyID}_file_integrity_results_failed.txt", "w") as f:
            f.write(f"Study ID: {studyID}\n")
            f.write(f"Total Files Checked: {len(succeeded_files) + len(missing_files) + len(wrong_size_files)}\n")
            f.write(f"\nMissing Files: {len(missing_files)}\n")
            for file in missing_files:
                f.write(f"{file[0]}: {file[1]}\n")
            f.write(f"\nWrong Size Files: {len(wrong_size_files)}\n")
            for file in wrong_size_files:
                f.write(f"{file[0]}: {file[1]}\n")

    if len(succeeded_files) != 0:
        with open(f"tmp/{studyID}_file_integrity_results_succeeded.txt", "w") as f:
            f.write(f"Study ID: {studyID}\n")
            f.write(f"Total Files Checked: {len(succeeded_files) + len(missing_files) + len(wrong_size_files)}\n")
            f.write(f"Succeeded Files: {len(succeeded_files)}\n")
            for file in succeeded_files:
                f.write(f"{file[0]}: {file[1]}\n")

if __name__ == "__main__":
    try:
        import argparse
        from dotenv import load_dotenv
        load_dotenv()
        connection_str = os.environ.get("MONGO_CONNECTION_STRING")
        db_name = os.environ.get("MONGO_DB_NAME")

        parser = argparse.ArgumentParser()
        parser.add_argument("studyID", help="Study ID to check file integrity for")
        parser.add_argument("--old-format", help="Validate old format data files (without data_file_location field)", action="store_true")
        args = parser.parse_args()
        studyID = args.studyID
        print(f"Checking file integrity for study ID: {studyID}")
        print(f"Checking {'old' if args.old_format else 'new'} format data files")

        client = get_mongo_client(connection_str)
        if args.old_format:
            files = get_old_data_files_from_db(client, db_name)
        else:
            files = get_study_data_files_from_db(client, db_name, studyID)
        succeeded_files = []
        missing_files = []
        wrong_size_files = []
        for file in files:
            bucket_name, key = extrac_bucket_key_from_s3_url(file[DATA_FILE_LOCATION])
            file_name = os.path.basename(key)
            guid = file.get("GUID")
            result = check_s3_file(bucket_name, key)
            if (not result["exist"]):
                missing_files.append((guid, file_name))
            else:
                if result.get("size") != file.get("file_size"):
                    wrong_size_files.append((guid, file_name))
                    print(f"Size mismatch for {file[DATA_FILE_LOCATION]}: Expected {file.get('file_size')}, Got {result.get('size')}")
                else:
                    succeeded_files.append((guid, file_name))
            print(f"{key}, Exists: {result['exist']}, Size: {result.get('size')}")
        write_results_to_file(succeeded_files, missing_files, wrong_size_files, studyID)
    except Exception as e:
        print(f"An error occurred: {e}")
