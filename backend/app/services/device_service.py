from datetime import datetime, timezone

from pymongo import DESCENDING
from ..db import device_state_collection, event_log_collection
from ..utils.device_state_utils import (
    calculate_remaining_seconds,
    to_iso,
)


def get_device_state_snapshot(device_id: str) -> dict:
    state_doc = device_state_collection.find_one({'deviceId': device_id})
    latest_log = event_log_collection.find_one(
        {'deviceId': device_id},
        sort=[('timestamp', DESCENDING)],
    )

    if not state_doc:
        return {
            'deviceId': device_id,
            'exists': False,
            'state': 'MONITOR',
            'action': 'none',
            'remainingSeconds': 0,
            'stateStartedAt': None,
            'wateringEndsAt': None,
            'recoverEndsAt': None,
            'latestEvent': {
                'state': latest_log.get('state'),
                'action': latest_log.get('action'),
                'timestamp': to_iso(latest_log.get('timestamp')),
            }
            if latest_log
            else None,
        }

    now = datetime.now(timezone.utc)
    remaining_seconds = calculate_remaining_seconds(state_doc, now)

    return {
        'deviceId': state_doc.get('deviceId', device_id),
        'exists': True,
        'state': state_doc.get('state', 'MONITOR'),
        'action': latest_log.get('action') if latest_log else 'none',
        'remainingSeconds': remaining_seconds,
        'stateStartedAt': to_iso(state_doc.get('stateStartedAt')),
        'wateringEndsAt': to_iso(state_doc.get('wateringEndsAt')),
        'recoverEndsAt': to_iso(state_doc.get('recoverEndsAt')),
        'latestEvent': {
            'state': latest_log.get('state'),
            'action': latest_log.get('action'),
            'timestamp': to_iso(latest_log.get('timestamp')),
        }
        if latest_log
        else None,
    }

# TODO: /event-logs


def get_event_logs_history(filters: dict) -> dict:
    return {
        'filters': filters,
        'items': [],
    }


def get_sensor_history_payload(device_id: str | None, limit: int) -> dict:
    return {'deviceId': device_id, 'limit': limit, 'items': []}


def get_irrigation_status_payload(device_id: str | None) -> dict:
    return {
        'deviceId': device_id,
        'status': 'idle',
        'shouldIrrigate': False,
        'updatedAt': datetime.now(timezone.utc).isoformat(),
    }


def get_system_logs_payload(device_id: str | None, limit: int) -> dict:
    return {'deviceId': device_id, 'limit': limit, 'items': []}
