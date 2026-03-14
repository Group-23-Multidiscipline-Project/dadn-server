# Backend Onboarding Guide

Tài liệu này giúp hiểu nhanh kiến trúc và luồng xử lý trong backend NestJS.

**Hiện tại backend chạy 1 luồng chính duy nhất: Event Chaining.**

## 1) Cách app khởi động

- `src/main.ts`: boot Nest app, bật `ValidationPipe` (`whitelist`, `transform`), listen theo `PORT`.
- `src/app.module.ts`: module gốc, kết nối MongoDB, import các module nghiệp vụ.

## 2) Các module chính

### Config Module (`src/modules/config`)

Mục tiêu: chuẩn hoá config từ `.env`.

- Validate env bằng Joi (`config.validation.ts`).
- Expose typed getter qua `ConfigService`.
- Dùng trong `AppModule` để lấy `MONGO_URI`.

---

### Event Bus Module (`src/modules/event-bus`)

Mục tiêu: pub/sub in-memory giữa các module.

- `emit(eventType, payload)`
- `on(eventType, listener)` trả về hàm unregister.

Dùng để trace toàn bộ pipeline bằng `traceId`.

---

### Event Chaining Module (`src/modules/event-chaining`)

Mục tiêu: state machine tuần tự cho tưới tự động.

State bắt buộc:

`MONITOR -> WATERING -> RECOVER -> MONITOR`

#### Event Chaining API

- `POST /sensor-data`
- `POST /sensor-data/confirm`
- `GET /event-chaining/state/:deviceId`

#### Realtime

WebSocket namespace: `/events`

Event FE nhận:

- `state_change`
- `event_update`
- `pump_stopped`
- `monitoring`

#### Event Chaining Rule quan trọng

- Trigger WATERING khi: `humidity < 20` và `light > 500`.
- WATERING duration: `300s`.
- RECOVER duration: `120s`.
- State lưu theo `deviceId` trong `device_states` để không mất tiến trình.

---

### System Logs Module (`src/modules/system-logs`)

Mục tiêu: lưu audit log của event chain vào `system_logs`.

- Module này subscribe event bus và persist event theo `traceId`.

## 3) Schema map nhanh

- `device_states`: state machine hiện tại của từng thiết bị.
- `event_logs`: log chuyển trạng thái của event-chaining.
- `system_logs`: audit trail của event bus.

## 4) Debug theo use-case

### A. Event-chaining không chuyển state

1. Check `device_states` theo `deviceId`.
2. So `stateStartedAt`, `wateringEndsAt`, `recoverEndsAt` với thời gian hiện tại.
3. Check `event_logs` để xem action vừa trả (`start_pump`, `stop_pump`, `none`).
4. Check FE đã subscribe namespace `/events` và lắng nghe đúng event name.

- Dùng endpoint `GET /event-chaining/state/:deviceId` để FE/hardware poll trạng thái hiện tại.
