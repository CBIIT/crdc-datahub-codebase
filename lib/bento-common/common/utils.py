import base64
from datetime import datetime
import hashlib
import logging
import os
import re
import time
from importlib import import_module
from urllib.parse import urlparse
import shutil
import uuid
from io import BytesIO

from requests import post, get


NO_LOG = 'BENTO_NO_LOG'
LOG_PREFIX = 'BENTO_LOG_FILE_PREFIX'
APP_NAME = 'APP_NAME'

LOG_ENV_VAR = 'BENTO_LOG_LEVEL'
DEFAULT_LOG_LEVEL = 'DEBUG'

log_file = None

def get_logger(name):
    '''
    Return a logger object with given name

    Log entries will be print to standard output as well as a log file
    Log file can be disabled by setting env_var BENTO_NO_LOG to any value

    Log level is specified in env_var BENTO_LOG_LEVEL or INFO if not specified

    Log file will be put in folder specified in env_var BENTO_LOG_FOLDER
      or 'tmp' if not specified
      log folder will be created if not already exist
    Log file will have name in format "<prefix>-<timestamp>.log"
    Log file prefix is specified in env_var BENTO_LOG_FILE_PREFIX
      or 'bento' if not specified

    :param name: logger name
    :return:
    '''
    FILE_HANDLER = "file-handler"
    STREAM_HANDLER = "stream-handler"
    log = logging.getLogger(name)
    log_level = os.environ.get(LOG_ENV_VAR, DEFAULT_LOG_LEVEL)
    log.setLevel(log_level)

    std_handler = logging.StreamHandler()
    std_handler.name = STREAM_HANDLER
    std_handler.setLevel('INFO')
    app_name = os.environ.get(APP_NAME, '-')
    formatter = logging.Formatter(f'<14>1 %(asctime)s.%(msecs)03dZ - {app_name} %(process)d - - %(levelname)s: (%(name)s) %(message)s',
                                  "%Y-%m-%dT%H:%M:%S")
    formatter.converter = time.gmtime
    std_handler.setFormatter(formatter)
    add_handler(log, std_handler)

    no_log_file = os.environ.get(NO_LOG)
    if not no_log_file:
        log_file = get_log_file()
        file_handler = logging.FileHandler(log_file)
        file_handler.name = FILE_HANDLER
        file_handler.setFormatter(formatter)
        add_handler(log, file_handler)
    return log

def add_handler(logger, handler):
    '''
    Add handler to logger, but will not add again if the logger has a handler with the same name
    :param logger:
    :param handler:
    :return:
    '''
    for han in logger.handlers:
        if han.name == handler.name:
            return

    logger.addHandler(handler)

def get_log_file():
    '''
    Returns log file path for a given logger

    :return: log file path
    '''
    global log_file
    if log_file:
        return log_file

    no_log_file = os.environ.get(NO_LOG)
    if not no_log_file:
        log_folder = os.environ.get('BENTO_LOG_FOLDER', 'tmp')
        # Create log folder if not exist
        if not os.path.isdir(log_folder):
            os.makedirs(log_folder, exist_ok=True)

        log_file_prefix = os.environ.get(LOG_PREFIX, 'bento')
        log_file = os.path.join(log_folder, f'{log_file_prefix}-{get_time_stamp()}.log')
        return log_file
    else:
        return None


def get_time_stamp():
    return datetime.now().strftime(TIMESTAMP_FORMAT)
    #return datetime.now().strftime(DATETIME_FORMAT)

def remove_leading_slashes(uri):
    '''
    Removes leading slashes from a uri or path
    :param uri: URI or path
    :return: URI or path with leading slashes removed
    '''
    if uri.startswith('/'):
        return re.sub('^/+', '', uri)
    else:
        return uri

def removeTrailingSlash(uri):
    if uri.endswith('/'):
        return re.sub('/+$', '', uri)
    else:
        return uri

def get_host(uri):
    parts = urlparse(uri)
    return parts.hostname

def check_schema_files(schemas, log):
    if not schemas:
        log.error('Please specify schema file(s) with -s or --schema argument')
        return False

    for schema_file in schemas:
        if not os.path.isfile(schema_file):
            log.error('{} is not a file'.format(schema_file))
            return False
    return True


def send_slack_message(url, messaage, log):
    if url:
        headers = {"Content-type": "application/json"}
        result = post(url, json=messaage, headers=headers)
        if not result or result.status_code != 200:
            log.error('Sending Slack messages failed!')
            if result:
                log.error(result.content)
    else:
        log.error('Empty Slack URL given!')

def get_hash(file_name, hash_obj):
    with open(file_name, 'rb') as afile:
        return get_stream_hash(afile, hash_obj)


def get_stream_hash(stream, hash_obj):
    '''
    Get Hash from a stream, can be a local file or a stream returned by requests

    :param stream: input stream
    :param hash_obj: hash object e.g., MD5, Sha512
    :return:
    '''

    buf = stream.read(BLOCK_SIZE)
    while len(buf) > 0:
        hash_obj.update(buf)
        buf = stream.read(BLOCK_SIZE)
    return hash_obj


def get_stream_md5(stream):
    '''
    Get MD5 of a stream content as a hex encoded string
    :param stream:
    :return: hex encoded MD5
    '''
    hash_obj = hashlib.md5()
    hash = get_stream_hash(stream, hash_obj)
    return hash.hexdigest()


def get_string_md5(text):
    stream = BytesIO(bytes(text, 'utf-8'))
    return get_stream_md5(stream)

def get_md5_hex_n_base64(file_name):
    '''
    Get MD5 of a file's content as a hex encoded string and base64 encoded string
    :param file_name:
    :return: hex encoded MD5
    '''
    hash_obj = hashlib.md5()
    hash = get_hash(file_name, hash_obj)
    return {
              'hex': hash.hexdigest(),
              'base64': base64.b64encode(hash.digest()).decode()
           }


def get_md5(file_name):
    '''
    Get MD5 of a file's content as a hex encoded string
    :param file_name:
    :return: hex encoded MD5
    '''
    return get_md5_hex_n_base64(file_name)['hex']

def get_md5_base64(file_name):
    '''
    Get MD5 of a file's content as a base64 encoded string
    :param file_name:
    :return: base64 encoded MD5
    '''
    return get_md5_hex_n_base64(file_name)['base64']


def get_sha512(file_name):
    hash_obj = hashlib.sha512()
    return get_hash(file_name, hash_obj).hexdigest()


def get_uuid(domain, node_type, signature):
    """Generate V5 UUID for a node in domain
    Arguments:
        domain - a string represents a domain, e.g., caninecommons.cancer.gov
        node_type - a string represents type of a node, e.g. case, study, file etc.
        signature - a string that can uniquely identify a node within it's type, e.g. case_id, clinical_study_designation etc.
                    or a long string with all properties and values concat together if no id available

    """
    base_uuid = uuid.uuid5(uuid.NAMESPACE_URL, domain)
    type_uuid = uuid.uuid5(base_uuid, node_type)
    node_uuid = uuid.uuid5(type_uuid, signature)
    return str(node_uuid)

def format_bytes(num):
    '''
    Return a properly formatted size string, with MB, GB, TB etc.
    :param num: size in bytes
    :return: properly formatted size string, with MB, GB, TB etc.
    '''
    # TB
    TB = 1_000_000_000_000
    GB = 1_000_000_000
    MB = 1_000_000
    KB = 1_000
    if num > TB:
        return f'{num / TB:,.2f} TB'
    elif num > GB:
        return f'{num / GB:,.2f} GB'
    elif num > MB:
        return f'{num / MB:,.2f} MB'
    elif num > KB:
        return f'{num / KB:,.2f} KB'
    else:
        return f'{num} Bytes'

def combined_dict_counters(counter, other):
    """
    Combine second dict into first, if same key exists in first dict, then count will be the sum of the two
    Both dicts must be in { key1: count1, key2: count2 } form, countx must be an integer!

    :return: None, combined dict is stored in first dict
    """
    for key, value in other.items():
        if key in counter:
            counter[key] += value
        else:
            counter[key] = value

def get_file_format(file_name):
    return os.path.splitext(file_name)[1].split('.')[1].lower()

def stream_download(url, local_file):
    with get(url, stream=True) as r:
        if not r.ok:
            raise Exception(f'Http Error Code {r.status_code} for file {url}')

        with open(local_file, 'wb') as file:
            shutil.copyfileobj(r.raw, file)

def load_plugin(module_name, class_name, params):
    module = import_module(module_name)
    class_ = getattr(module, class_name)
    if isinstance(params, dict):
        plugin = class_(**params)
    else:
        plugin = class_()
    return plugin


def parse_date(date_string):
    for date_format in DATE_FORMATS:
        try:
            formatted_date = datetime.strptime(date_string, date_format)
            return formatted_date
        except ValueError:
            pass
    raise ValueError("Unable to parse date from string: {}".format(date_string))


def date_to_string(date):
    return date.strftime(DEFAULT_DATE_FORMAT)


def reformat_date(date_string):
    try:
        date = parse_date(date_string)
        return date_to_string(date)
    except ValueError:
        return date_string


# Print all configurations, but hide passwords
def print_config(logger, config):
    PASSWORD_FIELDS = [
        'neo4j_password'
    ]
    if not isinstance(config, dict):
        config = config.__dict__

    for key, value in config.items():
        if key in PASSWORD_FIELDS:
            value = '*' * 8
        logger.info(f'{key}: "{value}"')



NODES_CREATED = 'nodes_created'
RELATIONSHIP_CREATED = 'relationship_created'
NODES_DELETED = 'nodes_deleted'
RELATIONSHIP_DELETED = 'relationship_deleted'
NODES_UPDATED = 'nodes_updated'
BLOCK_SIZE = 65536
DEFAULT_DATE_FORMAT = '%Y-%m-%d'
DATE_FORMATS = [
    '%Y-%m-%d',     # YYYY-MM-DD
    '%Y-%-m-%-d',   # YYYY-[M]M-[D]D
    '%m/%d/%Y',     # MM/DD/YYYY
    '%-m/%-d/%Y',   # [M]M/[D]D/YYYY
    '%Y/%m/%d',     # YYYY/MM/DD
    '%Y/%-m/%-d',   # YYYY/[M]M/[D]D
    '%Y%m%d',       # YYYYMMDD
    '%m-%d-%Y',     # MM-DD-YYYY
    '%-m-%-d-%Y',   # [M]M-[D]D-YYYY
    '%b %d %Y',     # MMM DD YYYY
    '%b %-d %Y',    # MMM [D]D YYYY
    '%d %b %Y',     # DD MMM YYYY
    '%-d %b %Y'     # [D]D MMM YYYY
]
DATETIME_FORMAT = '%Y%m%d-%H%M%S'
TIMESTAMP_FORMAT = '%Y-%m-%dT%H%M%S'
RELATIONSHIP_TYPE = 'relationship_type'
MULTIPLIER = 'Mul'
DEFAULT_MULTIPLIER = 'many_to_one'
ONE_TO_ONE = 'one_to_one'
UUID = 'uuid'
NEW_MODE = 'new'
UPSERT_MODE = 'upsert'
DELETE_MODE = 'delete'
MISSING_PARENT = 'missing_parent'
NODE_LOADED = 'node_loaded'

