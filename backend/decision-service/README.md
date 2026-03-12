# Decision Service (Python + scikit-fuzzy)

Service này subscribe dữ liệu sensor + nguy cơ bệnh qua MQTT, sau đó dùng fuzzy logic để quyết định có tưới hay không và publish lệnh điều khiển về Yolo:Bit.

## Input topics

- `yolofarm/+/sensors/soil_moisture`
- `yolofarm/+/sensors/air_humidity`
- `yolofarm/+/ai/disease_risk`

## Output topics

- `yolofarm/{node_id}/control/irrigation`
- `yolofarm/{node_id}/status/irrigation`

## Payload examples

### Sensor (độ ẩm đất)

```json
{"value": 40}
```

### AI disease risk

```json
{"risk": 0.72}
```

### Published decision

```json
{
  "action": "WATER_ON",
  "should_irrigate": true,
  "duration_sec": 34,
  "reason": "fuzzy_decision_with_disease_risk",
  "decision_score": 68.25,
  "disease_risk": 0.72,
  "soil_moisture": 28.1,
  "air_humidity": 74.0,
  "adjusted_threshold": 45.8,
  "timestamp": "2026-03-12T08:10:00.000000+00:00"
}
```

## Run

```bash
cd decision-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
MQTT_URL=mqtt://localhost:1883 python service.py
```
