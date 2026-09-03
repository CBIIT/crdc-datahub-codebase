import csv
import os
import sys
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError
from pymongo import MongoClient

from dotenv import load_dotenv
load_dotenv()

RELEASE_COLLECTION = "release"
STUDY_ID = "studyID"
DATA_FILE_LOCATION = "dataFileLocation"

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
    total_files_checked = len(succeeded_files) + len(missing_files) + len(wrong_size_files)
    total_files_failed = len(missing_files) + len(wrong_size_files)
    headers = ["Study ID", "GUID", "File Name", "Location", "Status"]
    curent_date_time_str = current_date_time_str()
    if total_files_failed > 0:
        with open(f"tmp/{curent_date_time_str}_{total_files_failed}_of_{total_files_checked}_file_failed.csv", "w") as f:
            csv_writer = csv.writer(f)
            csv_writer.writerow(headers)
            csv_writer.writerows(missing_files)
            csv_writer.writerows(wrong_size_files)
            # f.write(f"Study ID: {studyID}\n")
            # f.write(f"Total Files Checked: {total_files_checked}\n")
            # f.write(f"\nMissing Files: {len(missing_files)}\n")
            # for file in missing_files:
            #     csv_writer.writerow([file[0], file[1], file[2], "Missing"])
            # for file in wrong_size_files:
            #     csv_writer.writerow([file[0], file[1], file[2], "Wrong Size"])

    if len(succeeded_files) != 0:
        with open(f"tmp/{curent_date_time_str}_{len(succeeded_files)}_of_{total_files_checked}_file_succeeded.csv", "w") as f:
            csv_writer = csv.writer(f)
            csv_writer.writerow(headers)
            csv_writer.writerows(succeeded_files)
            # f.write(f"Study ID: {studyID}\n")
            # f.write(f"Total Files Checked: {total_files_checked}\n")
            # f.write(f"Succeeded Files: {len(succeeded_files)}\n")
            # for file in succeeded_files:
            #     csv_writer.writerow([file[0], file[1], file[2], "Succeeded"])

def current_date_time_str():
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%dT%H-%M-%S")

def read_files_from_dcf_manifest(file_path):
    if not file_path or not os.path.isfile(file_path):
        print(f'{file_path} is not a file')

    with open(file_path, "r") as f:
        files = []
        tsv_reader = csv.DictReader(f, delimiter="\t")
        for row in tsv_reader:
            url = row['urls']
            if file_in_target_buckets(url, [BUCKET_NAME]):
                files.append({
                    'GUID': row['guid'],
                    DATA_FILE_LOCATION: url,
                    "file_size": int(float(row['size']))
                })
            else:
                print(f"Skipping file {url} as it is not in the target bucket {BUCKET_NAME}")
        return files

def file_in_target_buckets(s3_url, target_buckets):
    bucket_name, _ = extrac_bucket_key_from_s3_url(s3_url)
    return bucket_name in target_buckets

def validate_files(files: list):
    succeeded_files = []
    missing_files = []
    wrong_size_files = []
    for file in files:
        bucket_name, key = extrac_bucket_key_from_s3_url(file[DATA_FILE_LOCATION])
        file_name = os.path.basename(key)
        guid = file.get("GUID")
        study_id = get_study_id_from_s3_url(file[DATA_FILE_LOCATION])
        result = check_s3_file(bucket_name, key)
        if (not result["exist"]):
            missing_files.append((study_id, guid, file_name, key, "Missing"))
        else:
            if result.get("size") != file.get("file_size"):
                wrong_size_files.append((study_id, guid, file_name, key, "Wrong Size"))
                print(
                    f"Size mismatch for {file[DATA_FILE_LOCATION]}: Expected {file.get('file_size')}, Got {result.get('size')}")
            else:
                succeeded_files.append((study_id, guid, file_name, key, "Succeeded"))
        print(f"{key}, Exists: {result['exist']}, Size: {result.get('size')}")

    return succeeded_files, missing_files, wrong_size_files

def main():
    try:
        study_id, files = get_studyid_files_list()

        succeeded_files, missing_files, wrong_size_files = validate_files(files)
        write_results_to_file(succeeded_files, missing_files, wrong_size_files, study_id)
    except Exception as e:
        print(f"An error occurred: {e}")

def get_studyid_files_list():
    import argparse
    connection_str = os.environ.get("MONGO_CONNECTION_STRING")
    db_name = os.environ.get("MONGO_DB_NAME")

    parser = argparse.ArgumentParser()
    parser.add_argument("--study-id", help="Study ID to check file integrity for")
    parser.add_argument("--old-format", help="Validate old format data files (without data_file_location field)",
                        action="store_true")
    parser.add_argument("--dcf-manifest", help="Validate DCF Manifest file")
    args = parser.parse_args()

    study_id = args.study_id
    client = get_mongo_client(connection_str)
    if args.dcf_manifest:
        files = read_files_from_dcf_manifest(args.dcf_manifest)
        if len(files) > 0:
            study_id = get_study_id_from_s3_url(files[0][DATA_FILE_LOCATION])
    elif args.old_format:
        files = get_old_data_files_from_db(client, db_name)
    else:
        files = get_study_data_files_from_db(client, db_name, study_id)

    print(f"Checking file integrity for study ID: {study_id}")
    print(f"Checking {'old' if args.old_format else 'new'} format data files")

    return study_id, files

def get_study_id_from_s3_url(s3_url):
    if not s3_url.startswith("s3://"):
        return None
    stripped = s3_url.replace('s3://', '')
    parts = stripped.split("/")
    if len(parts) < 2:
        return None
    return parts[1]


if __name__ == "__main__":
    main()