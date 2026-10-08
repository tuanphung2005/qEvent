# ĐẶC TẢ KỸ THUẬT HỆ THỐNG qEvent (QUICKEVENT) - MVP

Tài liệu đặc tả kiến trúc kỹ thuật và cẩm nang triển khai MVP (Technical Implementation Guide) cho ứng dụng **qEvent (QUICKEVENT)** – Hệ thống Quản trị & Soát vé Sự kiện Tức thời.
Tài liệu được thiết kế riêng cho **Coding Agent (Gemini 3.8 Flash)** với techstack:
- **Backend**: PostgreSQL + Prisma ORM + ElysiaJS (Bun).
- **Mobile**: React Native + Expo (Expo Router, Expo SDK) + Hệ thống UI Light Theme chuyên biệt (Borderless, Bottom Drop Shadow, No Blur).

---

## 1. Nguyên Tắc Thiết Kế Giao Diện (UI/UX Guidelines - Bắt Buộc)

Mọi màn hình và component trên mobile app **qEvent** phải tuân thủ nghiêm ngặt 4 nguyên tắc cốt lõi:

1. **Light Theme Only (Giao diện sáng toàn phần)**:
   - Nền chính (Background): `#F8FAFC` (Slate-50) hoặc `#FFFFFF`.
   - Bề mặt Card / Sheet: `#FFFFFF` nguyên bản.
   - Text & Icon: `#0F172A` (Slate-900) cho tiêu đề, `#475569` (Slate-600) cho nội dung, `#94A3B8` (Slate-400) cho chú thích.
   - Màu nhận diện / Tương tác: Primary Blue/Indigo (`#2563EB`), Success Emerald (`#10B981`), Warning Amber (`#F59E0B`), Error Red (`#EF4444`).

2. **No Border At All (Tuyệt đối không sử dụng viền)**:
   - `borderWidth: 0` trên toàn bộ Card, Button, Input, BottomSheet, Dialog, TabBar và Badge.
   - Không dùng soft border, hairline border hay outline mờ.
   - Phân cấp nội dung bằng khoảng cách (spacing), sự tương phản khối màu phẳng (flat surface contrast) và hiệu ứng đổ bóng.

3. **Bottom Drop Shadow (Đổ bóng đáy phân tầng)**:
   - Không đổ bóng đều 4 cạnh; chỉ sử dụng drop shadow hướng xuống dưới để tạo cảm giác nổi tự nhiên (elevation) cho Card, Nút bấm nổi và Bottom Bar:
   ```ts
   // Chuẩn Shadow Tokens cho qEvent
   export const shadows = {
     card: {
       shadowColor: '#000000',
       shadowOffset: { width: 0, height: 4 },
       shadowOpacity: 0.07,
       shadowRadius: 10,
       elevation: 3,
     },
     floating: {
       shadowColor: '#000000',
       shadowOffset: { width: 0, height: 8 },
       shadowOpacity: 0.12,
       shadowRadius: 16,
       elevation: 6,
     },
   };
   ```

4. **No Blur (Không hiệu ứng làm mờ / Không Glassmorphism)**:
   - Không sử dụng `expo-blur`, `BlurView` hay lớp phủ mờ đục.
   - Mọi overlay/modal sử dụng nền bán trong suốt phẳng (`rgba(15, 23, 42, 0.45)`) mà không có filter mờ nền phía sau.

---

## 2. Cấu Trúc Thư Mục Dự Án (Monorepo Standard - Expo First)

Ưu tiên 100% các giải pháp từ hệ sinh thái Expo (`expo-*`) để giải quyết vấn đề, sử dụng **Expo Router** cho cơ chế điều hướng File-based routing.

```text
qevent/
├── backend/                      # ElysiaJS + Prisma + PostgreSQL (Bun Runtime)
│   ├── prisma/
│   │   ├── schema.prisma         # Data models & Enums
│   │   └── seed.ts               # Dữ liệu ban đầu (Organizer, Staff, Event, Ticket)
│   ├── src/
│   │   ├── config/               # RSA keys, env validation
│   │   ├── plugins/              # Prisma client, JWT auth decorators
│   │   ├── modules/
│   │   │   ├── auth/             # Login, JWT issuing
│   │   │   ├── tickets/          # Purchase sandbox, Dynamic QR generation
│   │   │   ├── checkin/          # Online verify, Offline sync, Conflict resolution
│   │   │   └── realtime/         # Elysia WebSocket (Live Q&A, Polling)
│   │   └── index.ts              # Server entrypoint
│   ├── package.json
│   └── tsconfig.json
├── mobile/                       # Expo SDK (React Native) - qEvent Client
│   ├── app/                      # File-based Routing (expo-router)
│   │   ├── _layout.tsx           # Root Provider Layout (Fonts, AuthProvider)
│   │   ├── index.tsx             # Redirect / Splash router
│   │   ├── (auth)/               # Auth Flow
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx         # Màn hình đăng nhập
│   │   ├── (attendee)/           # Khách tham dự Stack/Tabs
│   │   │   ├── _layout.tsx       # Tab Bar (Light, Bottom shadow, borderless)
│   │   │   ├── tickets.tsx       # Danh sách vé
│   │   │   ├── ticket/[id].tsx   # Chi tiết vé: Dynamic QR (30s TOTP)
│   │   │   └── qa.tsx            # Live Q&A tương tác thời gian thực
│   │   └── (staff)/              # Nhân viên soát vé Stack
│   │       ├── _layout.tsx
│   │       ├── scanner.tsx       # Quét vé Camera (Online/Offline)
│   │       └── sync-status.tsx   # Quản lý hàng đợi đồng bộ ngoại tuyến
│   ├── src/
│   │   ├── components/           # Component chuẩn UI (Card, Button, Header không border)
│   │   ├── context/              # AuthContext, OfflineSyncContext
│   │   ├── services/
│   │   │   ├── camera.ts         # Wrapper expo-camera
│   │   │   ├── db.ts             # Cache SQLite qua expo-sqlite
│   │   │   ├── haptics.ts        # Phản hồi rung qua expo-haptics
│   │   │   ├── sound.ts          # Âm thanh Ting qua expo-av
│   │   │   └── security.ts       # Chống chụp màn hình qua expo-screen-capture
│   │   ├── constants/            # Theme, Shadow tokens, Colors
│   │   └── api/                  # Client kết nối API Backend
│   ├── app.json                  # Cấu hình Expo
│   └── package.json
└── README.md
```

---

## 3. Thư Viện Chuẩn Expo (Ecosystem Integration)

Thay vì cài đặt các thư viện bên ngoài không tối ưu hoặc tự viết logic từ đầu, dự án tận dụng triệt để bộ thư viện của Expo:

| Nghiệp vụ | Thư viện chuẩn Expo | Vai trò & Giải pháp |
| :--- | :--- | :--- |
| **Routing & Navigation** | `expo-router` | Điều hướng file-based chuẩn, quản lý Stack, Modal, Tabs không cần boilerplate `react-navigation`. |
| **Camera & QR Scanner** | `expo-camera` (`CameraView`) | Quét mã QR tốc độ cao, hỗ trợ đa nền tảng, tích hợp trực tiếp barcode scanning. |
| **Offline Cache Database**| `expo-sqlite` | Lưu trữ danh sách vé cache và queue lịch sử check-in khi mất mạng. |
| **Secure Token Storage**  | `expo-secure-store` | Lưu trữ an toàn JWT Token và TOTP secret trên Keychain / Keystore. |
| **Phản hồi xúc giác (Haptics)** | `expo-haptics` | Báo rung đa giác quan: 1 nhịp nhẹ khi hợp lệ, 2 nhịp khi trùng vé, rung dài khi lỗi. |
| **Phản hồi âm thanh**     | `expo-av` | Phát âm thanh chuông "ting" ngay lập tức khi check-in thành công. |
| **Chống chụp màn hình**   | `expo-screen-capture` | Kích hoạt cờ chống chụp màn hình bảo vệ Dynamic QR theo chuẩn NFR-05. |
| **Giám sát kết nối mạng**| `expo-network` | Tự động phát hiện mất mạng để kích hoạt chế độ Offline-First Scanner. |
| **Mã hóa & Tiện ích ID**  | `expo-crypto` | Sinh UUID, hashing và hỗ trợ giải mã an toàn. |
| **Biểu tượng (Icons)**    | `@expo/vector-icons` | Hệ thống icons thống nhất (Ionicons / Feather / Lucide). |

---

## 4. Mô Hình Cơ Sở Dữ Liệu (Prisma Schema - PostgreSQL)

File `backend/prisma/schema.prisma` phục vụ đầy đủ các thực thể cốt lõi cho **qEvent**:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ORGANIZER
  STAFF
  ATTENDEE
  SPEAKER
}

enum TicketStatus {
  PENDING_PAYMENT
  PAID
  CHECKED_IN
  CANCELLED
}

enum SyncStatus {
  PENDING
  SYNCED
  CONFLICT
}

model User {
  id           String            @id @default(uuid())
  email        String            @unique
  passwordHash String
  fullName     String
  role         Role              @default(ATTENDEE)
  tickets      Ticket[]
  logsScanned  CheckinLog[]      @relation("StaffLogs")
  questions    QAQuestion[]
  createdAt    DateTime          @default(now())

  @@index([email])
}

model Event {
  id          String       @id @default(uuid())
  name        String
  venue       String
  startTime   DateTime
  endTime     DateTime
  maxCapacity Int
  rooms       Room[]
  sessions    Session[]
  ticketTypes TicketType[]
  tickets     Ticket[]
  createdAt   DateTime     @default(now())
}

model Room {
  id        String    @id @default(uuid())
  eventId   String
  name      String
  capacity  Int
  event     Event     @relation(fields: [eventId], references: [id])
  sessions  Session[]
}

model Session {
  id        String       @id @default(uuid())
  eventId   String
  roomId    String
  speakerId String?
  title     String
  startTime DateTime
  endTime   DateTime
  event     Event        @relation(fields: [eventId], references: [id])
  room      Room         @relation(fields: [roomId], references: [id])
  questions QAQuestion[]
}

model TicketType {
  id            String   @id @default(uuid())
  eventId       String
  name          String   // Standard, VIP, Workshop
  price         Decimal  @db.Decimal(12, 2)
  totalQuantity Int
  soldQuantity  Int      @default(0)
  event         Event    @relation(fields: [eventId], references: [id])
  tickets       Ticket[]
}

model Ticket {
  id           String       @id @default(uuid())
  eventId      String
  userId       String
  ticketTypeId String
  status       TicketStatus @default(PAID)
  totpSecret   String       // Dùng tạo động token mỗi 30s
  checkedInAt  DateTime?
  event        Event        @relation(fields: [eventId], references: [id])
  user         User         @relation(fields: [userId], references: [id])
  ticketType   TicketType   @relation(fields: [ticketTypeId], references: [id])
  checkinLogs  CheckinLog[]
  createdAt    DateTime     @default(now())

  @@index([userId, eventId])
}

model CheckinLog {
  id         String     @id @default(uuid())
  ticketId   String
  staffId    String
  scannedAt  DateTime   @default(now())
  deviceId   String
  isOffline  Boolean    @default(false)
  syncStatus SyncStatus @default(SYNCED)
  ticket     Ticket     @relation(fields: [ticketId], references: [id])
  staff      User       @relation("StaffLogs", fields: [staffId], references: [id])

  @@index([ticketId, scannedAt])
}

model QAQuestion {
  id         String   @id @default(uuid())
  sessionId  String
  userId     String
  content    String
  upvotes    Int      @default(0)
  isAnswered Boolean  @default(false)
  createdAt  DateTime @default(now())
  session    Session  @relation(fields: [sessionId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
}
```

---

## 5. Đặc Tả Backend (ElysiaJS + Bun API Contracts)

### 5.1. Authentication & Ticket Engine (`/api/tickets`)
* **`POST /api/auth/login`**:
  * Body: `{ email, password }`
  * Response: `{ token, user: { id, fullName, role } }`
* **`POST /api/tickets/purchase-sandbox`**: Giả lập thanh toán tức thì:
  * Body: `{ eventId: string, ticketTypeId: string, quantity: number }`
  * Cập nhật số lượng còn lại, tạo `Ticket` với mã bí mật TOTP (`crypto.randomUUID()`), trạng thái `PAID`.
* **`GET /api/tickets/my-tickets`**:
  * Trả về danh sách vé của người dùng kèm `totpSecret`.
* **Dynamic QR Specification**:
  * Mã QR chứa token ký số RSA-256:
  $$\text{Payload} = \{\text{tid}: \text{ticketId}, \text{eid}: \text{eventId}, \text{code}: \text{TOTP(secret, 30s)}, \text{iat}: \text{timestamp}\}$$
  * Token tự động đổi sau mỗi 30 giây.

### 5.2. Check-in Hybrid Engine (`/api/checkin`)
* **`GET /api/checkin/cache/:eventId`**:
  * Trả về danh sách vé hợp lệ cho thiết bị lưu vào `expo-sqlite` trước giờ soát vé.
* **`POST /api/checkin/verify` (Xác thực trực tuyến)**:
  * Body: `{ qrToken: string, deviceId: string }`
  * Logic:
    1. Kiểm tra chữ ký RSA & hạn TOTP ($\le 30\text{s}$). Nếu sai $\to$ `400 INVALID_TICKET`.
    2. Nếu `status == CHECKED_IN` $\to$ `409 ALREADY_CHECKED_IN`.
    3. Nếu `status == PAID` $\to$ Cập nhật `Ticket.status = CHECKED_IN`, lưu `CheckinLog` (`isOffline: false`) $\to$ `200 OK`.
* **`POST /api/checkin/sync` (Đồng bộ ngoại tuyến & Xử lý xung đột)**:
  * Body: `{ logs: [{ ticketId: string, scannedAt: string, deviceId: string }] }`
  * Thuật toán: Sắp xếp theo `scannedAt` tăng dần. Lượt quét đầu tiên được ghi nhận `CHECKED_IN`, các lượt quét sau có cùng `ticketId` đánh dấu `syncStatus = CONFLICT`.

### 5.3. Realtime Live Q&A Engine (Elysia WebSocket)
* Đường dẫn: `ws('/ws/qa')`
* Sự kiện client phát: `JOIN_SESSION`, `POST_QUESTION`, `UPVOTE`.
* Sự kiện server broadcast: `QUESTION_ADDED`, `VOTE_UPDATED`.

---

## 6. Đặc Tả Giao Diện Mobile qEvent (Expo Router + React Native)

### 6.1. Màn hình Khách tham dự: Dynamic QR Ticket (`app/(attendee)/ticket/[id].tsx`)
* **Phong cách UI**:
  * Thẻ vé thiết kế dạng Card trắng nền sáng (`#FFFFFF`), **không viền (`borderWidth: 0`)**.
  * Đổ bóng đáy rõ nét (`shadowOffset: { width: 0, height: 6 }`, `shadowOpacity: 0.08`, `shadowRadius: 12`, `elevation: 4`).
* **Hiển thị Dynamic QR**:
  * Dùng `react-native-qrcode-svg` render chuỗi JWT.
  * Thanh đếm ngược (Progress Bar phẳng không viền) lùi dần từ 30 về 0 giây, tự động kích hoạt tính toán chuỗi QR mới khi hết 30s.
* **Bảo vệ hiển thị**:
  * Kích hoạt `preventScreenCaptureAsync()` từ `expo-screen-capture` khi màn hình active để ngăn chụp màn hình và quay video màn hình vé.

### 6.2. Màn hình Nhân viên Soát vé (`app/(staff)/scanner.tsx`)
* **Camera Module**:
  * Sử dụng `CameraView` từ `expo-camera` với `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`.
* **Bộ nhớ đệm ngoại tuyến (Offline-First)**:
  * Khởi tạo `expo-sqlite` lưu bảng `cached_tickets` và `offline_scan_queue`.
  * Tự động nhận diện mạng qua `expo-network`. Nếu mất mạng, hệ thống chuyển mạch mượt mà sang so khớp SQLite cục bộ.
* **Hệ thống phản hồi đa giác quan (NFR-01, NFR-09, NFR-10)**:
  * **Hợp lệ (Green)**: Nền toàn màn hình chuyển sang màu xanh ngọc tươi (`#10B981`), phát âm thanh "ting" qua `expo-av`, rung 1 nhịp nhẹ qua `expo-haptics` (`notificationAsync(Success)`), phản hồi dưới 1 giây.
  * **Vé đã sử dụng / Trùng lặp (Amber)**: Nền chuyển màu vàng cam (`#F59E0B`), rung 2 nhịp (`impactAsync(Medium)` 2 lần), hiển thị thông báo "VÉ ĐÃ QUÉT TRƯỚC ĐÓ".
  * **Không hợp lệ (Red)**: Nền chuyển màu đỏ (`#EF4444`), rung dài liên tục (`notificationAsync(Error)`), hiển thị "MÃ KHÔNG HỢP LỆ HOẶC HẾT HẠN".
* **Đồng bộ hàng đợi**:
  * Hiển thị Badge đếm số lượng vé chờ sync (`Pending count`) trên góc màn hình (thiết kế phẳng, không viền, bóng đáy).
  * Nút "Đồng bộ vé" gọi `POST /api/checkin/sync` ngay khi kết nối mạng phục hồi.

---

## 7. BỘ CHỈ DẪN TUẦN TỰ CHO CODING AGENT (PROMPT ROADMAP)

### Phase 1: Khởi tạo ElysiaJS Backend, Prisma & Auth Sandbox
> **Agent Prompt 1:**
> ```text
> Vai trò: Tech Lead Backend (ElysiaJS + Prisma + PostgreSQL).
> Dự án: qEvent (QUICKEVENT) Backend.
> Nhiệm vụ: Xây dựng thư mục /backend:
> 1. Thiết lập dự án Bun với ElysiaJS, @elysiajs/cors, @elysiajs/jwt, @prisma/client, prisma.
> 2. Khởi tạo schema.prisma đầy đủ cho PostgreSQL gồm các bảng: User, Event, Room, Session, TicketType, Ticket, CheckinLog, QAQuestion.
> 3. Tạo prisma/seed.ts nạp dữ liệu mẫu ban đầu: 1 Organizer, 2 Staff, 1 Attendee, 1 Event có 3 hạng vé (Early Bird, Standard, VIP).
> 4. Viết các module API:
>    - src/modules/auth/index.ts: Đăng nhập (POST /api/auth/login), trả về JWT chứa userId và role.
>    - src/modules/tickets/index.ts: 
>      + GET /api/tickets/my-tickets: Lấy vé của user đang đăng nhập.
>      + POST /api/tickets/purchase-sandbox: Mô phỏng mua vé, sinh totpSecret và lưu bản ghi PAID.
> Yêu cầu: Code TypeScript type-safe với TypeBox validator (t), không dùng placeholder TODO.
> ```

---

### Phase 2: Engine Soát vé Hybrid (RSA Dynamic QR, Check-in Online & Offline Sync)
> **Agent Prompt 2:**
> ```text
> Tiếp tục backend qEvent. Xây dựng module Soát vé thông minh tại src/modules/checkin/:
> 1. Helper Dynamic QR: Ký mã JWT (RS256) chứa ticketId + TOTP 30s. Kèm hàm xác thực tính hợp lệ bằng Public Key.
> 2. Route GET /api/checkin/cache/:eventId: Trả về danh sách vé hợp lệ cho thiết bị staff lưu ngoại tuyến.
> 3. Route POST /api/checkin/verify: Xác thực trực tuyến. Xử lý chính xác:
>    - 400 nếu chữ ký sai hoặc mã quá hạn.
>    - 409 nếu vé đã ở trạng thái CHECKED_IN (Vé trùng lặp).
>    - 200 nếu hợp lệ, cập nhật Ticket.status = CHECKED_IN và tạo CheckinLog.
> 4. Route POST /api/checkin/sync: Nhận mảng logs từ thiết bị quét ngoại tuyến, đối soát theo thời gian scannedAt. Lượt đầu hợp lệ, lượt sau cùng ticketId đánh dấu syncStatus = 'CONFLICT'.
> 5. Viết test mẫu (Bun test) kiểm tra việc ngăn chặn check-in lặp lại 2 lần cùng một vé.
> ```

---

### Phase 3: Xây dựng Ứng dụng Di động qEvent (Expo SDK + Expo Router)
> **Agent Prompt 3:**
> ```text
> Vai trò: Senior Mobile Developer (React Native + Expo Ecosystem).
> Dự án: qEvent (QUICKEVENT) Mobile App.
> Nhiệm vụ: Khởi tạo thư mục /mobile với Expo SDK và expo-router.
> BẮT BUỘC TUÂN THỦ NGUYÊN TẮC UI:
> - Light Theme thuần túy: Nền sáng (#F8FAFC / #FFFFFF), chữ Slate tương phản cao.
> - NO BORDER AT ALL: Tuyệt đối không dùng border, viền mềm trên Card, Button, Input, Modal, TabBar (borderWidth: 0).
> - BOTTOM DROP SHADOW: Tạo độ sâu bằng shadowOffset: { width: 0, height: 4..8 }, shadowOpacity: 0.08, elevation.
> - NO BLUR: Không dùng BlurView hay hiệu ứng làm mờ.
> TẬN DỤNG THƯ VIỆN EXPO THAY VÌ VIẾT TỪ ĐẦU:
> 1. expo-router: Cấu hình phân quyền Stack/Tabs cho (auth), (attendee), (staff).
> 2. app/(attendee)/ticket/[id].tsx:
>    - Dynamic QR với react-native-qrcode-svg và bộ đếm 30s tự động refresh.
>    - Kích hoạt expo-screen-capture chống chụp màn hình.
> 3. app/(staff)/scanner.tsx:
>    - Quét mã bằng CameraView từ expo-camera.
>    - Bộ nhớ ngoại tuyến bằng expo-sqlite (lưu danh sách vé cache và hàng đợi scan).
>    - Phản hồi đa giác quan: Đổi màu nền (Xanh/Vàng/Đỏ), rung bằng expo-haptics, âm thanh Ting bằng expo-av.
>    - Giám sát mạng bằng expo-network và nút đồng bộ lên POST /api/checkin/sync.
> ```

---

### Phase 4: Elysia WebSocket Realtime Q&A & Tích hợp hoàn chỉnh
> **Agent Prompt 4:**
> ```text
> Hoàn thiện tính năng tương tác thời gian thực cho qEvent:
> 1. Backend (Elysia WebSocket):
>    - WebSocket tại src/modules/realtime/index.ts quản lý room theo sessionId.
>    - Xử lý POST_QUESTION và UPVOTE, broadcast số vote thời gian thực.
> 2. Mobile (app/(attendee)/qa.tsx):
>    - Giao diện Light theme, Card câu hỏi không border, đổ bóng đáy.
>    - Nút Upvote tương tác tức thì kết nối WebSocket.
> 3. Cung cấp file hướng dẫn chạy toàn bộ hệ thống bằng Docker Compose cho PostgreSQL và script chạy Bun cho backend, Expo cho mobile.
> ```

---

## 8. Tiêu Chuẩn Nghiệm Thu Kỹ Thuật (Acceptance Criteria)

1. **Dynamic QR Bảo mật**: Mã QR thay đổi chu kỳ 30s. Mã cũ quét sau 60s phải bị từ chối với màn hình Đỏ.
2. **Kiểm soát Trùng lặp tức thì**: Quét lần 1 ra màn hình Xanh; quét lại lần 2 lập tức ra màn hình Vàng trong thời gian $< 1$ giây.
3. **Vận hành Ngoại tuyến (Offline-First)**: Khi tắt mạng, `expo-camera` và `expo-sqlite` vẫn quét và nhận diện vé chính xác, lưu vào queue ngoại tuyến. Khi có mạng trở lại, nhấn đồng bộ ghi nhận log và gắn cờ `CONFLICT` chính xác.
4. **Chuẩn UI/UX qEvent**: Đảm bảo toàn bộ ứng dụng ở chế độ Light Theme, không có viền mềm/cứng (`borderWidth: 0`), phân cấp bằng đổ bóng đáy (`bottom drop shadow`), và không chứa bất kỳ hiệu ứng blur nào.