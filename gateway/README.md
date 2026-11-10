# API Gateway — Module phụ trách bởi: Tuấn (Nhóm trưởng)

## 1. Tổng quan & Trách nhiệm
API Gateway là điểm vào công khai (Public Entrypoint) duy nhất của toàn bộ hệ thống qEvent Microservices chạy tại cổng `8000`.

- **Reverse Proxy**: Chuyển tiếp request đến microservice tương ứng theo tiền tố URL.
- **Centralized Authentication (JWT)**: Giải mã và xác thực chữ ký token JWT một lần duy nhất tại Gateway. Trích xuất thông tin định danh và chuyển tiếp qua headers an toàn `x-user-id`, `x-user-role`. Xóa sạch mọi header giả mạo từ phía client.
- **Circuit Breaker (Opossum)**: Bọc riêng từng downstream target (`event`, `admission`, `engagement`). Khi tỷ lệ lỗi/timeout > 50% sau 5 requests, Circuit Breaker chuyển sang trạng thái `OPEN` và fail-fast trả về `503 Service Unavailable` (<5ms), chống hiện tượng Cascading Failure.
- **Healthcheck & Ping**: Cung cấp endpoint `GET /health` trả về trạng thái Gateway, trạng thái của 3 Circuit Breakers và ping tới các microservices.
- **WebSocket Gateway**: Proxy kết nối thời gian thực `/ws/*` tới Engagement Service.

## 2. Bản đồ định tuyến (Routing Map)
| Prefix Đường dẫn | Dịch vụ Đích (Downstream) | Môi trường / URL mặc định |
|---|---|---|
| `/api/events/*` | Event Service | `EVENT_SERVICE_URL` (Port 3001) |
| `/api/auth/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/orders/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/tickets/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/checkins/*` | Admission Service | `ADMISSION_SERVICE_URL` (Port 3002) |
| `/api/sessions/*` | Engagement Service | `ENGAGEMENT_SERVICE_URL` (Port 3003) |
| `/ws/*` | Engagement Service (WebSocket) | `ENGAGEMENT_SERVICE_URL` (Port 3003) |
| `/health` | API Gateway (Health & Downstream Status) | Nội bộ Gateway |

## 3. Lệnh chạy & Kiểm thử

```bash
# 1. Cài đặt dependencies
bun install

# 2. Khởi chạy Gateway ở chế độ dev
bun run dev

# 3. Chạy toàn bộ Unit & Integration tests
bun test

# 4. Chạy kịch bản Demo Circuit Breaker (Kịch bản 2 phục vụ bảo vệ đồ án)
bun run demo:circuit-breaker
```

## 4. Cẩm nang vấn đáp bảo vệ cho Tuấn (Điểm tối đa 3.0)

- **Q: Tại sao phải xác thực JWT tại API Gateway mà không để từng service làm?**
  - **Trả lời:** Áp dụng mẫu kiến trúc Centralized Authentication. Gateway đóng vai trò người gác cổng, xác thực chữ ký token một lần duy nhất, loại bỏ các request giả mạo ngay tại biên mạng. Các service bên trong chỉ cần đọc thông tin tin cậy qua Header `x-user-id` và `x-user-role`, giúp giảm tải việc giải mã token lặp lại nhiều lần.
- **Q: Circuit Breaker hoạt động ra sao và giải quyết vấn đề gì?**
  - **Trả lời:** Giải quyết hiện tượng lỗi dây chuyền (Cascading Failure). Nếu một service con bị chậm hoặc chết, các request đến Gateway sẽ bị treo hàng loạt làm cạn kiệt connection pool. Khi tỷ lệ lỗi vượt quá 50%, Circuit Breaker ngắt mạch (OPEN), từ chối ngay lập tức (fail-fast trong <5ms) để service con có thời gian hồi phục và Gateway không bị tê liệt.
