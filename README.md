# qEvent (QUICKEVENT) - Hệ Thống Quản Trị & Soát Vé Sự Kiện Tức Thời

Hệ thống MVP giải quyết bài toán nghẽn soát vé, gian lận chụp màn hình và mất kết nối internet tại cổng sự kiện với cơ chế Dynamic QR (RSA-256 + TOTP 30s) và kiến trúc Hybrid Check-in (Online/Offline-First).

---

## 🏗️ Cấu Trúc Dự Án

```text
qEvent/
├── backend/                      # ElysiaJS + Prisma + PostgreSQL (Bun Runtime)
│   ├── prisma/
│   │   ├── schema.prisma         # Schema PostgreSQL với các thực thể cốt lõi
│   │   └── seed.ts               # Dữ liệu ban đầu (Organizer, Staff, Event, Ticket)
│   ├── src/
│   │   ├── config/keys.ts        # Thuật toán sinh khóa RSA & RFC 6238 TOTP
│   │   ├── plugins/prisma.ts     # Prisma client plugin
│   │   ├── services/ai.service.ts# Gemini client lazy + validate + single-flight
│   │   ├── modules/
│   │   │   ├── auth/             # POST /api/auth/login, GET /api/auth/me
│   │   │   ├── tickets/          # My tickets, Dynamic QR token, Sandbox purchase
│   │   │   ├── checkin/          # Cache route, Online verify, Offline sync
│   │   │   ├── realtime/         # WebSocket /ws/qa, Q&A, polls, AI clustering
│   │   │   ├── game/             # Quiz game engine (state machine, scoring)
│   │   │   └── ai/               # POST /api/ai/generate-quiz (Gemini draft)
│   │   └── index.ts              # Entrypoint máy chủ ElysiaJS
│   └── test/                     # Bun test: crypto, flow, game, AI
├── plans/                        # AI Integration Plan v2.2 (thiết kế + sprint)
├── docker-compose.yml            # Khởi chạy PostgreSQL 16
└── MVP.md                        # Tài liệu đặc tả kỹ thuật MVP
```

> Frontend mobile (`app/`) đã bị xoá ở commit `0270a5d`; frontend hiện nằm ở repo riêng
> (xem `plans/ai-integration/07-rollout.md`, Sprint 4).

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy Chi Tiết

### 1. Yêu Cầu Tiền Đề (Prerequisites)

- **[Bun](https://bun.sh/)**: v1.1.0 trở lên (runtime chính cho backend, package manager & test runner).
- **[Docker & Docker Compose](https://www.docker.com/)**: Để khởi chạy PostgreSQL 16 container.
- **Node.js**: v18+ (cần thiết để chạy GitNexus code intelligence analyzer).
- **Git**: Quản lý phiên bản mã nguồn.

---

### 2. Cấu Hình Môi Trường (.env)

Tạo hoặc kiểm tra file `backend/.env` (được cấu hình mặc định cho môi trường phát triển local):

```env
# Kết nối PostgreSQL (trỏ vào localhost:5432 hoặc tên container)
DATABASE_URL="postgresql://postgres:password123@localhost:5432/qcheck?schema=public"

# Khóa bí mật ký JWT (bắt buộc trong môi trường production)
JWT_SECRET="qcheck_super_secret_jwt_key_2026_production_grade"

# Cổng lắng nghe của máy chủ backend
PORT=3000

# Google Gemini AI (Tùy chọn cho Live Q&A clustering và Quiz Generation)
# Nếu không cung cấp, server vẫn hoạt động bình thường, endpoint AI trả 503 AI_NOT_CONFIGURED
# GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-flash-latest
# GEMINI_TIMEOUT_MS=45000
# GEMINI_MAX_OUTPUT_TOKENS=16384
```

---

### 3. Khởi Chạy Cơ Sở Dữ Liệu (PostgreSQL 16)

Khởi chạy container PostgreSQL từ thư mục gốc của dự án:

```bash
# Khởi chạy PostgreSQL nền ngầm
docker compose up -d postgres

# Kiểm tra trạng thái container và cổng kết nối 5432
docker compose ps
```

> **Lưu ý**: Cặp khóa mật mã học RSA 2048 (`private.pem`, `public.pem`) dùng để ký và xác thực Dynamic QR JWT sẽ được backend tự động khởi tạo trong thư mục `backend/keys/` ngay lần đầu khởi chạy nếu chưa tồn tại.

---

### 4. Cài Đặt & Thiết Lập Backend

Di chuyển vào thư mục `backend` và thực hiện tuần tự các bước:

```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Cài đặt các dependencies
bun install

# 3. Đồng bộ Prisma Schema vào cơ sở dữ liệu PostgreSQL
bun run db:push

# 4. Nạp dữ liệu mẫu ban đầu (Seeding Organizer, Staff, Event, Ticket)
bun run db:seed

# 5. Khởi chạy máy chủ phát triển (Hỗ trợ hot-reload qua Bun)
bun run dev
```

Máy chủ ElysiaJS sẽ lắng nghe tại: **`http://localhost:3000`**.

---

### 5. Kiểm Thử Hệ Thống (Unit & Integration Tests)

Bộ test của `qEvent` được viết bằng Bun Test Suite (kiểm thử thuật toán RSA TOTP, quy trình soát vé online/offline, máy trạng thái game quiz, và AI fallback):

```bash
# Chạy toàn bộ test suite (yêu cầu cơ sở dữ liệu đã seed)
bun test

# Chạy riêng file test cụ thể
bun test test/flow.test.ts
bun test test/crypto.test.ts
```

---

### 6. Frontend Mobile (Expo / React Native)

Thư mục `app/` đã được tách sang repository riêng ở commit `0270a5d` để tối ưu hóa chu kỳ phát hành mobile độc lập. 
- Khi phát triển giao diện mobile, trỏ base URL của client về `http://<IP_MAY_TINH>:3000` (hoặc localhost qua emulator).
- Xem chi tiết kiến trúc và lộ trình tại `plans/ai-integration/07-rollout.md` (Sprint 4).

---

### 7. Quy Trình Tạo Nhánh Mới & Quản Lý Mã Nguồn (Git Workflow)

Để bảo đảm tính ổn định tuyệt đối của nhánh chính (`main`), mọi tính năng mới (`feat`) hoặc sửa lỗi (`fix`) **bắt buộc phải được thực hiện trên nhánh độc lập**:

#### Bước 1: Đồng bộ mã nguồn mới nhất từ nhánh `main`
```bash
git checkout main
git pull origin main
```

#### Bước 2: Tạo và chuyển sang nhánh mới
Đặt tên nhánh theo chuẩn:
- **Tính năng mới**: `feat/<tên-tính-năng>` (ví dụ: `feat/bulk-transfer`, `feat/offline-sync-v2`)
- **Sửa lỗi**: `fix/<tên-lỗi>` (ví dụ: `fix/qr-clock-skew`, `fix/db-connection-leak`)
- **Tái cấu trúc**: `refactor/<tên-mô-đun>`

```bash
git checkout -b feat/<tên-tính-năng>
```

#### Bước 3: Phát triển với kỷ luật GitNexus & Ponytail
1. **Phân tích tác động** trước khi sửa bất kỳ hàm/symbol nào:
   `impact({ repo: "qEvent", target: "<tên_symbol>", direction: "upstream" })`
2. **Áp dụng kỷ luật Ponytail**: Viết ít code nhất, không thêm abstraction thừa, tận dụng code có sẵn.
3. **Chạy kiểm thử**: Đảm bảo toàn bộ test case đều pass:
   ```bash
   cd backend && bun test
   ```
4. **Kiểm tra sai khác**: Đảm bảo chỉ ảnh hưởng các symbol mong muốn so với `main`:
   `detect_changes({ repo: "qEvent", scope: "compare", base_ref: "main" })`

#### Bước 4: Commit và đẩy nhánh lên Remote
Sử dụng chuẩn [Conventional Commits](https://www.conventionalcommits.org/):
```bash
git add .
git commit -m "feat(tickets): thêm API chuyển nhượng vé hàng loạt"
git push -u origin feat/<tên-tính-năng>
```
Sau đó tạo Pull Request (PR) vào `main` để tiến hành review và merge.

---

## 🔑 Tài Khoản Thử Nghiệm Mẫu

Tài khoản seed mẫu dùng cho API và kiểm thử (mật khẩu chung: `password123`):

| Vai trò | Email | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Khách tham dự (Attendee)** | `attendee@qevent.com` | `password123` | Xem vé, hiển thị Dynamic QR 30s, gửi câu hỏi Live Q&A |
| **Nhân viên soát vé (Staff)** | `staff1@qevent.com` | `password123` | Quét vé Camera, nhận diện Online/Offline, đồng bộ vé |
| **Ban tổ chức (Organizer)** | `organizer@qevent.com` | `password123` | Quản trị và giám sát soát vé, Sandbox purchase |

---

## 🛡️ Đảm Bảo Tiêu Chuẩn Kỹ Thuật (Acceptance Criteria)

1. **Dynamic QR Bảo mật**: Mã QR sinh chuỗi JWT ký số RS256 và mã TOTP 30s. Mã cũ sau 60s bị từ chối với màn hình Đỏ.
2. **Kiểm soát Trùng lặp tức thì**: Quét lần 1 trả về màn hình **Xanh** (`#10B981`) + âm chuông "ting" + 1 nhịp rung nhẹ; quét lại lần 2 lập tức ra màn hình **Vàng** (`#F59E0B`) + 2 nhịp rung báo "VÉ ĐÃ QUÉT TRƯỚC ĐÓ".
3. **Chống chụp/quay lén màn hình**: Tự động bật `expo-screen-capture` bảo vệ giao diện vé Dynamic QR.
4. **Vận hành Ngoại tuyến (Offline-First)**: Tự động lưu cache và hàng đợi scan vào `expo-sqlite`. Khi có mạng trở lại, tự động đối soát và phân giải xung đột theo dấu thời gian `scannedAt`.
5. **Chuẩn UI/UX Light Theme**: 100% tuân thủ `borderWidth: 0`, phân tầng thị giác bằng `bottom drop shadow` và bề mặt phẳng tương phản cao, không sử dụng hiệu ứng làm mờ (No Blur).

---

## 🤖 Quy Trình Phát Triển Với AI Agent

Dự án này tích hợp sẵn bộ 3 công cụ phát triển chuyên sâu cho AI coding assistants (Antigravity, Claude, Cursor, Copilot). **Tất cả thành viên và agent phải tuân thủ nghiêm ngặt:**

1. **GitNexus (Code Intelligence & Safety)**:
   - **Bắt buộc** chạy phân tích mức độ ảnh hưởng trước khi sửa bất kỳ symbol nào: `impact({ target: "symbolName", direction: "upstream" })`. Cảnh báo ngay nếu rủi ro HIGH/CRITICAL.
   - **Bắt buộc** chạy `detect_changes()` trước khi tạo commit.
   - Tìm kiếm luồng thực thi bằng `query` và `context` thay vì grep chuỗi thô.
   - Cập nhật chỉ mục đồ thị mã nguồn: `node .gitnexus/run.cjs analyze`

2. **Ponytail (Minimalist Senior Dev Discipline)**:
   - Nguyên tắc: Code ít nhất mà giải quyết trọn vẹn bài toán.
   - Tận dụng tối đa thư viện có sẵn (Bun, Prisma, Elysia), cấm tuyệt đối viết boilerplate hoặc wrapper thừa thãi.
   - Luôn kết thúc bằng 1-2 dòng nêu rõ những gì đã bỏ qua và rủi ro/giới hạn cần biết.

3. **Impeccable (UI/UX Craft Floor - Khi làm Frontend/UI)**:
   - Nạp ngữ cảnh UI: `.agent/skills/impeccable/scripts/impeccable.cmd context` (hoặc đọc trực tiếp `PRODUCT.md` và `DESIGN.md`).
   - Ràng buộc bất biến: Light Theme, `borderWidth: 0`, bóng đổ đáy (bottom drop shadow), không blur/glassmorphism, phản hồi đa giác quan (âm thanh + rung haptic).
   - Lệnh điều khiển: `/impeccable shape`, `/impeccable polish`, `/impeccable audit`, `/impeccable harden`.

👉 **Xem hướng dẫn chi tiết và mẫu câu nhắc sẵn dùng tại [PROMPTING.md](file:///d:/outsourced/qCheck/PROMPTING.md)**.
