# Tài liệu API cho Thiết bị Phần cứng

Tài liệu này hướng dẫn cách lập trình firmware cho thiết bị (Yolo:Bit) để gửi dữ liệu cảm biến lên backend và nhận lệnh điều khiển bơm nước.

## Luồng Tương tác Tổng quan

1. **Device → Backend (MQTT)**: Thiết bị định kỳ gửi dữ liệu cảm biến (`soil_moisture`, `light`).
2. **Backend → Device (MQTT)**: Backend xử lý dữ liệu, nếu đủ điều kiện sẽ gửi lệnh `start_pump` hoặc `stop_pump`.
3. **Device → Backend (MQTT)**: Thiết bị gửi ACK trạng thái bơm (`pump_on`, `pump_off`) để backend lưu log vận hành.

---

## 1. Cấu hình trên Thiết bị

Firmware cần được cấu hình với các thông tin sau:

- **`deviceId`**: Mã định danh duy nhất cho mỗi thiết bị, ví dụ: `node_01`.
- **`MQTT_BROKER_URL`**: Địa chỉ của MQTT Broker, ví dụ: `mqtt://192.168.1.10:1883`.
- **`MQTT_TOPIC_BASE`**: Topic MQTT gốc, ví dụ: `yolofarm`.
- **`MQTT_QOS`**: QoS khuyến nghị `1` cho lệnh điều khiển/ACK.
- **`API_BASE_URL`** (tùy chọn): Chỉ dùng nếu muốn gọi API `POST /sensor-data/confirm` theo luồng tương thích cũ.

---

## 2. Gửi Dữ liệu Lên Backend (MQTT)

### a) Gửi dữ liệu cảm biến

Thiết bị cần định kỳ (ví dụ: mỗi 10 giây) gửi dữ liệu cảm biến.

- **Topic humidity/độ ẩm đất**: `{MQTT_TOPIC_BASE}/{deviceId}/sensors/soil_moisture`
  - Ví dụ: `yolofarm/node_01/sensors/soil_moisture`

```json
{ "value": 15.5 }
```

- **Topic ánh sáng**: `{MQTT_TOPIC_BASE}/{deviceId}/sensors/light`
  - Ví dụ: `yolofarm/node_01/sensors/light`

```json
{ "value": 650.0 }
```

### b) Gửi ACK trạng thái bơm

Sau khi thiết bị thực thi lệnh bơm, gửi ACK về backend để theo dõi vận hành.

- **Topic**: `{MQTT_TOPIC_BASE}/{deviceId}/status/irrigation`
  - Ví dụ: `yolofarm/node_01/status/irrigation`
- **Payload (JSON)**:

```json
{
  "action": "start_pump",
  "status": "pump_on",
  "shouldIrrigate": true,
  "durationSeconds": 5,
  "timestamp": "2026-03-14T10:14:33Z"
}
```

### c) (Tùy chọn) Xác nhận hoàn tất tưới bằng HTTP

Nếu cần ép backend chuyển trạng thái ngay theo luồng cũ, có thể gọi API xác nhận:

- **Endpoint**: `POST {API_BASE_URL}/sensor-data/confirm`
- **Body (JSON)**:

```json
{
  "deviceId": "node_01"
}
```

---

## 3. Nhận Lệnh từ Backend (MQTT)

Thiết bị **phải subscribe** vào topic MQTT để nhận lệnh điều khiển.

- **Topic subscribe**: `{MQTT_TOPIC_BASE}/{deviceId}/control/irrigation`
  - Ví dụ: `yolofarm/node_01/control/irrigation`

- **Payload lệnh nhận được (JSON)**:

```json
{
  "traceId": "dbfe5b5c-8ef0-4c27-8eb9-6d6a4d6fd2f0",
  "action": "start_pump",
  "status": "pending_on",
  "shouldIrrigate": true,
  "durationSeconds": 5,
  "timestamp": "2026-03-14T10:14:32.217Z"
}
```

### Hành động của Thiết bị khi nhận lệnh

- Nếu nhận `action: "start_pump"`:
  1. **Bật relay** để chạy máy bơm.
  2. Lưu lại `durationSeconds`.
  3. **Gửi ACK MQTT** lên topic `.../status/irrigation` với `status: "pump_on"`.
  4. Bắt đầu timer nội bộ.

- Nếu nhận `action: "stop_pump"`:
  1. **Tắt relay** để dừng máy bơm.
  2. **Gửi ACK MQTT** với `status: "pump_off"`.

---

## 4. Kịch bản Hoạt động Chi tiết (5 Trường hợp)

Đây là vòng đời hoạt động của thiết bị.

### Case 1: Giám sát bình thường (Đất đủ ẩm)

1. **Device gửi MQTT**:
   - `yolofarm/node_01/sensors/soil_moisture` → `{ "value": 40 }`
   - `yolofarm/node_01/sensors/light` → `{ "value": 600 }`
2. **Backend phản hồi**: Không gửi lệnh điều khiển.
3. **Device hành động**: Tiếp tục gửi dữ liệu định kỳ.

### Case 2: Kích hoạt Tưới (Đất khô)

1. **Device gửi MQTT**:
   - `yolofarm/node_01/sensors/soil_moisture` → `{ "value": 10 }`
   - `yolofarm/node_01/sensors/light` → `{ "value": 600 }`
2. **Backend phản hồi (MQTT)**:
   - Topic `yolofarm/node_01/control/irrigation`
   - Payload có `action: "start_pump"`, `status: "pending_on"`.
3. **Device hành động**:
   - Bật relay bơm nước.
   - Gửi ACK `pump_on` lên `yolofarm/node_01/status/irrigation`.
   - Bắt đầu timer nội bộ.

### Case 3: Đang trong quá trình Tưới

1. **Device trạng thái**: Bơm đang bật, timer đang chạy.
2. **Device hành động**: Có thể tiếp tục gửi sensor định kỳ qua MQTT (khuyến nghị), không cần gửi lệnh điều khiển nào.

### Case 4: Hoàn tất Tưới

1. **Device trạng thái**: Timer nội bộ vừa kết thúc.
2. **Device gửi 1 gói sensor mới qua MQTT** để backend xử lý tick state.
3. **Backend phản hồi (MQTT)**:
   - Topic `yolofarm/node_01/control/irrigation`
   - Payload có `action: "stop_pump"`, `status: "pending_off"`.
4. **Device hành động**:
   - Tắt relay bơm nước.
   - Gửi ACK `pump_off` lên `yolofarm/node_01/status/irrigation`.
   - Bắt đầu pha nghỉ (RECOVER).

### Case 5: Quay lại Giám sát

1. **Device trạng thái**: Bơm đã tắt, đã qua RECOVER.
2. **Device gửi MQTT sensor mới**:
   - `yolofarm/node_01/sensors/soil_moisture` → `{ "value": 35 }`
   - `yolofarm/node_01/sensors/light` → `{ "value": 550 }`
3. **Backend phản hồi**: Không có lệnh điều khiển.
4. **Device hành động**: Vòng lặp quay lại **Case 1**.
