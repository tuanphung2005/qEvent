# qEvent (QUICKEVENT) - Hệ Thống Quản Trị & Soát Vé Sự Kiện Tức Thời

Hệ thống giải quyết bài toán nghẽn soát vé, gian lận chụp màn hình và mất kết nối internet tại cổng sự kiện bằng Dynamic QR (RSA-256 + TOTP 30s) và kiến trúc kiểm tra Online/Offline.

Repo chạy theo **microservices**: 3 service nghiệp vụ độc lập + 1 API Gateway. Monolith cũ đã được xoá khỏi working tree; vẫn xem/khôi phục được từ git history nếu cần đối chiếu.

---

## 🏗️ Kiến Trúc & Cấu Trúc Dự Án

```text
Browser / Mobile
      │  HTTP + WebSocket (chỉ một cổng công khai)
      ▼
api-gateway :8000          JWT, CORS, circuit breaker, reverse proxy
      ├── event-service :3001        Event, Room, Session, TicketType, Reservation
      ├── admission-service :3002    Auth, Order, Ticket, Check-in, QR
      └── engagement-service :3003   Q&A, Poll, Quiz, WebSocket

PostgreSQL riêng cho từng service:
qevent_event · qevent_admission · qevent_engagement
```

```text
qEvent/
├── gateway/                     # ElysiaJS API Gateway (Bun)
├── services/
│   ├── event-service/           # Event + reservation; prisma/migrations
│   ├── admission-service/       # Auth/order/ticket/check-in; RSA keys
│   └── engagement-service/      # Q&A/poll/quiz; WebSocket; prisma/migrations
├── docs/
│   ├── STAFF_WEB_CONSOLE_PLAN.md
│   ├── STAFF_WEB_STARTER.md     # Hợp đồng API + hướng dẫn frontend
│   ├── evidence/                # Raw JSON fault injection
│   └── TRONG_ENGAGEMENT_SERVICE_DEFENSE_GUIDE.md
├── plans/                       # Đặc tả & kế hoạch microservices
├── postman/                     # Collection + environment chạy qua gateway
├── scripts/                     # e2e, seed demo, fault injection
├── docker-compose.yml           # Chạy toàn hệ thống bằng 1 lệnh
├── DESIGN.md · PRODUCT.md · MVP.md
```

Nguyên tắc:

- Service chỉ nói chuyện với nhau qua HTTP nội bộ, không join database của nhau.
- Gateway xóa `x-user-id`/`x-user-role` do client gửi và chỉ tin JWT đã xác thực.
- Service không publish port ra host; mọi request đi qua `http://localhost:8000`.
- Mỗi service sở hữu migration riêng; container tự chạy `prisma migrate deploy` khi khởi động.

---

## 🚀 Chạy Nhanh Bằng Docker Compose

### 1. Yêu cầu

- [Docker Desktop](https://www.docker.com/) (Docker Compose v2)
- [Bun](https://bun.sh/) v1.2+ nếu muốn chạy test/dev ngoài container
- [Node.js](https://nodejs.org/) v18+ (GitNexus analyzer)

### 2. Khởi chạy

```bash
# Build và chạy 3 database + 3 service + gateway
docker compose up -d --build

# Kiểm tra
docker compose ps
curl http://localhost:8000/health
```

`/health` trả `downstream` của cả 3 service và trạng thái circuit breaker.

### 3. Nạp dữ liệu demo (idempotent)

```bash
bun run seed        # event, admission, engagement
bun run demo:seed   # order/ticket/check-in qua API, bật session live
```

Seed tạo sẵn:

- Event `Tech Summit Vietnam 2026`, 1 session, 1 ticket type.
- 5 tài khoản (organizer / 2 staff / 2 attendee), mật khẩu chung `password123`.
- Q&A, poll và quiz mẫu cho session seed.
- 3 order confirmed, 4 vé, 2 check-in để dashboard/bảng không trống.

`demo:seed` dùng `Idempotency-Key` cố định nên chạy lại không nhân đôi dữ liệu.

### 4. Chạy từng service khi phát triển

```bash
# Gateway
cd gateway && bun install && bun run dev

# Mỗi service (mở terminal riêng)
cd services/event-service && bun install && bun run dev
cd services/admission-service && bun install && bun run dev
cd services/engagement-service && bun install && bun run dev
```

Copy `.env.example` trong từng thư mục thành `.env` và trỏ `DATABASE_URL` về cổng tương ứng (`5433`, `5434`, `5435`).

---

## 🔐 Biến Môi Trường & Bí Mật

- Mỗi service có `.env.example`; không commit `.env` thật hay khóa RSA.
- Khóa RSA của Admission được sinh tự động lần đầu và lưu trong volume `admission_keys`.
- `JWT_SECRET` và `INTERNAL_SERVICE_TOKEN` phải giống nhau giữa gateway và các service.
- Không đặt secret trong biến `VITE_*` khi làm web.

---

## 🧪 Kiểm Thử

| Phạm vi | Lệnh | Ghi chú |
|---|---|---|
| Gateway | `cd gateway && bun test` | Mock 3 service, JWT, circuit breaker, WS auth |
| Event | `cd services/event-service && bun test` | Cần Postgres `localhost:5433` |
| Admission | `cd services/admission-service && bun test` | Cần Postgres `localhost:5434` |
| Engagement | `cd services/engagement-service && bun test` | Dùng in-memory Prisma, không cần DB |

Chạy tất cả từ root:

```bash
bun run test       # gateway + 3 service
bun run typecheck  # gateway + 3 service
```

### Postman

1. Import `postman/qEvent_Microservices.postman_collection.json`.
2. Import `postman/qEvent_Local.postman_environment.json` và chọn environment này.
3. Chạy folder **1. Auth** trước (token và id được lưu tự động), sau đó chạy các folder còn lại.

Collection gồm 36 request phủ 3 service qua gateway, dùng `Authorization: Bearer <JWT>`.

### E2E smoke qua Gateway

```bash
bun run e2e
```

Script đăng ký một attendee mới, chạy order → QR → check-in → staff lists/stats → Q&A/poll/quiz → WebSocket auth, và fail nếu một bước bắt buộc sai. Cần `bun run seed` và `bun run demo:seed` trước.

### Đo cô lập lỗi (dùng cho báo cáo)

```bash
bun scripts/fault-injection.ts baseline
docker compose stop engagement-service
bun scripts/fault-injection.ts engagement-down
docker compose start engagement-service
docker compose stop admission-service
bun scripts/fault-injection.ts admission-down
docker compose start admission-service
```

Số liệu thực đo và cách đọc nằm trong `docs/TRONG_ENGAGEMENT_SERVICE_DEFENSE_GUIDE.md`.

Hai thử nghiệm lỗi bắt buộc của luồng đặt vé (Event sập / mất response) có raw JSON trong `docs/evidence/`:

```bash
bun scripts/order-fault-experiment.ts > docs/evidence/order-fault.json
bun scripts/lost-response-experiment.ts > docs/evidence/lost-response.json
```

---

## 🔑 Tài Khoản Demo

Mật khẩu chung: `password123`.

| Vai trò | Email | Chức năng chính |
| :--- | :--- | :--- |
| **Attendee** | `attendee@qevent.com` | Xem vé, Dynamic QR 30s, hỏi đáp, vote, quiz |
| **Attendee 2** | `attendee2@qevent.com` | Tài khoản attendee thứ hai để test nhiều người |
| **Staff** | `staff1@qevent.com`, `staff2@qevent.com` | Quét/soát vé, sync offline, hỗ trợ Q&A |
| **Organizer** | `organizer@qevent.com` | Quản lý event, vé, check-in, host Q&A/poll/quiz |

Đăng ký attendee mới: `POST /api/auth/register` (role luôn là `ATTENDEE`; STAFF/ORGANIZER do seed hoặc admin tạo).

---

## 🛡️ Tiêu Chuẩn Kỹ Thuật

1. **Dynamic QR bảo mật**: JWT ký RS256 + TOTP 30s; token hết hạn bị từ chối.
2. **Chống check-in trùng**: cập nhật có điều kiện trong transaction; hai lần quét đồng thời chỉ một lần thành công.
3. **BR-6**: chỉ người đã check-in vào đúng event của session mới được Q&A/poll/quiz; `eventId` lấy từ Event Service và session phải `isLive`.
4. **Lỗi hạ tầng đúng mã**: dependency không kết nối được trả `503`, quá hạn trả `504`; không bị biến thành `403 NOT_CHECKED_IN`.
5. **Offline sync**: xử lý theo `scannedAt`, lần quét sớm nhất thắng kể cả khi đến muộn ở batch sau.
6. **UI/UX**: light theme, `borderWidth: 0`, bottom drop shadow, không blur (xem `DESIGN.md`).

---

## 🌿 Quy Trình Git

1. `git checkout main && git pull origin main`
2. `git checkout -b feat/<tên-tính-năng>` hoặc `fix/<tên-lỗi>`
3. Trước khi sửa symbol: chạy `impact` (GitNexus) để xem blast radius.
4. Trước khi commit: `detect_changes` (GitNexus) và chạy test/typecheck.
5. Commit theo Conventional Commits, mở PR vào `main`, cần 1 người review.

### GitNexus & Agent workflow

- **Bắt buộc** `impact({ target: "symbolName", direction: "upstream" })` trước khi sửa hàm/class.
- **Bắt buộc** `detect_changes()` trước khi commit.
- Dùng `query`/`context` thay cho grep chuỗi thô khi cần hiểu luồng.
- Cập nhật index: `node .gitnexus/run.cjs analyze`.

### Ponytail (kỷ luật code tối thiểu)

- Code ít nhất mà giải quyết trọn vẹn bài toán.
- Ưu tiên thư viện có sẵn (Bun, Prisma, Elysia); không thêm wrapper/abstraction thừa.

### Impeccable (UI/UX)

- Nạp ngữ cảnh: đọc `PRODUCT.md` và `DESIGN.md` trước khi làm UI.
- Bất biến: light theme, không border, bottom drop shadow, không blur, tương phản ≥ 4.5:1.
- Lệnh: `/impeccable shape`, `/impeccable polish`, `/impeccable audit`.

Xem thêm `PROMPTING.md`, `docs/STAFF_WEB_CONSOLE_PLAN.md` và `docs/STAFF_WEB_STARTER.md` (hợp đồng API + cách chạy cho team frontend).
