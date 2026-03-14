# Tài liệu API: Trạng thái thiết bị (Event Chaining)

Hệ thống hoạt động theo vòng lặp trạng thái (State Machine) với 3 trạng thái chính:

- **MONITOR**: Đang giám sát bình thường.
- **WATERING**: Đang tưới nước (bơm đang bật).
- **RECOVER**: Đang chờ nước thẩm thấu vào đất (bơm đã tắt).

## 1) REST API: Lấy trạng thái hiện tại của thiết bị

API này dùng để gọi 1 lần khi user vừa mở trang Web/App để load giao diện ban đầu (Initial Load).

### Endpoint

- **Method:** `GET`
- **URL:** `/state/:deviceId`
- **Path Params:**
  - `deviceId` (`string`): Mã thiết bị (ví dụ: `node_01`)

### Response

- **Status Code:** `200 OK`

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

### Ý nghĩa các trường (dành cho Frontend xử lý UI)

| Trường | Kiểu dữ liệu | Ý nghĩa & Cách dùng cho UI |
|---|---|---|
| `exists` | `boolean` | `true` nếu thiết bị đã từng gửi data. Nếu `false`, UI có thể hiện "Thiết bị chưa hoạt động". |
| `state` | `string` | Chỉ có 3 giá trị: `MONITOR`, `WATERING`, `RECOVER`. Dùng để đổi màu UI hoặc hiện icon tương ứng. |
| `action` | `string` | Lệnh đang thực thi: `none` (không làm gì), `start_pump` (bật bơm), `stop_pump` (tắt bơm). |
| `remainingSeconds` | `number` | Số giây còn lại của state hiện tại. FE dùng để làm đồng hồ đếm ngược (countdown). Nếu bằng `0` thì ẩn đồng hồ. |
| `stateStartedAt` | `ISO Date` | Thời điểm bắt đầu chuyển sang trạng thái hiện tại. |
| `wateringEndsAt` | `ISO Date` \| `null` | Thời điểm kết thúc WATERING (nếu đang WATERING), ngược lại có thể là `null`. |
| `recoverEndsAt` | `ISO Date` \| `null` | Thời điểm kết thúc RECOVER (nếu đang RECOVER), ngược lại có thể là `null`. |

## 2) WebSocket: Nhận cập nhật trạng thái realtime

Thay vì Frontend phải gọi `GET /state/:deviceId` liên tục (polling) làm nặng server, FE nên kết nối WebSocket để nhận dữ liệu ngay khi trạng thái thay đổi.

- **Namespace:** `/events`

### Payload Frontend nhận được (khi có thay đổi state)

```json
{
  "deviceId": "node_01",
  "state": "WATERING",
  "action": "start_pump",
  "durationSeconds": 300,
  "timestamp": "2026-03-14T10:14:32.217Z"
}
```

## Gợi ý logic cho Frontend (React/Vue/Flutter)

1. Khi `onMounted` (vừa mở app), gọi `GET /state/{deviceId}` để lấy `state` và `remainingSeconds`, lưu vào global state (Redux/Zustand/Vuex).
2. Bật `setInterval` ở client để đếm ngược `remainingSeconds`.
3. Lắng nghe WebSocket từ namespace `/events`.
4. Khi có message mới:
   - Cập nhật state trên UI.
   - Lấy `durationSeconds` đè vào biến đếm ngược hiện tại và bắt đầu đếm lại từ đầu.