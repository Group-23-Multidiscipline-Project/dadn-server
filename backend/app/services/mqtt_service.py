from datetime import datetime, timezone

# TODO: /mqtt/sensors/history


def get_sensor_history_payload(device_id: str | None, limit: int) -> dict:
    return {'deviceId': device_id, 'limit': limit, 'items': []}

# TODO: /mqtt/irrigation/status


def get_irrigation_status_payload(device_id: str | None) -> dict:
    return {
        'deviceId': device_id,
        'status': 'idle',
        'shouldIrrigate': False,
        'updatedAt': datetime.now(timezone.utc).isoformat(),
    }

# TODO: /mqtt/system/logs


def get_system_logs_payload(device_id: str | None, limit: int) -> dict:
    return {'deviceId': device_id, 'limit': limit, 'items': []}
