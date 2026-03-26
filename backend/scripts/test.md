Optimizing tool selection...# MQTT Test Scenarios with Mosquitto - Event Chaining IoT

## 0. Prepare

Keep this terminal open at all times to monitor irrigation control commands (`control/irrigation`) sent by the backend to the device.

```bash
mosquitto_sub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/control/irrigation" -v
```

## 1. Case 1: Normal Monitoring (Soil Moisture is Sufficient)

**Description:** Soil moisture is sufficient (40%), and light is good (80%).  
The backend stays in `MONITOR` state and does not publish any command.

Open Terminal 2 and publish:

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

In Terminal 2, publish:

```bash

# Send soil moisture (10%)

mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 10}'

# Send light (70%)

mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 70}'
```

**Expected result in Terminal 1:**  
You receive a pump-on command from backend:

`yolofarm/node_01/control/irrigation {"traceId":"...","action":"start_pump","status":"pending_on","shouldIrrigate":true,"durationSeconds":300,...}`

## 3. Case 3: Irrigation In Progress

**Description:** Pump is on, backend 5-minute timer is running.  
The device keeps sending sensor data periodically, but backend ignores it and sends no new command.

In Terminal 2, publish:

```bash
# Soil moisture increases slightly to 12%

mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 12}'

# Light remains the same

mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 70}'
```

**Expected result in Terminal 1:** No additional command is sent.

---

## 4. Case 4: Irrigation Complete

**Description:** 5 minutes (300s) have passed.  
The device sends sensor ticks so backend detects timeout, sends pump-off command, and transitions to `RECOVER`.

> Note: Wait the full 5 minutes from Case 2 before running this test.

In Terminal 2, publish:

```bash
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/confirm" -m '{"value": "WATERING done"}'
```

Device received in irrigation topic:

```bash
yolofarm/node_01/control/irrigation {"traceId":"0795b416-7997-4344-a110-66e514a3da9c","action":"recover","durationSeconds":20,"timestamp":"2026-03-26T03:35:59.544Z"}
```

Device publish after done recovering:

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
After 2 minutes (120s), when new sensor data arrives, backend returns to `MONITOR`.

> Note: Wait 2 minutes from Case 4.

In Terminal 2, publish:

```bash
mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/soil_moisture" -m '{"value": 35}'

mosquitto_pub -h 370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud -p 8883 -u admin -P Yolofarm23 -t "yolofarm/node_01/sensors/light" -m '{"value": 65}'
```

**Expected result in Terminal 1:**  
No control command is published (normal behavior).  
The loop has now returned to Phase 1 (`MONITOR`).
