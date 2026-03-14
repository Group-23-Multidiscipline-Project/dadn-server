# Event Chaining Flow Documentation

## Tổng quan Event Chaining

Event chaining là **sequential decision-making process** với 3 trạng thái tuần tự bắt buộc: **MONITOR → WATERING → RECOVER**, được thiết kế để xử lý sensor recovery time trong smart agriculture.

- MONITOR: nhận sensor data định kỳ, kiểm tra điều kiện kích hoạt tưới.
- WATERING: bơm chạy 5 phút.
- RECOVER: chờ 2 phút để sensor ổn định trước khi quay lại MONITOR.

## Flow chi tiết từ Hardware → BE → FE

```mermaid
sequenceDiagram
    participant H as Yolo:Bit Hardware
    participant BE as NestJS Backend
    participant DB as Database
    participant FE as Web Dashboard

    loop Every 10s (MONITOR state)
        H->>BE: POST /sensor-data\n{humidity, light, deviceId}
        BE->>DB: Lưu raw data + timestamp
    end

    BE->>BE: Check last state từ DB
    alt humidity < 20% && light > 500 && state == MONITOR
        BE->>H: 200 OK {state: "WATERING", action: "start_pump", duration: 300}
        H->>H: Bật relay bơm nước (P0 HIGH)
        BE->>DB: Lưu {state: "WATERING", action: "start_pump"}
        BE->>FE: WebSocket emit "event_update"
    end

    Note over H,BE: Pump runs 5 phút

    alt state == WATERING (sau 5p)
        H->>BE: POST /sensor-data/confirm {state: "WATERING done", deviceId}
        BE->>H: {state: "RECOVER", action: "stop_pump", duration: 120}
        H->>H: Tắt relay (P0 LOW)
        BE->>DB: Lưu {state: "RECOVER", action: "stop_pump"}
        BE->>FE: WebSocket emit "pump_stopped"
    end

    Note over H,BE: Recover 2 phút (sensor stable)

    alt state == RECOVER (sau 2p)
        H->>BE: POST /sensor-data {humidity, light, deviceId}
        BE->>H: {state: "MONITOR", action: "none"}
        BE->>DB: Lưu {state: "MONITOR", action: "none"}
        BE->>FE: WebSocket emit "monitoring"
    end
```

## State Machine chính xác

```mermaid
stateDiagram-v2
    [*] --> MONITOR : Boot/Reset
    MONITOR --> WATERING : humidity<20% && light>500
    MONITOR --> MONITOR : No action needed
    WATERING --> RECOVER : duration_complete
    RECOVER --> MONITOR : recovery_time_done
    note right of RECOVER
        Sensor recovery time
        (2 phút cho Yolo:Bit đơn giản)
    end note
```

## Backend Logic (NestJS)

- Endpoint hardware:
  - `POST /sensor-data`
  - `POST /sensor-data/confirm`
- State lưu theo `deviceId` trong collection `device_states`.
- Log chuỗi trạng thái trong collection `event_logs`.
- Realtime FE qua WebSocket namespace `/events` với các event:
  - `state_change`
  - `event_update`
  - `pump_stopped`
  - `monitoring`

## Database Collections

### `device_states`

- `deviceId`: định danh thiết bị (unique)
- `state`: `MONITOR | WATERING | RECOVER`
- `stateStartedAt`: thời điểm bắt đầu state hiện tại
- `wateringEndsAt`: mốc kết thúc WATERING
- `recoverEndsAt`: mốc kết thúc RECOVER
- `updatedAt`

### `event_logs`

- `deviceId`
- `humidity`
- `light`
- `state`
- `action`
- `timestamp`
- `metadata` (traceId, trigger, duration, ...)

## Key Characteristics

✅ **Sequential**: Bắt buộc `MONITOR → WATERING → RECOVER`.

✅ **Recovery Time**: 2 phút chờ sensor ổn định.

✅ **State Persistence**: DB tracking theo `deviceId`.

✅ **Realtime**: WebSocket notify FE tức thời.

✅ **Fault Tolerant**: Hardware có timer backup, backend vẫn enforce state duration.
