from flask import Blueprint, jsonify, request
from ..services.device_service import (
    get_device_state_snapshot,
    get_event_logs_history,
)
from ..services.mqtt_service import (
    get_irrigation_status_payload,
    get_sensor_history_payload,
    get_system_logs_payload
)

device_bp = Blueprint('device', __name__)


@device_bp.get('/state/<device_id>')
def get_device_state(device_id: str):
    payload = get_device_state_snapshot(device_id)
    return jsonify(payload)


@device_bp.get('/event-logs')
def get_event_logs():
    filters = {
        'deviceId': request.args.get('deviceId'),
        'topic': request.args.get('topic'),
        'state': request.args.get('state'),
        'action': request.args.get('action'),
        'limit': request.args.get('limit', default=20, type=int),
    }
    payload = get_event_logs_history(filters)
    return jsonify(payload)

# TODO:
@device_bp.get('/mqtt/sensors/history')
def get_sensor_history():
    payload = get_sensor_history_payload(
        request.args.get('deviceId'),
        request.args.get('limit', default=20, type=int),
    )
    return jsonify(payload)

# TODO:
@device_bp.get('/mqtt/irrigation/status')
def get_irrigation_status():
    payload = get_irrigation_status_payload(request.args.get('deviceId'))
    return jsonify(payload)

# TODO:
@device_bp.get('/mqtt/system/logs')
def get_system_logs():
    payload = get_system_logs_payload(
        request.args.get('deviceId'),
        request.args.get('limit', default=20, type=int),
    )
    return jsonify(payload)
