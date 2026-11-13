# API Gateway — Module phụ trách bởi: Tuấn (Nhóm trưởng)

## 1. Tổng quan & Trách nhiệm
API Gateway là điểm vào công khai (Public Entrypoint) duy nhất của toàn bộ hệ thống qEvent Microservices chạy tại cổng `8000`.

- **Reverse Proxy**: Chuyển tiếp request đến microservice tương ứng theo tiền tố URL.
- **Centralized Authentication (JWT)**: Giải mã và xác thực chữ ký token JWT một lần duy nhất tại Gateway. Trích xuất thông tin định danh và chuyển tiếp qua headers an toàn `x-user-id`, `x-user-role`. Xóa sạch mọi header giả mạo từ phía client.
- **Circuit Breaker (Opossum)**: Bọc riêng từng downstream target (`event`, `admission`, `engagement`). Khi tỷ lệ lỗi/timeout > 50% sau 5 requests, Circuit Breaker chuyển sang trạng thái `OPEN` và fail-fast trả về `503 Service Unavailable` (<5ms), chống hiện tượng Cascading Failure. Timeout của một request trả `504 GATEWAY_TIMEOUT`; lỗi kết nối/circuit mở trả `503`.
- **Healthcheck & Ping**: Cung cấp endpoint `GET /health` trả về trạng thái Gateway, trạng thái của 3 Circuit Breakers và ping tới các microservices.
- **WebSocket Gateway**: Proxy kết nối thời gian thực `/ws/*` tới Engagement Service. Bắt buộc JWT (`?token=<jwt>` hoặc subprotocol `bearer,<jwt>`); kết nối ẩn danh bị đóng với mã `4401`.

## 2. Bản đồ định tuyến (Routing Map)
| Prefix Đường dẫn | Dịch vụ Đích (Downstream) | Môi trường / URL mặc định |
|---|---|---|
| `/api/events/*` | Event Service | `EVENT_SERVICE_URL` (Port 3001) |
| `/api/auth/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/orders/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/tickets/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/checkins/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/sessions/*` | Engagement Service | `ENGAGEMENT_SERVICE_URL` (Port 3003) |
| `/api/polls/*` | Engagement Service | `ENGAGEMENT_SERVICE_URL` (Port 3003) |
| `/api/questions/*` | Engagement Service | `ENGAGEMENT_SERVICE_URL` (Port 3003) |
| `/api/game/*` | Engagement Service | `ENGAGEMENT_SERVICE_URL` (Port 3003) |
| `/ws/*` | Engagement Service (WebSocket, JWT bắt buộc) | `ENGAGEMENT_SERVICE_URL` (Port 3003) |
| `/health` | API Gateway (Health & Downstream Status) | Nội bộ Gateway |

## 3. Lệnh chạy & Kiểm thử

```bash
# 1. Cài đặt dependencies
bun install

# 2. Khởi chạy Gateway ở chế độ dev
bun run dev

# 3. Chạy toàn bộ Unit & Integration tests
bun test

# 4. Typecheck
bun run typecheck

# 5. Đo cô lập lỗi thật (cần toàn hệ thống đang chạy)
cd .. && bun scripts/fault-injection.ts baseline
```
