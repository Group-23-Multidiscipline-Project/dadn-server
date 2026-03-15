# Tài liệu API: Event Chaining, MQTT và Dashboard

Tài liệu này được cập nhật theo đúng source code backend hiện tại. Phạm vi gồm:

- REST API cho state machine.
- MQTT topics giữa backend và thiết bị.
- WebSocket realtime cho dashboard.
- Các API đọc dữ liệu lịch sử dành cho dashboard.

## 1. Tổng quan state machine

Thiết bị chạy theo 3 trạng thái:

- **MONITOR**: giám sát bình thường.
- **WATERING**: đang tưới, bơm bật.
- **RECOVER**: bơm đã tắt, chờ đất ổn định trước khi quay lại MONITOR.

### Rule chuyển trạng thái hiện tại trong code

- `MONITOR -> WATERING` khi `humidity < 20` và `light > 500`.
- `WATERING -> RECOVER` sau `300` giây, hoặc khi backend nhận confirm sau khi timer đã hết.
- `RECOVER -> MONITOR` sau `120` giây.

### Action hiện có

- `none`
- `start_pump`
- `stop_pump`

## 2. REST API chính

### 2.4 Lấy trạng thái hiện tại của thiết bị

- **Method:** `GET`
- **URL:** `/state/:deviceId`

**Response**

```json
{
  "deviceId": "node_01",
  "exists": true,
  "state": "WATERING",
  "action": "start_pump",
  "remainingSeconds": 295,
  "stateStartedAt": "2026-03-14T10:14:32.217Z",
  "wateringEndsAt": "2026-03-14T10:19:32.217Z",
  "recoverEndsAt": null,
  "latestEvent": {
    "state": "WATERING",
    "action": "start_pump",
    "timestamp": "2026-03-14T10:14:32.217Z"
  }
}
```

### Ý nghĩa field cho UI

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `exists` | `boolean` | `false` nếu thiết bị chưa từng có state trong DB. |
| `state` | `string` | Một trong `MONITOR`, `WATERING`, `RECOVER`. |
| `action` | `string` | Action gần nhất: `none`, `start_pump`, `stop_pump`. |
| `remainingSeconds` | `number` | Số giây còn lại của state hiện tại, dùng cho countdown. |
| `stateStartedAt` | `ISO Date \| null` | Thời điểm bắt đầu state hiện tại. |
| `wateringEndsAt` | `ISO Date \| null` | Chỉ có giá trị khi đang WATERING. |
| `recoverEndsAt` | `ISO Date \| null` | Chỉ có giá trị khi đang RECOVER. |
| `latestEvent` | `object \| null` | Event state mới nhất đã lưu. |

## 4. WebSocket realtime cho dashboard

- **Namespace:** `/events`
- **CORS:** `*`

### Payload chuẩn

```json
{
  "deviceId": "node_01",
  "state": "WATERING",
  "action": "start_pump",
  "durationSeconds": 300,
  "timestamp": "2026-03-14T10:14:32.217Z"
}
```

### Event names hiện có

- `state_change`: luôn emit mỗi khi `publishState()` được gọi.
- `event_update`: emit thêm khi `action = start_pump`.
- `pump_stopped`: emit thêm khi `action = stop_pump`.
- `monitoring`: emit thêm khi `state = MONITOR`.

### Gợi ý dùng cho dashboard

1. Khi mở trang, gọi `GET /state/:deviceId` để hydrate state ban đầu.
2. Dùng `remainingSeconds` để bắt đầu countdown ở client.
3. Kết nối WebSocket namespace `/events`.
4. Lắng nghe tối thiểu `state_change`; nếu cần UI riêng cho từng hành động thì nghe thêm `event_update`, `pump_stopped`, `monitoring`.

## 5. API dữ liệu cho dashboard

### 5.1 Lịch sử cảm biến

- **Method:** `GET`
- **URL:** `/mqtt/sensors/history`

**Query params**

- `nodeId`: lọc theo node.
- `sensor`: lọc theo sensor key (`soil_moisture` cho dữ liệu `humidity`, hoặc `light`).
- `limit`: mặc định `200`, tối đa `1000`.

**Ví dụ**

```text
/mqtt/sensors/history?nodeId=node_01&sensor=soil_moisture&limit=50
/mqtt/sensors/history?nodeId=node_01&sensor=light&limit=50
```

**Response sample**

```json
[
  {
    "topic": "yolofarm/node_01/sensors/soil_moisture",
    "value": 40,
    "humidity": 40,
    "timestamp": "2026-03-14T10:14:30.945Z",
    "meta": {
      "farmId": "yolofarm",
      "nodeId": "node_01",
      "sourceType": "sensor",
      "sensor": "humidity"
    }
  },
  {
    "topic": "yolofarm/node_01/sensors/light",
    "value": 600,
    "light": 600,
    "timestamp": "2026-03-14T10:14:30.963Z",
    "meta": {
      "farmId": "yolofarm",
      "nodeId": "node_01",
      "sourceType": "sensor",
      "sensor": "light"
    }
  }
]
```

### 5.2 Trạng thái tưới / ACK bơm

- **Method:** `GET`
- **URL:** `/mqtt/irrigation/status`

**Query params**

- `nodeId`: tùy chọn. Nếu có, API trả về bản ghi mới nhất của node đó.
- `limit`: mặc định `100` khi query tất cả node.

**Response sample khi có `nodeId`**

```json
{
  "topic": "yolofarm/node_01/status/irrigation",
  "nodeId": "node_01",
  "direction": "status",
  "action": "start_pump",
  "status": "pump_on",
  "shouldIrrigate": true,
  "durationSeconds": 300,
  "timestamp": "2026-03-14T10:14:33.000Z",
  "meta": {
    "nodeId": "node_01",
    "direction": "status"
  }
}
```

**Response behavior khi không có `nodeId`**

- Trả về danh sách bản ghi mới nhất theo từng node.

### 5.3 System logs

- **Method:** `GET`
- **URL:** `/system/logs`

**Query params**

- `deviceId`: lọc theo thiết bị.
- `eventType`: ví dụ `SENSOR_RECEIVED`, `CHAIN_STATE_CHANGED`, `SENSOR_STORED`, `FRONTEND_DISPLAYED`.
- `traceId`: lọc theo trace để gom một luồng xử lý.
- `limit`: mặc định `200`, tối đa `1000`.

**Ví dụ**

```text
/system/logs?deviceId=node_01&limit=50
/system/logs?deviceId=node_01&eventType=CHAIN_STATE_CHANGED&limit=50
```

**Response sample**

```json
[
  {
    "_id": "69b532dde07a23c2b8be2fde",
    "eventId": "8c3528b7-1056-4b81-b355-bdf032579889",
    "traceId": "0c8feb18-42b3-4c38-97ab-21c3d264ee79",
    "eventType": "SENSOR_RECEIVED",
    "deviceId": "node_01",
    "source": "EventChainingService.processSensorData",
    "occurredAt": "2026-03-14T10:05:17.984Z",
    "data": {
      "humidity": 40,
      "light": 600,
      "deviceId": "node_01",
      "topic": "yolofarm/node_01/sensors/light"
    },
    "createdAt": "2026-03-14T10:05:17.992Z"
  }
]
```

### 5.4 Event logs (state machine)

- **Method:** `GET`
- **URL:** `/event-logs`

**Query params**

- `deviceId`: lọc theo thiết bị.
- `topic`: lọc theo MQTT topic.
- `state`: một trong `MONITOR`, `WATERING`, `RECOVER`.
- `action`: ví dụ `none`, `start_pump`, `stop_pump`.
- `limit`: mặc định `200`, tối đa `1000`.

**Ví dụ**

```text
/event-logs?deviceId=node_01&limit=20
/event-logs?deviceId=node_01&state=WATERING&action=start_pump&limit=20
```

**Response sample**

```json
[
  {
    "_id": "69b532dee07a23c2b8be2fe3",
    "deviceId": "node_01",
    "topic": "yolofarm/node_01/sensors/light",
    "humidity": 40,
    "light": 600,
    "state": "MONITOR",
    "action": "none",
    "timestamp": "2026-03-14T10:05:17.984Z",
    "metadata": {
      "traceId": "0c8feb18-42b3-4c38-97ab-21c3d264ee79",
      "trigger": "sensor-data",
      "topic": "yolofarm/node_01/sensors/light",
      "durationSeconds": 0
    },
    "createdAt": "2026-03-14T10:05:18.136Z"
  },
  {
    "_id": "69b532e6e07a23c2b8be3020",
    "deviceId": "node_01",
    "state": "RECOVER",
    "action": "stop_pump",
    "timestamp": "2026-03-14T10:05:26.581Z",
    "metadata": {
      "traceId": "3f31f740-8cd3-4739-9308-9a5699a56eac",
      "trigger": "sensor-data/confirm",
      "confirmation": "WATERING done",
      "durationSeconds": 2
    },
    "createdAt": "2026-03-14T10:05:26.705Z"
  }
]
```

## 6. Swagger

Swagger UI được mount tại:

```text
http://localhost:3000/api
```

## 7. Dashboard

1. Initial load: gọi `GET /state/:deviceId`.
2. Realtime state: subscribe WebSocket `/events`, event `state_change`.
3. Chart sensor: gọi `/mqtt/sensors/history` theo `nodeId`, `sensor`.
4. Bảng trạng thái bơm: gọi `/mqtt/irrigation/status`.
5. Debug panel: gọi `/system/logs`.
6. Lịch sử state machine: gọi `/event-logs`.
