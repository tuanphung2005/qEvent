# Admission Service (qEvent)

Microservice phụ trách **tài khoản, đặt vé, Dynamic QR và soát vé** của qEvent.
Thuộc phần việc của Vũ theo `plans/AI_MICROSERVICES_EXECUTION_PLAN.md` (mục 4.3 – 6).

- Cổng nội bộ: `3002`
- Database riêng: `qevent_admission` (không foreign key xuyên service)
- Không truy cập database của Event/Engagement; chỉ gọi HTTP nội bộ.

## Trách nhiệm

| Nhóm | Nội dung |
|---|---|
| Auth | Đăng ký, đăng nhập, JWT; đăng ký công khai luôn là `ATTENDEE` |
| Order | Saga đặt vé sang Event Service, idempotency, pending/reconciliation, bồi hoàn |
| QR | Token ký RSA-SHA256 + TOTP RFC 6238 (30 giây), gắn với `ticketId` + `eventId` |
| Check-in | CAS `PAID → CHECKED_IN`, chống quét trùng, đồng bộ offline, chống replay |
| Internal | `GET /internal/tickets/verify-access` cho Engagement Service |

## API

| Method | Endpoint | Thành công | Lỗi tiêu biểu |
|---|---|---|---|
| POST | `/api/auth/register` | `201` + JWT | `409 EMAIL_TAKEN`, `422` |
| POST | `/api/auth/login` | `200` + JWT | `401 INVALID_CREDENTIALS` |
| POST | `/api/orders` | `201 CONFIRMED` / `202 PENDING` | `400 IDEMPOTENCY_KEY_REQUIRED`, `409 IDEMPOTENCY_CONFLICT`, `409 SOLD_OUT` |
| GET | `/api/orders/:id` | `200` | `404 ORDER_NOT_FOUND` |
| GET | `/api/tickets`, `/api/tickets/my` | `200` | `401` |
| GET | `/api/tickets/:id/qr-token` | `200` | `403`, `404`, `409 TICKET_CANCELLED` |
| POST | `/api/checkins` | `201 CHECKIN_SUCCESS` | `400 INVALID_QR_TOKEN`, `409 ALREADY_CHECKED_IN`, `403` |
| POST | `/api/checkins/sync-offline` | `200` (kèm `synced/conflicts/duplicates`) | `403` |
| GET | `/internal/tickets/verify-access` | `200 { hasAccess }` | `401 UNAUTHORIZED_SERVICE` |
| GET | `/health` | `200` | `503` khi DB không sẵn sàng |

OpenAPI 3.0.3: `openapi.json` and `openapi.yaml` (generate both with `bun run openapi`),
served at `/swagger` with the raw spec at `/swagger/json`. The contract documents request/response
schemas, JWT and `x-service-token` security, every success/error status, and success/error examples.
Examples and response payloads are generated from the schemas in `src/openapi.ts`, so the checked-in
files cannot drift from the contract. `test/openapi.test.ts` fails when the files drift from the
served spec or an operation loses its examples.

## Hợp đồng với Event Service

Admission gọi hai endpoint nội bộ, luôn gửi header `x-service-token`:

```http
POST /internal/reservations
{ "operationId": "...", "eventId": "...", "ticketTypeId": "...", "quantity": 1 }

DELETE /internal/reservations/:operationId
```

- `2xx`: giữ chỗ thành công → Admission tạo vé và chuyển đơn `CONFIRMED`.
- `4xx` (ví dụ `409 SOLD_OUT`): lỗi nghiệp vụ → đơn `FAILED`, **không retry**.
- Timeout / `502` / `503` / `504`: chưa rõ kết quả → đơn `PENDING_RECONCILIATION`,
  trả `202` kèm `Location: /api/orders/:id`, worker đối soát lại bằng cùng `operationId`.
- Nếu đã giữ chỗ nhưng tạo vé thất bại: gọi `DELETE` để bồi hoàn; nếu bồi hoàn lỗi,
  đơn giữ `COMPENSATING` và worker tiếp tục thử.

## Độ tin cậy

- Timeout mỗi lần gọi: `2000ms` (`INTERNAL_TIMEOUT_MS`).
- Retry tối đa 2 lần, backoff `300ms`, chỉ với lỗi mạng/timeout/`502`/`503`/`504`.
- Không retry `400/401/403/404/409/422`.
- Worker đối soát chạy mỗi `5s` (`RECONCILE_INTERVAL_MS`), dùng lease CAS
  (`RECONCILE_LEASE_MS`, mặc định `30s`) để hai tiến trình không xử lý cùng đơn.

## Bảo mật

- JWT được **xác thực lại trong service**; role/id lấy từ token, không tin body/header.
- Đăng ký công khai bỏ qua `role` trong body, luôn tạo `ATTENDEE`.
- Khóa RSA sinh một lần và lưu ở `KEYS_DIR` (Docker volume `admission_keys`).
- API nội bộ yêu cầu `x-service-token` trùng `INTERNAL_SERVICE_TOKEN`.
- Không log mật khẩu, token hay `qrSecret`.

## Chạy local

```bash
cd services/admission-service
cp .env.example .env          # sửa DATABASE_URL/TEST_DATABASE_URL cho đúng máy
bun install
bunx prisma migrate deploy    # hoặc: bunx prisma db push
bun prisma/seed.ts            # idempotent, không xóa dữ liệu
bun run dev                   # http://localhost:3002
```

Thư mục này đang trỏ Postgres ở `localhost:5433` vì máy hiện tại có PostgreSQL 18
chiếm `5432`. Đổi `DATABASE_URL` nếu môi trường của bạn khác.

Tạo database test (một lần):

```bash
docker exec qevent-postgres createdb -U postgres qevent_admission_test
```

Chạy test:

```bash
bun test
```

Test dùng `TEST_DATABASE_URL`, tự `prisma db push` schema test và không đụng database dev.

Tài khoản seed (mật khẩu chung `password123`):

| Email | Role |
|---|---|
| `organizer@qevent.com` | `ORGANIZER` |
| `staff1@qevent.com` | `STAFF` |
| `staff2@qevent.com` | `STAFF` |
| `attendee@qevent.com` | `ATTENDEE` |
| `attendee2@qevent.com` | `ATTENDEE` |

## Docker

```bash
cd services/admission-service
docker compose up --build
```

Compose tại đây chạy `postgres-admission` (publish `5434` ra host theo quy ước compose tổng)
và `admission-service` (chỉ mở trong mạng Docker, không publish cổng host). Khi ghép hệ thống,
trỏ `EVENT_SERVICE_URL` tới `http://event-service:3001` và thêm service này vào compose tổng.

## Giới hạn đã biết

- `totalAmount` lấy `unitPrice`/`price` từ response reservation; nếu Event Service không trả
  thì mặc định `0` (vé sandbox, chưa có Payment Service).
- Chính sách offline: scan hợp lệ đầu tiên theo thời gian thắng; scan sau trên vé đã
  `CHECKED_IN` được ghi log `CONFLICT`, không đổi trạng thái.
- Chưa có Gateway trong checkout này; service tự xác thực JWT để vẫn an toàn khi gọi trực tiếp.
