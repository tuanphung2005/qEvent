# KẾ HOẠCH TRIỂN KHAI MICROSERVICES qEvent (DÀNH CHO NHÓM 4 NGƯỜI & AI CODE AGENT)

> **File:** `plans/AI_MICROSERVICES_EXECUTION_PLAN.md`  
> **Áp dụng cho:** Nhóm 4 sinh viên & Công cụ AI Coding (Antigravity, Cursor, Claude Code, Copilot).  
> **Nguyên tắc bất biến:** Toàn bộ giải thích kỹ thuật, logic nghiệp vụ, đánh đổi kiến trúc và hướng dẫn vấn đáp được ghi đầy đủ trong file này. **TUYỆT ĐỐI KHÔNG VIẾT COMMENT GIẢI THÍCH DÔNG DÀI TRONG MÃ NGUỒN**. Code phải sạch (Clean Code), chuẩn Production, tự diễn giải thông qua TypeScript Types và cấu trúc hàm.

---

## MỤC LỤC
1. [Chỉ thị tối cao cho AI Coding](#1-chỉ-thị-tối-cao-cho-ai-coding-ai-coding-directives)
2. [Kiến trúc hệ thống & Phân công 4 thành viên](#2-kiến-trúc-hệ-thống--phân-công-4-thành-viên)
3. [Quy tắc nghiệp vụ & Mã lỗi chuẩn RESTful](#3-quy-tắc-nghiệp-vụ--mã-lỗi-chuẩn-restful)
4. [Thiết kế chi tiết từng Service (Spec & Contract)](#4-thiết-kế-chi-tiết-từng-service-spec--contract)
5. [Thiết kế luồng phân tán (Saga Distributed Flow)](#5-thiết-kế-luồng-phân-tán-saga-distributed-flow)
6. [Giao tiếp liên service tin cậy & Chống chịu lỗi](#6-giao-tiếp-liên-service-tin-cậy--chống-chịu-lỗi)
7. [Container hóa (Docker Compose 1 Lệnh)](#7-container-hóa-docker-compose-1-lệnh)
8. [Kịch bản thử nghiệm lỗi & Thu thập số liệu](#8-kịch-bản-thử-nghiệm-lỗi--thu-thập-số-liệu)
9. [Cẩm nang trả lời vấn đáp bảo vệ cho từng thành viên](#9-cẩm-nang-trả-lời-vấn-đáp-bảo-vệ-cho-từng-thành-viên)
10. [Lộ trình từng bước (Step-by-Step AI Implementation Checklist)](#10-lộ-trình-từng-bước-step-by-step-ai-implementation-checklist)

---

## 1. CHỈ THỊ TỐI CAO CHO AI CODING (AI CODING DIRECTIVES)

Khi bất kỳ AI Agent nào đọc file này để sinh code, AI **BẮT BUỘC** tuân thủ các quy tắc sau:

1. **KHÔNG CHÈN COMMENT GIẢI THÍCH VÀO CODE:**
   - ❌ CẤM: `// Hàm này dùng để xác thực người dùng...`
   - ❌ CẤM: `// Bước 1: Lấy dữ liệu từ database...`
   - ❌ CẤM: `// TODO: Giải thích cho sinh viên hiểu cách hoạt động...`
   - ✔️ ĐƯỢC PHÉP: JSDoc ngắn gọn mô tả tham số/kiểu dữ liệu nếu thực sự cần thiết cho IDE type-hint, hoặc giữ lại comment mã hóa RSA / cryptographic constants.
2. **CHUẨN CÔNG NGHỆ NHẤT QUÁN:**
   - Runtime: **Bun** (v1.1+).
   - Framework: **ElysiaJS**.
   - ORM: **Prisma** (v6.x).
   - Cơ sở dữ liệu: **PostgreSQL 16**.
   - HTTP Client liên service: Native `fetch` bọc trong module `resilientFetch` (Timeout + Retry) + `opossum` (Circuit Breaker).
   - Sinh tài liệu: `@elysiajs/swagger` cho từng service.
3. **NGUYÊN TẮC CÔ LẬP MICROSERVICES (DATABASE-PER-SERVICE):**
   - Mỗi service có thư mục riêng, `package.json` riêng, `prisma/schema.prisma` riêng và kết nối tới database độc lập.
   - Tuyệt đối **KHÔNG CÓ FOREIGN KEY** xuyên database. Quan hệ liên service chỉ liên kết thông qua UUID kiểu `String`.

---

## 2. KIẾN TRÚC HỆ THỐNG & PHÂN CÔNG 4 THÀNH VIÊN

Hệ thống gồm **1 API Gateway** và **3 Business Services** độc lập:

```text
                                [ Client / Postman ]
                                         │
                                         ▼ (Port 8000)
                    ┌──────────────────────────────────────────┐
                    │          API Gateway (TV 1)              │
                    │  - Reverse Proxy (ElysiaJS)              │
                    │  - JWT Verification (+0.25đ)             │
                    │  - Circuit Breaker (+0.25đ)              │
                    └────┬───────────────┬────────────────┬────┘
                         │               │                │
     ┌───────────────────┘               │                └───────────────────┐
     ▼ (Port 3001)                       ▼ (Port 3002)                        ▼ (Port 3003)
┌───────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│  Event Service (TV 2) │   │ Admission Service (TV 3)│   │Engagement Service (TV 4)│
│  - Events, Rooms      │   │ - Auth & User Accounts  │   │ - Live Q&A, Upvotes     │
│  - TicketTypes        │   │ - Ticket Orders (Saga)  │   │ - Polls, Voting         │
│  - Reservations       │   │ - Dynamic QR (RSA/TOTP) │   │ - Live Quiz Engine (WS) │
│                       │   │ - Check-in & Offline CAS│   │                         │
└───────────┬───────────┘   └────────────┬────────────┘   └────────────┬────────────┘
            │                            │ (HTTP Resilient)            │ (HTTP Verify)
            │                            │◄────────────────────────────┘
            │ (Atomic Reservation)       │
            │◄───────────────────────────┤
            ▼                            ▼                             ▼
    [ qevent_event ]            [ qevent_admission ]          [ qevent_engagement ]
      (Postgres 1)                  (Postgres 2)                  (Postgres 3)
```

### Bảng phân công trách nhiệm nhóm 4 người

| Thành viên | Module / Thành phần phụ trách | Dữ liệu quản lý | Trách nhiệm báo cáo & thi vấn đáp |
|---|---|---|---|
| **TV 1 (Lead)** | `gateway/` | Không sở hữu DB | Thiết kế kiến trúc tổng thể, API Gateway Pattern, Circuit Breaker, Demo kịch bản lỗi khi sập service. |
| **TV 2** | `services/event-service/` | DB `qevent_event`: `Event`, `Room`, `Session`, `TicketType`, `Reservation` | Nghiệp vụ quản lý sự kiện, bảo đảm sức chứa (Capacity limits), kỹ thuật xử lý tranh chấp giữ chỗ (Atomic Reservation). |
| **TV 3** | `services/admission-service/` | DB `qevent_admission`: `User`, `Order`, `Ticket`, `CheckinLog`, `IdempotencyLog` | Quản lý định danh, luồng đặt vé Saga liên service, thuật toán mã hóa Dynamic QR (RSA + TOTP), thuật toán CAS chống check-in trùng. |
| **TV 4** | `services/engagement-service/` | DB `qevent_engagement`: `QAQuestion`, `QAVote`, `Poll`, `PollVote`, `QuizGame`, `QuizQuestion`, `QuizAnswer` | Tương tác thời gian thực (WebSocket), xác minh quyền tham gia phiên qua liên service, tổng hợp Postman $\ge 10$ req & Slide bảo vệ. |

---

## 3. QUY TẮC NGHIỆP VỤ & MÃ LỖI CHUẨN RESTFUL

Hệ thống bắt buộc hiện thực và kiểm thử tối thiểu 6 quy tắc nghiệp vụ cốt lõi sau:

| # | Tên Quy Tắc | Mô Tả Nghiệp Vụ | Mã Lỗi HTTP | Error Code Payload |
|---|---|---|:---:|---|
| **BR-1** | Thời gian sự kiện hợp lệ | `startTime` phải diễn ra trước `endTime` và không được ở quá khứ. | `422 Unprocessable Entity` | `{"code": "INVALID_EVENT_TIME", "message": "Start time must be before end time"}` |
| **BR-2** | Hạn mức sức chứa sự kiện | Tổng số vé đã bán/giữ chỗ không được vượt quá `maxCapacity` của sự kiện hoặc `quota` của `TicketType`. | `409 Conflict` | `{"code": "SOLD_OUT", "message": "Ticket type or event capacity is exhausted"}` |
| **BR-3** | Kiểm soát Idempotency đặt vé | Cùng một `Idempotency-Key` gửi kèm payload khác nhau sẽ bị từ chối; cùng payload thì trả về kết quả đơn cũ. | `409 Conflict` | `{"code": "IDEMPOTENCY_CONFLICT", "message": "Idempotency key reused with different payload"}` |
| **BR-4** | Chống quét vé trùng (Double Check-in) | Một vé chỉ được check-in thành công đúng 1 lần duy nhất (`status` từ `PAID` sang `CHECKED_IN`). | `409 Conflict` | `{"code": "ALREADY_CHECKED_IN", "message": "Ticket has already been checked in"}` |
| **BR-5** | dynamic QR hợp lệ | Token QR phải có chữ ký số RSA-256 hợp lệ và TOTP trong khung trượt 30 giây. Quá 30s hoặc giả mạo bị từ chối. | `400 Bad Request` | `{"code": "INVALID_QR_TOKEN", "message": "Dynamic QR token expired or signature invalid"}` |
| **BR-6** | Quyền tham gia tương tác | Người dùng chỉ được đặt câu hỏi Q&A, bỏ phiếu Poll hoặc chơi Quiz khi đã check-in vào sự kiện. | `403 Forbidden` | `{"code": "NOT_CHECKED_IN", "message": "Attendee has not checked in to this event"}` |

---

## 4. THIẾT KẾ CHI TIẾT TỪNG SERVICE (SPEC & CONTRACT)

### 4.1. API Gateway (`gateway/`) — Do Thành viên 1 phụ trách
- **Cổng:** `8000` (Điểm vào công khai duy nhất cho Client/Postman).
- **Trách nhiệm:** 
  1. Proxy chuyển tiếp request đến đúng microservice theo prefix đường dẫn.
  2. Xác thực JWT tập trung: Giải mã JWT từ Header `Authorization: Bearer <token>`, trích xuất `sub` (userId), `role`, gán vào headers chuyển tiếp: `x-user-id`, `x-user-role`.
  3. Bọc circuit breaker bằng thư viện `opossum` cho từng downstream target.
  4. Cung cấp endpoint `GET /health` trả về trạng thái của Gateway và trạng thái ping tới các service con.
- **Bản đồ định tuyến (Routing Map):**
  - `/api/events/*` $\rightarrow$ `http://event-service:3001`
  - `/api/auth/*` $\rightarrow$ `http://admission-service:3002`
  - `/api/orders/*` $\rightarrow$ `http://admission-service:3002`
  - `/api/tickets/*` $\rightarrow$ `http://admission-service:3002`
  - `/api/checkins/*` $\rightarrow$ `http://admission-service:3002`
  - `/api/sessions/*` $\rightarrow$ `http://engagement-service:3003`
  - `/ws/*` $\rightarrow$ `http://engagement-service:3003` (WebSocket Upgrade)

---

### 4.2. Event Service (`services/event-service/`) — Do Thành viên 2 phụ trách
- **Cổng:** `3001` (Chỉ mở nội bộ trong mạng Docker).
- **Database:** `qevent_event`
- **Prisma Schema (`prisma/schema.prisma`):**
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  generator client {
    provider = "prisma-client-js"
  }

  model Event {
    id          String       @id @default(uuid())
    name        String
    venue       String
    startTime   DateTime
    endTime     DateTime
    maxCapacity Int
    createdAt   DateTime     @default(now())
    rooms       Room[]
    sessions    Session[]
    ticketTypes TicketType[]
  }

  model Room {
    id       String @id @default(uuid())
    eventId  String
    name     String
    capacity Int
    event    Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  }

  model Session {
    id        String   @id @default(uuid())
    eventId   String
    title     String
    speaker   String
    startTime DateTime
    endTime   DateTime
    isLive    Boolean  @default(false)
    event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  }

  model TicketType {
    id           String        @id @default(uuid())
    eventId      String
    name         String
    price        Float
    quota        Int
    soldCount    Int           @default(0)
    event        Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
    reservations Reservation[]
  }

  model Reservation {
    id           String     @id @default(uuid())
    operationId  String     @unique
    ticketTypeId String
    quantity     Int
    expiresAt    DateTime
    status       String     // PENDING, CONFIRMED, RELEASED
    createdAt    DateTime   @default(now())
    ticketType   TicketType @relation(fields: [ticketTypeId], references: [id], onDelete: Cascade)
  }
  ```
- **Endpoints RESTful:**
  1. `GET /api/events`: Lấy danh sách sự kiện (Public).
  2. `POST /api/events`: Tạo sự kiện mới (Yêu cầu `x-user-role: ORGANIZER`, kiểm tra Rule BR-1 trả `422`).
  3. `GET /api/events/:id`: Lấy chi tiết sự kiện kèm rooms & ticketTypes.
  4. `POST /internal/reservations`: **Nội bộ** – Giữ chỗ nguyên tử (Atomic Reservation). Kiểm tra `quota - soldCount >= quantity`. Nếu đủ, tạo `Reservation` và tăng `soldCount`. Nếu không đủ trả `409 SOLD_OUT`.
  5. `DELETE /internal/reservations/:operationId`: **Nội bộ** – Bù hoàn (Compensating action). Trả lại `soldCount` và đổi status sang `RELEASED`.
  6. `GET /health`: Trả về `{"status": "ok", "service": "event-service"}`.

---

### 4.3. Admission Service (`services/admission-service/`) — Do Thành viên 3 phụ trách
- **Cổng:** `3002` (Chỉ mở nội bộ trong mạng Docker).
- **Database:** `qevent_admission`
- **Prisma Schema (`prisma/schema.prisma`):**
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
  }

  enum TicketStatus {
    PENDING_PAYMENT
    PAID
    CHECKED_IN
    CANCELLED
  }

  model User {
    id           String       @id @default(uuid())
    email        String       @unique
    passwordHash String
    fullName     String
    role         Role         @default(ATTENDEE)
    createdAt    DateTime     @default(now())
    tickets      Ticket[]
    orders       Order[]
  }

  model Order {
    id             String     @id @default(uuid())
    userId         String
    eventId        String
    ticketTypeId   String
    idempotencyKey String     @unique
    operationId    String     @unique
    status         String     // PENDING, CONFIRMED, FAILED
    totalAmount    Float
    createdAt      DateTime   @default(now())
    user           User       @relation(fields: [userId], references: [id])
    tickets        Ticket[]
  }

  model Ticket {
    id           String       @id @default(uuid())
    orderId      String
    userId       String
    eventId      String
    ticketTypeId String
    status       TicketStatus @default(PAID)
    qrSecret     String
    createdAt    DateTime     @default(now())
    order        Order        @relation(fields: [orderId], references: [id])
    user         User         @relation(fields: [userId], references: [id])
    checkinLogs  CheckinLog[]
  }

  model CheckinLog {
    id         String   @id @default(uuid())
    ticketId   String
    scannedBy  String
    scannedAt  DateTime @default(now())
    isOffline  Boolean  @default(false)
    ticket     Ticket   @relation(fields: [ticketId], references: [id])
  }
  ```
- **Endpoints RESTful:**
  1. `POST /api/auth/register`: Đăng ký tài khoản (Rule: `409` nếu email trùng).
  2. `POST /api/auth/login`: Đăng nhập, trả về JWT Token.
  3. `POST /api/orders`: **Luồng nhiều bước (Saga)** – Đặt vé. Nhận `eventId`, `ticketTypeId`, `Idempotency-Key`.
  4. `GET /api/orders/:id`: Tra cứu trạng thái đơn đặt vé.
  5. `GET /api/tickets/my`: Lấy danh sách vé đã mua của tài khoản hiện tại.
  6. `GET /api/tickets/:id/qr-token`: Sinh Dynamic QR Token (RSA + TOTP 30s).
  7. `POST /api/checkins`: Soát vé online (Xác thực chữ ký RSA + TOTP, cập nhật CAS status, trả `409` nếu đã check-in).
  8. `POST /api/checkins/sync-offline`: Đồng bộ lịch sử soát vé offline kèm phát hiện xung đột.
  9. `GET /internal/tickets/verify-access`: **Nội bộ** – Cho Engagement Service kiểm tra vé của user đã check-in hay chưa.
  10. `GET /health`: Healthcheck.

---

### 4.4. Engagement Service (`services/engagement-service/`) — Do Thành viên 4 phụ trách
- **Cổng:** `3003` (Chỉ mở nội bộ trong mạng Docker).
- **Database:** `qevent_engagement`
- **Prisma Schema (`prisma/schema.prisma`):**
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  generator client {
    provider = "prisma-client-js"
  }

  model QAQuestion {
    id        String   @id @default(uuid())
    sessionId String
    userId    String
    content   String
    upvotes   Int      @default(0)
    createdAt DateTime @default(now())
    votes     QAVote[]
  }

  model QAVote {
    id         String     @id @default(uuid())
    questionId String
    userId     String
    question   QAQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
    @@unique([questionId, userId])
  }

  model Poll {
    id        String       @id @default(uuid())
    sessionId String
    title     String
    isActive  Boolean      @default(true)
    createdAt DateTime     @default(now())
    options   PollOption[]
  }

  model PollOption {
    id        String     @id @default(uuid())
    pollId    String
    content   String
    voteCount Int        @default(0)
    poll      Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
    votes     PollVote[]
  }

  model PollVote {
    id       String     @id @default(uuid())
    optionId String
    userId   String
    option   PollOption @relation(fields: [optionId], references: [id], onDelete: Cascade)
    @@unique([optionId, userId])
  }

  model QuizGame {
    id        String         @id @default(uuid())
    sessionId String         @unique
    status    String         // WAITING, ACTIVE, QUESTION_ACTIVE, FINISHED
    questions QuizQuestion[]
  }

  model QuizQuestion {
    id            String       @id @default(uuid())
    gameId        String
    orderNum      Int
    content       String
    options       String[]
    correctOption Int
    game          QuizGame     @relation(fields: [gameId], references: [id], onDelete: Cascade)
    answers       QuizAnswer[]
    @@unique([gameId, orderNum])
  }

  model QuizAnswer {
    id             String       @id @default(uuid())
    questionId     String
    userId         String
    selectedOption Int
    score          Int          @default(0)
    answeredAt     DateTime     @default(now())
    question       QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
    @@unique([questionId, userId])
  }
  ```
- **Endpoints RESTful:**
  1. `GET /api/sessions/:id/questions`: Danh sách câu hỏi Q&A của phiên.
  2. `POST /api/sessions/:id/questions`: Đặt câu hỏi (Gọi nội bộ Admission Service xác minh vé `CHECKED_IN`, nếu chưa trả `403 NOT_CHECKED_IN`).
  3. `PUT /api/questions/:id/votes`: Upvote/Unvote câu hỏi.
  4. `POST /api/polls/:id/vote`: Bỏ phiếu bình chọn.
  5. `GET /health`: Healthcheck.
  6. `WebSocket /ws/qa` & `/ws/game`: Đồng bộ câu hỏi thời gian thực và điều khiển state machine trò chơi Quiz.

---

## 5. THIẾT KẾ LUỒNG PHÂN TÁN (SAGA DISTRIBUTED FLOW)

Luồng nghiệp vụ cốt lõi trải qua $\ge 2$ microservice: **Đặt & Phát hành vé Sự kiện (Ticket Ordering Saga)**.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client / Postman
    participant GW as API Gateway (Port 8000)
    participant ADM as Admission Service (Port 3002)
    participant EVT as Event Service (Port 3001)

    Client->>GW: POST /api/orders (Idempotency-Key, eventId, ticketTypeId)
    GW->>GW: Verify JWT, đính kèm x-user-id
    GW->>ADM: Forward POST /api/orders
    
    ADM->>ADM: 1. Kiểm tra Idempotency Key trong DB
    ADM->>ADM: 2. Tạo Order với trạng thái PENDING
    
    ADM->>EVT: 3. POST /internal/reservations (operationId, ticketTypeId, qty=1)
    
    alt Trường hợp 1: Còn vé (Event Service OK)
        EVT->>EVT: Atomic: Check quota & tăng soldCount, tạo Reservation
        EVT-->>ADM: 201 Created (reservationId, status="CONFIRMED")
        ADM->>ADM: 4. Local TX: Sinh Ticket + Update Order -> CONFIRMED
        ADM-->>GW: 201 Created (orderId, tickets)
        GW-->>Client: 201 Created
    else Trường hợp 2: Hết vé (Event Service Business Error)
        EVT-->>ADM: 409 Conflict (code="SOLD_OUT")
        ADM->>ADM: Cập nhật Order -> FAILED
        ADM-->>GW: 409 Conflict
        GW-->>Client: 409 Conflict
    else Trường hợp 3: Hạ tầng lỗi / Timeout > 2000ms
        EVT--xADM: Connection Timeout / 503 Service Unavailable
        ADM->>ADM: Giữ Order ở trạng thái PENDING_RECONCILIATION
        ADM-->>GW: 202 Accepted (Location: /api/orders/:id, status="PENDING")
        GW-->>Client: 202 Accepted
        Note over ADM,EVT: Background Worker đối soát theo operationId.<br/>Nếu Event đã giữ chỗ nhưng Admission hỏng: gọi DELETE /internal/reservations hoàn tác.
    end
```

---

## 6. GIAO TIẾP LIÊN SERVICE TIN CẬY & CHỐNG CHỊU LỖI

Module `resilientFetch` được đặt tại thư mục tiện ích của từng service để gọi HTTP liên service:

### Nguyên tắc kỹ thuật:
1. **Timeout cứng:** 2000ms. Sử dụng `AbortController`.
2. **Retry có chọn lọc:**
   - Chỉ retry tối đa **2 lần** với khoảng nghỉ (backoff) 300ms.
   - **Chỉ retry lỗi hạ tầng:** Mất mạng (`ECONNREFUSED`), timeout (`ETIMEDOUT`), hoặc máy chủ đích trả về `502`, `503`, `504`.
   - **TUYỆT ĐỐI KHÔNG RETRY lỗi nghiệp vụ 4xx** (`400`, `401`, `403`, `404`, `409`, `422`).
3. **Địa chỉ Service động:**
   - Luôn đọc từ biến môi trường: `EVENT_SERVICE_URL`, `ADMISSION_SERVICE_URL`, `ENGAGEMENT_SERVICE_URL`.

---

## 7. CONTAINER HÓA (DOCKER COMPOSE 1 LỆNH)

Toàn bộ hệ thống chạy bằng một lệnh duy nhất: `docker compose up --build`.

### 7.1. Cấu trúc thư mục dự án đích
```text
qCheck/
├── gateway/
│   ├── src/
│   │   ├── index.ts
│   │   └── circuit-breaker.ts
│   ├── Dockerfile
│   ├── package.json
│   └── bun.lock
├── services/
│   ├── event-service/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── openapi.yaml
│   ├── admission-service/
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── openapi.yaml
│   └── engagement-service/
│       ├── prisma/
│       │   └── schema.prisma
│       ├── src/
│       │   ├── ws/
│       │   └── index.ts
│       ├── Dockerfile
│       ├── package.json
│       └── openapi.yaml
├── postman/
│   ├── qEvent_Microservices.postman_collection.json
│   └── qEvent_Local.postman_environment.json
├── docker-compose.yml
└── README.md
```

### 7.2. File `docker-compose.yml` chuẩn
```yaml
version: '3.8'

services:
  # --- DATABASES ---
  postgres-event:
    image: postgres:16-alpine
    container_name: qevent-db-event
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: qevent_event
    ports:
      - "5433:5432"
    volumes:
      - event_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d qevent_event"]
      interval: 3s
      timeout: 3s
      retries: 5

  postgres-admission:
    image: postgres:16-alpine
    container_name: qevent-db-admission
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: qevent_admission
    ports:
      - "5434:5432"
    volumes:
      - admission_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d qevent_admission"]
      interval: 3s
      timeout: 3s
      retries: 5

  postgres-engagement:
    image: postgres:16-alpine
    container_name: qevent-db-engagement
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: qevent_engagement
    ports:
      - "5435:5432"
    volumes:
      - engagement_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d qevent_engagement"]
      interval: 3s
      timeout: 3s
      retries: 5

  # --- MICROSERVICES ---
  event-service:
    build:
      context: ./services/event-service
      dockerfile: Dockerfile
    container_name: qevent-event-service
    environment:
      DATABASE_URL: "postgresql://postgres:password123@postgres-event:5432/qevent_event?schema=public"
      PORT: 3001
    depends_on:
      postgres-event:
        condition: service_healthy

  admission-service:
    build:
      context: ./services/admission-service
      dockerfile: Dockerfile
    container_name: qevent-admission-service
    environment:
      DATABASE_URL: "postgresql://postgres:password123@postgres-admission:5432/qevent_admission?schema=public"
      EVENT_SERVICE_URL: "http://event-service:3001"
      JWT_SECRET: "qevent_super_jwt_secret_key_2026"
      PORT: 3002
    depends_on:
      postgres-admission:
        condition: service_healthy
      event-service:
        condition: service_started

  engagement-service:
    build:
      context: ./services/engagement-service
      dockerfile: Dockerfile
    container_name: qevent-engagement-service
    environment:
      DATABASE_URL: "postgresql://postgres:password123@postgres-engagement:5432/qevent_engagement?schema=public"
      ADMISSION_SERVICE_URL: "http://admission-service:3002"
      EVENT_SERVICE_URL: "http://event-service:3001"
      PORT: 3003
    depends_on:
      postgres-engagement:
        condition: service_healthy
      admission-service:
        condition: service_started

  # --- API GATEWAY ---
  api-gateway:
    build:
      context: ./gateway
      dockerfile: Dockerfile
    container_name: qevent-api-gateway
    ports:
      - "8000:8000"
    environment:
      PORT: 8000
      JWT_SECRET: "qevent_super_jwt_secret_key_2026"
      EVENT_SERVICE_URL: "http://event-service:3001"
      ADMISSION_SERVICE_URL: "http://admission-service:3002"
      ENGAGEMENT_SERVICE_URL: "http://engagement-service:3003"
    depends_on:
      - event-service
      - admission-service
      - engagement-service

volumes:
  event_data:
  admission_data:
  engagement_data:
```

---

## 8. KỊCH BẢN THỬ NGHIỆM LỖI & THU THẬP SỐ LIỆU

Để đạt điểm tối đa mục 8 (Kiểm thử lỗi) và mục Bảo vệ (2.0 điểm Demo lỗi):

### Kịch bản 1: Tắt `event-service` khi đang thực hiện đặt vé
1. **Thiết lập:** Bật toàn bộ hệ thống. Chạy script gửi 20 request đặt vé liên tục.
2. **Kích hoạt lỗi:** Chạy `docker stop qevent-event-service`.
3. **Quan sát số liệu trước và sau:**
   - *Trước khi tắt:* 100% request thành công, mã `201 Created`, thời gian phản hồi trung bình ~45ms.
   - *Sau khi tắt:* Hệ thống không sụp đổ hoàn toàn. `admission-service` phát hiện lỗi timeout 2000ms, tự động chuyển đơn hàng sang trạng thái `PENDING` và trả về `202 Accepted` kèm Header `Location` tra cứu thay vì văng lỗi `500 Crash`.
4. **Phục hồi:** Chạy `docker start qevent-event-service`. Chạy worker đối soát, các đơn `PENDING` được xử lý xác nhận hoặc hoàn tác chuẩn xác.

### Kịch bản 2: Bật Circuit Breaker khi `engagement-service` bị quá tải/làm chậm
1. **Thiết lập:** Giả lập mạng bị trễ 3500ms tại `engagement-service`.
2. **Quan sát tại API Gateway:**
   - 5 request đầu tiên phản hồi sau 2000ms (Gateway Timeout).
   - Từ request thứ 6, Circuit Breaker chuyển sang trạng thái **OPEN**, lập tức trả về `503 Service Unavailable` chỉ trong **2ms**, bảo vệ Gateway không bị cạn kiệt tài nguyên (Connection Pool starvation).

---

## 9. CẨM NANG TRẢ LỜI VẤN ĐÁP BẢO VỆ CHO TỪNG THÀNH VIÊN

Mỗi sinh viên chuẩn bị kỹ các câu hỏi "tủ" sau để đạt điểm tuyệt đối 3.0 phần Vấn đáp:

### 👤 Thành viên 1 (API Gateway & Hạ tầng)
- **Q: Tại sao phải xác thực JWT tại API Gateway mà không để từng service làm?**  
  *A:* Áp dụng mẫu kiến trúc Centralized Authentication. Gateway đóng vai trò người gác cổng, xác thực chữ ký token một lần duy nhất, loại bỏ các request giả mạo ngay tại biên mạng. Các service bên trong chỉ cần đọc thông tin tin cậy qua Header `x-user-id` và `x-user-role`, giúp giảm tải việc giải mã token lặp lại nhiều lần.
- **Q: Circuit Breaker hoạt động ra sao và giải quyết vấn đề gì?**  
  *A:* Giải quyết hiện tượng lỗi dây chuyền (Cascading Failure). Nếu một service con bị chậm hoặc chết, các request đến Gateway sẽ bị treo hàng loạt làm cạn kiệt connection pool. Khi tỷ lệ lỗi vượt quá 50%, Circuit Breaker ngắt mạch (OPEN), từ chối ngay lập tức để service con có thời gian hồi phục.

### 👤 Thành viên 2 (Event Service)
- **Q: Tại sao không để Event Service chung Database với Admission Service?**  
  *A:* Tuân thủ nguyên lý Database-per-service của kiến trúc Microservices để đạt tính Loose Coupling (khớp nối lỏng). Dữ liệu sự kiện có thể cache mạnh và đọc nhiều (Read-heavy), trong khi dữ liệu vé và check-in ghi liên tục (Write-heavy). Tách DB giúp tối ưu chỉ mục và có thể scale độc lập tài nguyên máy chủ.
- **Q: Nếu 100 người cùng đặt 1 vé cuối cùng thì giải quyết tranh chấp (Race Condition) thế nào?**  
  *A:* Sử dụng câu lệnh cập nhật có điều kiện nguyên tử (Atomic Update with CAS): `UPDATE "TicketType" SET "soldCount" = "soldCount" + 1 WHERE id = :id AND "soldCount" < "quota"`. Chỉ đúng 1 giao dịch thực hiện thành công, 99 giao dịch còn lại nhận kết quả 0 hàng bị ảnh hưởng và lập tức trả mã lỗi `409 SOLD_OUT`.

### 👤 Thành viên 3 (Admission Service)
- **Q: Giải thích cơ chế luồng 2 bước (Saga) khi đặt vé? Nếu rớt mạng thì sao?**  
  *A:* Admission Service đóng vai trò Orchestrator. Trước khi gọi mạng sang Event Service, Admission tạo Order ở trạng thái `PENDING` kèm `operationId`. Nếu gọi Event Service bị timeout, hệ thống trả về mã `202 PENDING`. Sau đó, tiến trình đối soát nền sẽ kiểm tra lại: nếu bên Event đã trừ vé mà Admission chưa tạo được vé thì sẽ gọi API bù hoàn (`DELETE /internal/reservations`) để hoàn trả số lượng vé, tránh tình trạng mất tiền mà không có vé.
- **Q: Dynamic QR chống gian lận chụp màn hình như thế nào?**  
  *A:* Mã QR không chứa chuỗi tĩnh mà là một token JWT ký bằng khóa riêng RSA-256 kết hợp mã TOTP xoay vòng mỗi 30 giây (RFC 6238). Nếu khán giả chụp ảnh màn hình gửi cho người khác, sau 30 giây mã đó sẽ hết hạn và máy quét của Staff sẽ từ chối với mã lỗi `400 INVALID_QR_TOKEN`.

### 👤 Thành viên 4 (Engagement Service & Testing)
- **Q: Tại sao Engagement Service cần gọi Admission Service khi người dùng đặt câu hỏi?**  
  *A:* Để thực thi quy tắc nghiệp vụ BR-6: Chỉ khán giả đã check-in vào cửa mới có quyền gửi câu hỏi và bình chọn. Do Engagement không truy cập trực tiếp database của Admission, nó gọi qua endpoint nội bộ `GET /internal/tickets/verify-access` kèm cơ chế timeout 1s và cache ngắn hạn.
- **Q: Kết quả đo đạc khi tắt service thử nghiệm cho thấy điều gì?**  
  *A:* Số liệu chứng minh tính cô lập lỗi (Fault Isolation): Khi `engagement-service` hoặc `event-service` bị tắt, các chức năng quét vé tại cửa của `admission-service` vẫn hoạt động với thời gian phản hồi dưới 15ms. Hệ thống chỉ suy giảm tính năng cục bộ (Graceful Degradation) chứ không sập toàn bộ.

---

## 10. LỘ TRÌNH TỪNG BƯỚC (STEP-BY-STEP AI IMPLEMENTATION CHECKLIST)

Khi giao việc cho AI Code Agent, yêu cầu AI thực hiện tuần tự theo 6 giai đoạn sau:

- [ ] **Giai đoạn 1: Khởi tạo khung thư mục & Docker Compose**
  - Tạo cấu trúc `gateway/`, `services/event-service/`, `services/admission-service/`, `services/engagement-service/`.
  - Thiết lập `docker-compose.yml` gồm 3 container Postgres và 4 container ứng dụng.
- [ ] **Giai đoạn 2: Hiện thực Event Service (Port 3001)**
  - Viết `schema.prisma` và migrate database `qevent_event`.
  - Viết CRUD Event, Session, TicketType và logic Atomic Reservation.
  - Tích hợp `@elysiajs/swagger` xuất `openapi.yaml`.
- [ ] **Giai đoạn 3: Hiện thực Admission Service (Port 3002)**
  - Viết `schema.prisma` và migrate database `qevent_admission`.
  - Viết Auth JWT, Dynamic QR RSA+TOTP, Check-in CAS logic.
  - Viết luồng Saga gọi sang Event Service (có timeout, retry và pending state).
  - Tích hợp `@elysiajs/swagger` xuất `openapi.yaml`.
- [ ] **Giai đoạn 4: Hiện thực Engagement Service (Port 3003)**
  - Viết `schema.prisma` và migrate database `qevent_engagement`.
  - Viết Q&A, Polls, WebSocket Quiz Game và middleware kiểm tra check-in liên service.
  - Tích hợp `@elysiajs/swagger` xuất `openapi.yaml`.
- [ ] **Giai đoạn 5: Hiện thực API Gateway (Port 8000)**
  - Cấu hình định tuyến proxy cho toàn bộ endpoint và WebSocket.
  - Tích hợp xác thực JWT tập trung và Circuit Breaker `opossum`.
- [ ] **Giai đoạn 6: Kiểm thử Postman & Ghi nhận số liệu lỗi**
  - Viết file Postman Collection $\ge 12$ requests (Happy Path + 4xx error cases).
  - Chạy script đo độ trễ trước và sau khi `docker stop` một service để lấy số liệu thực tế nộp báo cáo.
