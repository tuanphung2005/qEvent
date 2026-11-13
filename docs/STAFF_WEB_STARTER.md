# Staff Web — Backend Handoff

Backend cho staff web đã xong A1–A12. Frontend không cần sửa service; chỉ dựng UI và gọi gateway.

## 1. Chạy hệ thống

```bash
docker compose up -d --build
bun run seed          # seed 3 service (idempotent)
bun run demo:seed     # tạo order/ticket/check-in demo qua API
bun run e2e           # smoke 31 check qua gateway
```

- Gateway: `http://localhost:8000`
- Chỉ gateway mở port; service/DB nội bộ.
- Dev web: Vite proxy `/api` và `/ws` sang `http://localhost:8000`.
- Production: Nginx cùng origin, proxy `/api` + `/ws` sang gateway.

## 2. Auth

```
POST /api/auth/login    { email, password } → { token, user }
GET  /api/auth/me       Authorization: Bearer <token> → { user }
```

- Token sống 12h. Lưu memory + `sessionStorage`, không `localStorage`.
- WebSocket: `ws://localhost:8000/ws/qa?token=<jwt>` (hoặc `/ws/game`).
- Tài khoản demo: `organizer@qevent.com`, `staff1@qevent.com`, `staff2@qevent.com`, `attendee@qevent.com`, `attendee2@qevent.com` — mật khẩu `password123`.

## 3. Màn hình → endpoint

| Màn hình | Endpoint |
|---|---|
| Login / Settings | `POST /api/auth/login`, `GET /api/auth/me` |
| Events list | `GET /api/events` |
| Event detail | `GET /api/events/:id` |
| Create event | `POST /api/events` |
| Edit event | `PATCH /api/events/:id` |
| Rooms | `POST /api/events/:id/rooms`, `PATCH /api/events/:id/rooms/:roomId` |
| Sessions | `POST /api/events/:id/sessions`, `PATCH /api/events/:id/sessions/:sessionId` |
| Ticket types | `POST /api/events/:id/ticket-types`, `PATCH /api/events/:id/ticket-types/:ticketTypeId` |
| Orders | `GET /api/orders?eventId=...`, `GET /api/orders/:id` |
| Tickets | `GET /api/tickets?eventId=...`, `GET /api/tickets/:id` |
| Scan | `POST /api/checkins` |
| Sync | `POST /api/checkins/sync-offline` |
| Check-in feed | `GET /api/checkins?eventId=...` |
| Dashboard | `GET /api/checkins/stats?eventId=...`, `GET /api/sessions/:id/stats` |
| Q&A | `GET/POST /api/sessions/:id/questions`, `PUT /api/questions/:id/votes`, `DELETE /api/questions/:id` |
| Polls | `GET/POST /api/sessions/:id/polls`, `POST /api/polls/:id/vote`, `PATCH /api/polls/:id` |
| Quiz | `/api/sessions/:id/game`, `/api/game/:id/*` |
| Realtime | `/ws/qa`, `/ws/game` |

## 4. Phân trang & lọc

- `limit` 1–100, mặc định 20; `cursor` = `nextCursor` của trang trước.
- Orders: `status`, `q` (order id / email / tên).
- Tickets: `status`, `q` (ticket id / email / tên).
- Check-ins: `since` (ISO), `gate` (= `deviceId`).
- Mọi list trả `nextCursor: string | null`.

## 5. Lỗi & RBAC

- Lỗi: `{ code, message }`; 400/401/403/404/409/422/503/504.
- STAFF/ORGANIZER được xem orders/tickets/checkins/stats.
- Chỉ ORGANIZER sửa event/room/session/ticket type.
- STAFF + ORGANIZER host Q&A/poll/quiz.
- ATTENDEE bị 403 ở các endpoint staff; UI ẩn nút nhưng server vẫn kiểm tra.

## 6. Hợp đồng máy đọc

- `services/event-service/openapi.json` (+ `.yaml`)
- `services/admission-service/openapi.json` (+ `.yaml`)
- `services/engagement-service/openapi.json` (+ `.yaml`)

Sinh type client từ các file này (`openapi-typescript`). Không tự đoán response.

## 7. Lưu ý

- `GET /api/tickets` là danh sách staff; attendee dùng `/api/tickets/my`.
- `byGate` dựa trên `deviceId`; scanner phải gửi `gate-1`, `gate-2`… nhất quán.
- Role hiện là global: STAFF thấy mọi event; chưa phân quyền theo event.
- `DELETE /api/questions/:id` là xoá thật (không có cột `hidden`).
- Không làm trong MVP: cancel/refund, export CSV, offline web.
- Chia việc 4 người và quy tắc tránh conflict: `docs/STAFF_WEB_TEAM_SPLIT.md`.
