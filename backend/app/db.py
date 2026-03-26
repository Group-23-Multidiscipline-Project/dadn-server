import certifi
from os import environ

from pymongo import MongoClient
from .model import (
    DEVICE_STATE_COLLECTION_DEFAULT,
    EVENT_LOG_COLLECTION_DEFAULT,
    SYSTEM_LOG_COLLECTION_DEFAULT,
    ensure_device_state_indexes,
    ensure_event_log_indexes,
    ensure_system_log_indexes,
)

mongo_options = {}
mongo_ca_cert_file = certifi.where()
mongo_options['tlsCAFile'] = mongo_ca_cert_file

mongo_client = MongoClient(
    environ.get('MONGO_URI', 'mongodb://localhost:27017'),
    **mongo_options,
)
mongo_db = mongo_client['yolofarm']

device_state_collection = mongo_db[DEVICE_STATE_COLLECTION_DEFAULT]
event_log_collection = mongo_db[EVENT_LOG_COLLECTION_DEFAULT]
system_log_collection = mongo_db[SYSTEM_LOG_COLLECTION_DEFAULT]

def ping_mongo() -> tuple[bool, str]:
    try:
        mongo_client.admin.command('ping')
        return True, 'MongoDB ping successful'
    except Exception as error:
        return False, str(error)


def ensure_mongo_indexes() -> tuple[bool, str]:
    try:
        ensure_device_state_indexes(device_state_collection)
        ensure_event_log_indexes(event_log_collection)
        ensure_system_log_indexes(system_log_collection)
        return True, 'MongoDB indexes ensured'
    except Exception as error:
        return False, str(error)
