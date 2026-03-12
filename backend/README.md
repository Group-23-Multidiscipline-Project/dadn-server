# Smart Agri Backend

1. **Data Processing Service (NestJS)**
   - Subscribe MQTT bằng wildcard `#` (nhận tất cả topic hiện có ngay khi backend start).
   - Validate payload đến theo rule từng topic.
   - Lưu MongoDB theo schema time-series, có timestamp để tối ưu truy vấn theo thời gian.

2. **Decision Service (Python + scikit-fuzzy)**
   - Subscribe độ ẩm đất, độ ẩm không khí và disease risk từ AI model.
   - Suy luận fuzzy để quyết định tưới.
   - Publish lệnh điều khiển về topic irrigation của Yolo:Bit.

3. **API Gateway Service (NestJS)**
   - Cung cấp REST API cho dashboard lấy lịch sử sensor, trạng thái tưới, nhật ký hệ thống.

## 1) Yêu cầu môi trường

- Node.js 20+
- pnpm 8+
- MongoDB 6+
- MQTT broker (Mosquitto/EMQX)
- Python 3.11+ (cho decision service)

Tải `pnpm`

```bash
npm i -g pnpm
```

## 2) Biến môi trường

```bash
cp -R .env.example .env
```

Chỉnh sửa các biến môi trường cho phù hợp

## 3) Chạy Backend

```bash
pnpm install
pnpm run start:dev
```

Backend sẽ:

- Mở HTTP API ở cổng `PORT`.
- Kết nối MQTT broker theo `MQTT_URL`.
- Subscribe toàn bộ topic thông qua pattern `#`.

### 4) Chạy MQTT broker.

- Homebrew (Mac): `brew services start mosquitto`

- Linux: `sudo systemctl start mosquitto`

- Rồi chạy:

```bash
mosquitto -c ./mosquitto/mosquitto.conf
```

## 5) MQTT ingest format

### Ví dụ sensor payload

Topic:
`yolofarm/node_01/sensors/soil_moisture`

Payload:

```json
{"value": 40}
```

Backend sẽ validate `value` là số và lưu MongoDB vào collection time-series `sensor_readings`.

## 6) REST API cho Dashboard

Vào `localhost:3000/api` để xem documentation.

- `GET /api/sensors/history?nodeId=node_01&sensor=soil_moisture&limit=200`
- `GET /api/irrigation/status?nodeId=node_01`
- `GET /api/system/logs?level=warn&limit=100`

## 6) Decision Service (Python)

Tham khảo hướng dẫn chi tiết tại thư mục `decision-service`.

```bash
cd decision-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
MQTT_URL=mqtt://localhost:1883 python service.py
```

Service sẽ publish decision lên:

- `yolofarm/{node_id}/control/irrigation`
- `yolofarm/{node_id}/status/irrigation`
