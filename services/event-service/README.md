# Event Service (qEvent)

Microservice quản lý **sự kiện, phòng, phiên, loại vé và giữ chỗ nguyên tử** của qEvent.
Thuộc phần việc của Thành theo `plans/AI_MICROSERVICES_EXECUTION_PLAN.md` (mục 4.2) và
`plans/MICROSERVICES_MIGRATION.md` (Giai đoạn 2).

- Cổng nội bộ: `3001`
- Database riêng: `qevent_event` (không foreign key xuyên service)
- Không truy cập database của Admission/Engagement; chỉ gọi HTTP nội bộ.

## Trách nhiệm

| Nhóm | Nội dung |
|---|---|
| Event | Tạo/sửa/đọc sự kiện, kiểm tra BR-1 (`startTime < endTime`, không ở quá khứ) |
| Metadata | Phòng, phiên (kèm `isLive`), loại vé |
| Reservation | Giữ chỗ nguyên tử theo `operationId`, chống oversell bằng CAS trên `Event.reservedCount` và `TicketType.soldCount` |
| Internal | Giữ/giải phóng chỗ cho Admission; đọc event/session cho Engagement |

## API

| Method | Endpoint | Quyền | Thành công | Lỗi tiêu biểu |
|---|---|---|---|---|
| GET | `/api/events` | Public | `200` | — |
| POST | `/api/events` | `x-user-role: ORGANIZER` | `201` | `403 FORBIDDEN`, `422 INVALID_EVENT_TIME` |
| GET | `/api/events/:id` | Public | `200` | `404 EVENT_NOT_FOUND` |
| PATCH | `/api/events/:id` | `x-user-role: ORGANIZER` | `200` | `404`, `409 CAPACITY_BELOW_RESERVED`, `422` |
| POST | `/api/events/:id/rooms` | `x-user-role: ORGANIZER` | `201` | `404`, `422` |
| POST | `/api/events/:id/sessions` | `x-user-role: ORGANIZER` | `201` | `404`, `422 INVALID_SESSION_TIME` |
| POST | `/api/events/:id/ticket-types` | `x-user-role: ORGANIZER` | `201` | `404`, `422` |
| POST | `/internal/reservations` | `x-service-token` | `201` mới / `200` replay | `401`, `404`, `409 SOLD_OUT / IDEMPOTENCY_CONFLICT` |
| DELETE | `/internal/reservations/:operationId` | `x-service-token` | `200` | `404 RESERVATION_NOT_FOUND` |
| GET | `/internal/events/:id` | `x-service-token` | `200` | `404` |
| GET | `/internal/sessions/:id` | `x-service-token` | `200` | `404 SESSION_NOT_FOUND` |
| GET | `/health` | Public | `200` | `503` khi DB không sẵn sàng |

OpenAPI 3.0.3: `openapi.json` và `openapi.yaml` (sinh bằng `bun run openapi`), phục vụ tại
`/swagger`, spec thô tại `/swagger/json`. Test `test/openapi.test.ts` fail nếu file checked-in
lệch với spec đang phục vụ hoặc một operation mất example.

## Hợp đồng với Admission Service

Admission gọi hai endpoint nội bộ, luôn gửi header `x-service-token`:

```http
POST /internal/reservations
{ "operationId": "...", "eventId": "...", "ticketTypeId": "...", "quantity": 1 }

DELETE /internal/reservations/:operationId
```

- `2xx`: giữ chỗ thành công. Response chứa `reservation.unitPrice` để Admission tính `totalAmount`.
- `409 SOLD_OUT`: hết quota loại vé hoặc hết `maxCapacity` của sự kiện.
- `409 IDEMPOTENCY_CONFLICT`: cùng `operationId` nhưng payload khác.
- `409 RESERVATION_RELEASED`: `operationId` đã được giải phóng, không giữ lại.
- `DELETE` idempotent: gọi lặp không trừ `soldCount`/`reservedCount` hai lần.

## Chống tranh chấp (oversell)

Mỗi lần giữ chỗ chạy trong một transaction:

```sql
UPDATE "Event"      SET "reservedCount" = "reservedCount" + :q
WHERE id = :eventId AND "reservedCount" + :q <= "maxCapacity";

UPDATE "TicketType" SET "soldCount" = "soldCount" + :q
WHERE id = :ticketTypeId AND "soldCount" + :q <= "quota";
```

Nếu một trong hai câu trả về 0 hàng bị ảnh hưởng, transaction rollback và trả `409 SOLD_OUT`.
Postgres khóa hàng khi UPDATE nên 100 request tranh vé cuối chỉ đúng 1 request thắng.

## Chạy local

```bash
cd services/event-service
cp .env.example .env          # sửa DATABASE_URL/TEST_DATABASE_URL nếu cần
bun install
bun run db:generate
bunx prisma migrate deploy    # hoặc: bunx prisma db push
bun run db:seed               # idempotent, không xóa dữ liệu
bun run dev                   # http://localhost:3001
```

Thư mục này trỏ Postgres ở `localhost:5433` (cổng mapping của `postgres-event`).

Tạo database test (một lần):

```bash
docker exec qevent-db-event createdb -U postgres qevent_event_test
```

Chạy test:

```bash
bun test
```

Test dùng `TEST_DATABASE_URL`, tự `prisma db push` schema test và không đụng database dev.

## Docker

```bash
cd services/event-service
docker compose up --build
```

Compose tại đây chạy `postgres-event` (publish `5433` ra host) và `event-service`
(chỉ mở trong mạng Docker, không publish cổng host). Khi ghép hệ thống, trỏ
`EVENT_SERVICE_URL` của Admission tới `http://event-service:3001`.

## Bảo mật

- Cổng `3001` chỉ mở trong mạng Docker; Gateway là điểm vào công khai duy nhất.
- Gateway xác thực JWT rồi chuyển `x-user-role`; service từ chối mọi role khác `ORGANIZER`.
- API nội bộ yêu cầu `x-service-token` trùng `INTERNAL_SERVICE_TOKEN`.
- Không log token hay dữ liệu nhạy cảm.

## Giới hạn đã biết

- `expiresAt` của reservation chỉ mang tính thông tin; chưa tự động giải phóng vì chưa có
  giao thức xác nhận an toàn (theo `plans/MICROSERVICES_MIGRATION.md`). Admission worker
  chịu trách nhiệm gọi `DELETE` khi đơn thất bại.
- Chưa có endpoint xóa/sửa room, session, ticket type; chỉ tạo và đọc.
- Chưa có payment thật; `price` chỉ là dữ liệu sandbox.
