# qCheck (QUICKCHECK) - Hệ Thống Quản Trị & Soát Vé Sự Kiện Tức Thời

Hệ thống MVP giải quyết bài toán nghẽn soát vé, gian lận chụp màn hình và mất kết nối internet tại cổng sự kiện với cơ chế Dynamic QR (RSA-256 + TOTP 30s) và kiến trúc Hybrid Check-in (Online/Offline-First).

---

## 🏗️ Cấu Trúc Dự Án

```text
qCheck/
├── backend/                      # ElysiaJS + Prisma + PostgreSQL (Bun Runtime)
│   ├── prisma/
│   │   ├── schema.prisma         # Schema PostgreSQL với các thực thể cốt lõi
│   │   └── seed.ts               # Dữ liệu ban đầu (Organizer, Staff, Event, Ticket)
│   ├── src/
│   │   ├── config/keys.ts        # Thuật toán sinh khóa RSA & RFC 6238 TOTP
│   │   ├── plugins/prisma.ts     # Prisma client plugin
│   │   ├── modules/
│   │   │   ├── auth/             # POST /api/auth/login, GET /api/auth/me
│   │   │   ├── tickets/          # My tickets, Dynamic QR token, Sandbox purchase
│   │   │   ├── checkin/          # Cache route, Online verify, Offline sync
│   │   │   └── realtime/         # WebSocket /ws/qa (Live Q&A & Upvotes)
│   │   └── index.ts              # Entrypoint máy chủ ElysiaJS
│   └── test/
│       └── crypto_checkin.test.ts # Bộ kiểm thử Bun test (100% Pass)
├── app/                          # Mobile Frontend (React Native + Expo SDK 52 + Expo Router)
│   ├── app/                      # File-based Routing
│   │   ├── _layout.tsx           # Root Provider (Auth, OfflineSync, Light StatusBar)
│   │   ├── index.tsx             # Định tuyến phân quyền theo Role
│   │   ├── (auth)/login.tsx      # Đăng nhập kèm nút chuyển tài khoản nhanh
│   │   ├── (attendee)/           # Khách tham dự Stack/Tabs
│   │   │   ├── tickets.tsx       # Danh sách vé & mua Sandbox
│   │   │   ├── ticket/[id].tsx   # Dynamic QR 30s (Anti-screenshot NFR-05)
│   │   │   └── qa.tsx            # Live Q&A thời gian thực (WebSocket)
│   │   └── (staff)/              # Nhân viên soát vé
│   │       ├── scanner.tsx       # Quét vé Camera đa giác quan (Green/Amber/Red)
│   │       └── sync-status.tsx   # Quản lý hàng đợi ngoại tuyến SQLite
│   └── src/
│       ├── components/           # Card, Button, Input, Badge, Header (No Border, Bottom Shadow)
│       ├── context/              # AuthContext, OfflineSyncContext
│       ├── services/             # db (SQLite), haptics, sound (av), security (screen-capture)
│       └── constants/theme.ts    # Bảng màu Light Theme & Shadow Tokens
├── docker-compose.yml            # Khởi chạy PostgreSQL 16
└── MVP.md                        # Tài liệu đặc tả kỹ thuật MVP
```

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Cơ Sở Dữ Liệu & Backend

```bash
# Khởi chạy PostgreSQL bằng Docker
docker compose up -d

# Hoặc sử dụng PostgreSQL có sẵn, cấu hình file backend/.env
# DATABASE_URL="postgresql://postgres:password123@localhost:5432/qcheck?schema=public"

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

### 2. Frontend Mobile (Expo Router)

```bash
# Di chuyển vào thư mục frontend app
cd app

# Cài đặt thư viện
bun install

# Khởi chạy Metro Bundler
bun start

# Hoặc khởi chạy giao diện Web preview tức thì
bun run web
```

---

## 🔑 Tài Khoản Thử Nghiệm Mẫu

Hệ thống đã tích hợp sẵn các nút chọn tài khoản nhanh trên màn hình đăng nhập:

| Vai trò | Email | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Khách tham dự (Attendee)** | `attendee@qcheck.com` | `password123` | Xem vé, hiển thị Dynamic QR 30s, gửi câu hỏi Live Q&A |
| **Nhân viên soát vé (Staff)** | `staff1@qcheck.com` | `password123` | Quét vé Camera, nhận diện Online/Offline, đồng bộ vé |
| **Ban tổ chức (Organizer)** | `organizer@qcheck.com` | `password123` | Quản trị và giám sát soát vé |

---

## 🛡️ Đảm Bảo Tiêu Chuẩn Kỹ Thuật (Acceptance Criteria)

1. **Dynamic QR Bảo mật**: Mã QR sinh chuỗi JWT ký số RS256 và mã TOTP 30s. Mã cũ sau 60s bị từ chối với màn hình Đỏ.
2. **Kiểm soát Trùng lặp tức thì**: Quét lần 1 trả về màn hình **Xanh** (`#10B981`) + âm chuông "ting" + 1 nhịp rung nhẹ; quét lại lần 2 lập tức ra màn hình **Vàng** (`#F59E0B`) + 2 nhịp rung báo "VÉ ĐÃ QUÉT TRƯỚC ĐÓ".
3. **Chống chụp/quay lén màn hình**: Tự động bật `expo-screen-capture` bảo vệ giao diện vé Dynamic QR.
4. **Vận hành Ngoại tuyến (Offline-First)**: Tự động lưu cache và hàng đợi scan vào `expo-sqlite`. Khi có mạng trở lại, tự động đối soát và phân giải xung đột theo dấu thời gian `scannedAt`.
5. **Chuẩn UI/UX Light Theme**: 100% tuân thủ `borderWidth: 0`, phân tầng thị giác bằng `bottom drop shadow` và bề mặt phẳng tương phản cao, không sử dụng hiệu ứng làm mờ (No Blur).
