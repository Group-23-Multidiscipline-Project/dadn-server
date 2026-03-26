# Yolofarm Server

## Prerequisites

- Python 3.10+ (recommended)
- MongoDB reachable from `MONGO_URI`
- HiveMQ broker credentials

## Folder structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── db.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── app_routes.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── device_service.py
│   │   ├── mqtt_client.py
│   │   └── mqtt_service.py
│   └── utils/
│       ├── __init__.py
│       └── device_state_utils.py
├── .env
├── requirements.txt
└── README.md
```

Folder/file comments:

- `app/__init__.py`: Flask app factory, environment validation, CORS, and blueprint registration.
- `app/config.py`: runtime config classes and required environment-variable validation.
- `app/db.py`: MongoDB client/database/collection wiring.
- `app/routes/app_routes.py`: HTTP route handlers (controller layer).
- `app/services/device_service.py`: business logic for device state and event-log responses.
- `app/services/mqtt_client.py`: MQTT client initialization and broker connection lifecycle.
- `app/services/mqtt_service.py`: MQTT-related response payload builders.
- `app/utils/device_state_utils.py`: shared helpers for datetime parsing/formatting and remaining-time calculation.
- `.env`: local runtime environment values (not committed for production secrets).
- `requirements.txt`: Python dependencies for this backend.
- `README.md`: setup, run instructions, API list, and test scenarios.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment variables

Create a `.env` file in the `backend` folder:

```env
APPLICATION_ENV=development
MONGO_URI=mongodb://localhost:27017
MQTT_HOST=your-cluster.s1.eu.hivemq.cloud
MQTT_PORT=8883
HIVEMQ_USERNAME=your_username
HIVEMQ_PASSWORD=your_password

# Optional Mongo TLS settings for Atlas/local SSL troubleshooting
MONGO_TLS_CA_FILE=
MONGO_TLS_ALLOW_INVALID_CERTS=false
MONGO_SERVER_SELECTION_TIMEOUT_MS=5000
```

Required variables validated at startup:

- `MONGO_URI`
- `MQTT_HOST`
- `MQTT_PORT`
- `HIVEMQ_USERNAME`
- `HIVEMQ_PASSWORD`

How to know MongoDB is connected:

- Start app with `flask --app app:create_app run`.
- Check startup log:
  - Success: `MongoDB connected`
  - Failure: `MongoDB not connected: ...`

For `CERTIFICATE_VERIFY_FAILED` with MongoDB Atlas:

- Preferred: set `MONGO_TLS_CA_FILE` to a valid CA bundle path.
- Dev fallback only: set `MONGO_TLS_ALLOW_INVALID_CERTS=true`.

## Run

From the `backend` folder:

```bash
source .venv/bin/activate
flask --app app:create_app run
```

Default server URL: `http://127.0.0.1:5000`

## API endpoints

- `GET /state/<device_id>`
- `GET /event-logs?deviceId=&topic=&state=&action=&limit=`
- `GET /mqtt/sensors/history?deviceId=&limit=`
- `GET /mqtt/irrigation/status?deviceId=`
- `GET /mqtt/system/logs?deviceId=&limit=`

## Use Cases

### UC1: Sensor monitoring

- Device publishes sensor telemetry (`soil_moisture`, `light`) via MQTT topics under `yolofarm/<device_id>/...`.
- Backend receives and normalizes incoming data for processing.

### UC2: Check threshold

- Backend evaluates incoming sensor values against irrigation conditions.
- Typical rule in current flow: `dry soil` and `sufficient light` can trigger watering logic.

### UC3: State change by data-driven

- Backend updates state machine by input data and confirmations: `MONITOR -> WATERING -> RECOVER -> MONITOR`.
- State transition is driven by sensor payload and device confirmation events on topic `yolofarm/<device_id>/sensors/confirm`.

### UC4: Relay On/off

- On trigger conditions, backend publishes control command to irrigation topic (relay on/off).
- Command channel: `yolofarm/<device_id>/control/irrigation`.

### UC5: Log realtime (System, Device Logs)

- Backend stores and exposes real-time logs for system/device events.
- APIs support querying state and logs for monitoring and troubleshooting.

## Architecture

[Architecture DrawIO](https://drive.google.com/file/d/15FUWxON16MQ0kbTjcOKsaFazXyrPCu-i/view?usp=sharing)

### Use case example: `MONITOR -> WATERING -> RECOVER -> MONITOR`

```text
1) Device publishes:
 topic: yolofarm/node_01/sensors/soil_moisture  payload: {"value": 10}
 topic: yolofarm/node_01/sensors/light          payload: {"value": 70}

2) Backend evaluates threshold:
 moisture < threshold AND light > threshold => state: WATERING

3) Backend publishes control command:
 topic: yolofarm/node_01/control/irrigation
 payload: {"action":"start_pump", ...}

4) Device (subscribed to control topic) receives command and turns relay ON.

5) Device publishes confirm when watering done:
 topic: yolofarm/node_01/sensors/confirm
 payload: {"value":"WATERING done"}

6) Backend transitions to RECOVER and publishes recover command.

7) Device publishes confirm when recover done:
 topic: yolofarm/node_01/sensors/confirm
 payload: {"value":"RECOVERING done"}

8) Backend transitions back to MONITOR.
```

## Quick test

```bash
curl "http://127.0.0.1:5000/state/node_01"
curl "http://127.0.0.1:5000/event-logs?deviceId=node_01&limit=10"
```

## MQTT Test Scenarios with Mosquitto

## 0. Prepare

Keep this terminal open (IoT device subscribes to) at all times to monitor irrigation control commands (`control/irrigation`) sent by the backend to the device.

```bash
mosquitto_sub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/control/irrigation" -v
```

## 1. Case 1: Normal Monitoring (Soil Moisture is Sufficient)

**Description:** Soil moisture is sufficient (40%), and light is good (80%).  
The backend stays in `MONITOR` state and does not publish any command.

Open Terminal 2 (IoT device) and publish:

```bash
# Send soil moisture (40%)
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 40}'

# Send light (70%)
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 70}'
```

**Expected result in Terminal 1:** No message appears.

---

## 2. Case 2: Trigger Irrigation (Dry Soil)

**Description:** Soil is dry (`10% < 20%`) and it is bright (`> 60%`).  
The backend transitions to `WATERING` and sends a pump-on command.

In Terminal 2 (IoT device), publish:

```bash
# Send soil moisture (10%)
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 10}'

# Send light (70%)
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 70}'
```

**Expected result in Terminal 1:**  
IoT device receiveed a pump-on command from backend:

`yolofarm/node_01/control/irrigation {"traceId":"...","action":"start_pump","status":"pending_on","shouldIrrigate":true,"durationSeconds":300,...}`

## 3. Case 3: Irrigation In Progress

**Description:** Pump is on, backend ?-minute timer is running.  
The device keeps sending sensor data periodically, but backend ignores it and sends no new command.

In Terminal 2 (IoT device), publish:

```bash
# Soil moisture increases slightly to 12%
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 12}'

# Light remains the same
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 70}'
```

**Expected result in Terminal 1:** No additional command is sent.

---

## 4. Case 4: Irrigation Complete

**Description:** ? minutes (?s) have passed.  
The device sends sensor ticks so backend detects timeout, sends pump-off command, and transitions to `RECOVER`.

> Note: Wait the full ? minutes from Case 2 before running this test.

In Terminal 2 (IoT device), publish:

```bash
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/confirm" -m '{"value": "WATERING done"}'
```

IoT device received in irrigation topic:

```bash
yolofarm/node_01/control/irrigation {"traceId":"0795b416-7997-4344-a110-66e514a3da9c","action":"recover","durationSeconds":20,"timestamp":"2026-03-26T03:35:59.544Z"}
```

IoT device publish after done recovering:

```bash
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/confirm" -m '{"value": "RECOVERING done"}'
```

```bash
# Soil is now wetter (30%)
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 30}'

mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 60}'
```

## 5. Case 5: Return to Monitoring

**Description:** Pump is off, system is in `RECOVER` phase (waiting for sensor stabilization).  
After ? minutes (?s), when new sensor data arrives, backend returns to `MONITOR`.

> Note: Wait ? minutes from Case 4.

In Terminal 2 (IoT device), publish:

```bash
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 35}'

mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 65}'
```

**Expected result in Terminal 1 (IoT device subscribes):**  
No control command is published (normal behavior).  
The loop has now returned to Phase 1 (`MONITOR`).
