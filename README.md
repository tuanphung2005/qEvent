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

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Cơ Sở Dữ Liệu & Backend

```bash
# Khởi chạy PostgreSQL bằng Docker
docker compose up -d

# Hoặc sử dụng PostgreSQL có sẵn, cấu hình file backend/.env
# DATABASE_URL="postgresql://postgres:password123@localhost:5432/qevent?schema=public"

# Di chuyển vào backend
cd backend

# Cài đặt thư viện (nếu chưa cài)
bun install

# Sinh Prisma client & cập nhật schema
bun x prisma db push

# Nạp dữ liệu mẫu ban đầu (Seeding)
bun run db:seed

# Khởi chạy máy chủ backend (Port 3000)
bun run dev

# Chạy bộ unit test
bun test
```

### 2. Frontend Mobile (repo riêng)

Thư mục `app/` đã bị xoá khỏi repo này ở commit `0270a5d`. Frontend Expo/React Native được phát triển
ở repo riêng; xem Sprint 4 trong `plans/ai-integration/07-rollout.md` để biết phạm vi còn lại.

---

## 🔑 Tài Khoản Thử Nghiệm Mẫu

Tài khoản seed dùng cho API và test (mật khẩu chung `password123`):

| Vai trò | Email | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Khách tham dự (Attendee)** | `attendee@qevent.com` | `password123` | Xem vé, hiển thị Dynamic QR 30s, gửi câu hỏi Live Q&A |
| **Nhân viên soát vé (Staff)** | `staff1@qevent.com` | `password123` | Quét vé Camera, nhận diện Online/Offline, đồng bộ vé |
| **Ban tổ chức (Organizer)** | `organizer@qevent.com` | `password123` | Quản trị và giám sát soát vé |

---

## 🛡️ Đảm Bảo Tiêu Chuẩn Kỹ Thuật (Acceptance Criteria)

1. **Dynamic QR Bảo mật**: Mã QR sinh chuỗi JWT ký số RS256 và mã TOTP 30s. Mã cũ sau 60s bị từ chối với màn hình Đỏ.
2. **Kiểm soát Trùng lặp tức thì**: Quét lần 1 trả về màn hình **Xanh** (`#10B981`) + âm chuông "ting" + 1 nhịp rung nhẹ; quét lại lần 2 lập tức ra màn hình **Vàng** (`#F59E0B`) + 2 nhịp rung báo "VÉ ĐÃ QUÉT TRƯỚC ĐÓ".
3. **Chống chụp/quay lén màn hình**: Tự động bật `expo-screen-capture` bảo vệ giao diện vé Dynamic QR.
4. **Vận hành Ngoại tuyến (Offline-First)**: Tự động lưu cache và hàng đợi scan vào `expo-sqlite`. Khi có mạng trở lại, tự động đối soát và phân giải xung đột theo dấu thời gian `scannedAt`.
5. **Chuẩn UI/UX Light Theme**: 100% tuân thủ `borderWidth: 0`, phân tầng thị giác bằng `bottom drop shadow` và bề mặt phẳng tương phản cao, không sử dụng hiệu ứng làm mờ (No Blur).
