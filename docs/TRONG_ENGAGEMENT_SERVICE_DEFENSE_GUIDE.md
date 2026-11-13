# 🎓 CẨM NANG BẢO VỆ ĐỒ ÁN MICROSERVICES — DÀNH RIÊNG CHO TRỌNG (ENGAGEMENT SERVICE)

> **Thành viên:** Trọng  
> **Module phụ trách:** `services/engagement-service/` (Port 3003) & Bộ Postman Collection kiểm thử lỗi liên service.  
> **Cơ sở dữ liệu:** PostgreSQL riêng `qevent_engagement` (Port 5435).

---

## 1. TỔNG QUAN VAI TRÒ & ĐÓNG GÓP CỦA BẠN TRONG DỰ ÁN

Khi hội đồng hỏi: *"Trọng phụ trách phần nào trong nhóm 4 người?"*, trả lời:

> *"Dạ thưa Thầy/Cô, em chịu trách nhiệm xây dựng **Engagement Service** chạy ở cổng 3003 và cơ sở dữ liệu độc lập `qevent_engagement`. Dịch vụ này đảm nhiệm toàn bộ tính năng tương tác thời gian thực tại sự kiện:*
> 1. *Hệ thống đặt câu hỏi Live Q&A và bình chọn Upvote (idempotent toggle).*
> 2. *Hệ thống thăm dò ý kiến khán giả (Interactive Polls) với khả năng chuyển đổi lựa chọn bỏ phiếu.*
> 3. *Động cơ trò chơi Kahoot-like Live Quiz Game vận hành bằng máy trạng thái Compare-And-Set (CAS) cùng cơ chế chống gian lận điểm số và thời gian phản hồi.*
> 4. *Tích hợp giao tiếp liên microservice tin cậy với Admission Service để thực thi quy tắc nghiệp vụ BR-6 (chỉ người đã check-in mới được tương tác).*
> 5. *Đồng thời, em là người tổng hợp bộ Postman Collection gồm 36 request phủ cả 3 service (chạy qua API Gateway, xác thực bằng JWT) và script đo lỗi phân tán `scripts/fault-injection.ts` cho cả nhóm."*

---

## 2. KIẾN TRÚC & MÔ HÌNH DỮ LIỆU CỦA ENGAGEMENT SERVICE

### 2.1. Độc lập dữ liệu (Database-per-Service)
- Engagement Service sở hữu riêng DB `qevent_engagement`, tuyệt đối **không tạo Foreign Key** xuyên sang database của Event Service hay Admission Service.
- Các liên kết liên service (như `sessionId`, `userId`, `eventId`) chỉ lưu trữ dưới dạng UUID `String`.

### 2.2. Các thực thể chính
1. `QAQuestion`: Quản lý câu hỏi khán giả gửi lên, có trường `upvotes` và quan hệ 1-N với `QAVote`.
2. `QAVote`: Bảng quan hệ với ràng buộc duy nhất `@@unique([questionId, userId])` đảm bảo một người không thể upvote 2 lần.
3. `Poll` & `PollOption`: Quản lý câu hỏi khảo sát và các phương án lựa chọn kèm số lượng vote `voteCount`.
4. `PollVote`: Ràng buộc `@@unique([optionId, userId])` hỗ trợ cơ chế unvote (bỏ chọn) hoặc đổi lựa chọn.
5. `QuizGame`: Quản lý ván đấu với trường `status` và `currentQuestionIndex`.
6. `QuizQuestion`: Câu hỏi trắc nghiệm, các lựa chọn `options: String[]`, chỉ số đáp án đúng `correctOption: Int`, thời gian giới hạn `timeLimitSec` và mốc thời gian bắt đầu câu hỏi `questionStartedAt`. Ràng buộc `@@unique([gameId, orderNum])` chống xung đột số thứ tự câu hỏi.
7. `QuizAnswer`: Lưu câu trả lời của thí sinh kèm điểm số tính toán server-side và thời gian phản hồi thực tế `responseTimeMs`. Ràng buộc `@@unique([questionId, userId])` chống nộp bài trùng.

---

## 3. CÁC CÂU HỎI VẤN ĐÁP "TỦ" & HƯỚNG DẪN TRẢ LỜI ĐẠT ĐIỂM TỐI ĐA

### ❓ Câu 1: Tại sao Engagement Service cần gọi Admission Service khi người dùng đặt câu hỏi hoặc chơi Quiz?
> **Trả lời:**  
> *"Dạ, để bảo đảm quy tắc nghiệp vụ cốt lõi **BR-6**: Khán giả chỉ có quyền đặt câu hỏi, bình chọn và chơi Quiz khi đã thực sự có mặt và điểm danh (check-in) tại sự kiện.  
> Do tuân thủ nguyên tắc cô lập dữ liệu (Database-per-Service), Engagement Service không được phép truy vấn trực tiếp bảng `Ticket` của Admission Service. Vì vậy, Engagement Service gọi qua endpoint nội bộ `GET /internal/tickets/verify-access?userId=...&eventId=...` kèm Header bảo mật `x-service-token`.  
> Để tối ưu hiệu năng và tránh làm nghẽn Admission Service, em đã thiết kế thêm một tầng cache in-memory TTL 60 giây. Sau lần kiểm tra đầu tiên, kết quả check-in được lưu tạm trong bộ nhớ, các câu hỏi hoặc lượt vote tiếp theo sẽ được xử lý trong < 1ms."*

---

### ❓ Câu 2: Trong Quiz Game, các bạn giải quyết tranh chấp trạng thái (Race Condition) và đồng thời (Concurrency) như thế nào?
> **Trả lời:**  
> *"Dạ, em áp dụng kỹ thuật **Compare-And-Set (CAS)** thông qua câu lệnh cập nhật có điều kiện `updateMany` của Prisma:  
> Khi Host bấm Start hoặc Next:  
> ```typescript
> const res = await tx.quizGame.updateMany({
>   where: { id: game.id, status: 'WAITING' },
>   data: { status: 'QUESTION_ACTIVE', currentQuestionIndex: 0 }
> });
> if (res.count !== 1) return 409_INVALID_GAME_STATE;
> ```
> Nếu 2 Host cùng mở 2 trình duyệt và bấm Start hoặc Next cùng 1 thời điểm, chỉ đúng 1 request đầu tiên cập nhật thành công (count = 1), request thứ hai sẽ nhận count = 0 và hệ thống lập tức trả về lỗi `409 Conflict - INVALID_GAME_STATE` thay vì làm ván đấu bị nhảy cóc hoặc reset thời gian của thí sinh."*

---

### ❓ Câu 3: Làm thế nào để ngăn chặn gian lận điểm số (Speed-Hack & Spoofing) trong Live Quiz?
> **Trả lời:**  
> *"Dạ, hệ thống áp dụng nguyên tắc **'Server sở hữu thời gian và danh tính (Server Authoritative)'**:
> 1. **Chống gian lận thời gian (Anti-Speed-Hack)**: Client có thể gửi `responseTimeMs: 0` trong payload để giả mạo việc trả lời nhanh nhằm lấy điểm tối đa. Tuy nhiên, server hoàn toàn phớt lờ số đo này và tự tính toán:  
>    `elapsedMs = now() - questionStartedAt`.  
>    Điểm số được tính bằng công thức Kahoot: `score = Math.round(1000 * (1 - responseTimeMs / (2 * timeLimitMs)))`.  
>    Nếu thí sinh gửi sau khi hết thời gian cộng thêm 2000ms dung sai mạng (grace period), server từ chối với mã `400 ANSWER_TOO_LATE`.
> 2. **Chống giả mạo danh tính (Anti-Spoofing)**: Server không tin trường `userId` trong body mà luôn lấy danh tính đã được xác thực từ JWT Token (hoặc Header `x-user-id` do API Gateway chuyển tiếp).
> 3. **Bảo mật WebSocket**: Em đã loại bỏ nhánh nộp bài qua WebSocket và chỉ cho phép nộp qua REST API `POST /api/game/:id/answer`. WebSocket chỉ dùng để broadcast trạng thái ván đấu một chiều tới khán giả."*

---

### ❓ Câu 4: Kết quả thử nghiệm kịch bản lỗi khi sập microservice cho thấy điều gì?
> **Trả lời:**  
> *"Dạ, nhóm đã đo lại trên Docker Compose thật (gateway `:8000` + 3 service + 3 database) bằng script `scripts/fault-injection.ts`: mỗi lượt gọi 20 lần `GET /api/tickets/my` và 6 lần `POST /api/checkins` qua gateway, dùng JWT STAFF ký cục bộ để đo được cả khi Admission đã tắt. Số liệu đo ngày 2026-11-13 trên máy dev:*
>
> | Kịch bản | `GET /api/tickets/my` (20 request) | `POST /api/checkins` (6 request, QR cố tình sai) | Health |
> |---|---|---|---|
> | Bình thường | p50 **4.4ms**, p95 **9.5ms**, 20/20 HTTP 200 | p50 **2.8ms**, p95 **4.4ms**, 6/6 HTTP 400 | cả 3 service `ok` |
> | Tắt `engagement-service` | p50 **3.4ms**, p95 **10.2ms**, 20/20 HTTP 200 | p50 **2.1ms**, p95 **3.4ms**, 6/6 HTTP 400 | `engagement: unreachable`, còn lại `ok` |
> | Tắt `admission-service` | p50 **1054ms**, p95 **2007.5ms**, 20/20 HTTP 504/503 | 6/6 HTTP 503, p95 **0.6ms** | `admission: OPEN` / `unreachable` |
>
> *Đọc số liệu:*
> - **Cô lập lỗi:** tắt Engagement không làm chậm hay hỏng luồng soát vé của Admission; p95 vẫn ~10ms và 100% request trả đúng nghiệp vụ (200/400).
> - **Phân biệt lỗi:** 5 request đầu khi Admission chết trả `504 GATEWAY_TIMEOUT` sau ~2s; khi Circuit Breaker đủ ngưỡng `volumeThreshold=5` thì chuyển **OPEN** và các request sau trả `503` trong dưới 1ms. Vì vậy p50 ~1s phản ánh các lần timeout, còn đuôi nhanh <1ms phản ánh fail-fast.
> - **Không biến lỗi hạ tầng thành 403:** khi Admission chết, gọi đúng BR-6 trả `503`/`504` sau ~1.0s (`INTERNAL_TIMEOUT_MS=1000`, không retry để không vượt timeout 2s của gateway), tuyệt đối không trả `403 NOT_CHECKED_IN`.
> - Raw JSON của lượt đo: `docs/evidence/fault-availability-*.json`.
>
> *Cách tái lập (đã có trong repo):*
> ```bash
> docker compose up -d
> bun scripts/fault-injection.ts baseline
> docker compose stop engagement-service
> bun scripts/fault-injection.ts engagement-down
> docker compose start engagement-service
> docker compose stop admission-service
> bun scripts/fault-injection.ts admission-down
> docker compose start admission-service
> ```"*

---

## 4. DANH MỤC TÀI LIỆU & TEST SUITE BẠN ĐÃ XÂY DỰNG

1. **Mã nguồn Service**: `services/engagement-service/`
   - Framework: **ElysiaJS** trên runtime **Bun**.
   - Database: PostgreSQL với Prisma ORM (`prisma/schema.prisma` và `prisma/seed.ts`).
   - Module: `qa.routes.ts`, `poll.routes.ts`, `game.routes.ts`, `ws.routes.ts`.
   - Tiện ích tin cậy: `resilient-fetch.ts` (timeout cấu hình được, không retry 4xx).
   - Module liên service: `admission-client.ts` (xác thực vé check-in, chỉ cache kết quả dương 60s để không khóa người vừa check-in) và `event-client.ts` (đọc `eventId` + `isLive` từ Event Service).
   - Guard BR-6 tập trung: `lib/br6.ts` — session phải tồn tại, đang live, và Admission phải xác nhận check-in; lỗi hạ tầng trả 503, không trả 403.
   - WebSocket bắt buộc JWT (`?token=` hoặc subprotocol `bearer,<jwt>`); gateway và service đều kiểm tra độc lập.
2. **Bộ kiểm thử toàn diện (Unit & Security Tests)**:
   - `test/health.test.ts`: Kiểm tra health probe và degraded state.
   - `test/qa.test.ts`: Kiểm tra luồng đăng câu hỏi, chặn người chưa check-in, toggle upvote.
   - `test/poll.test.ts`: Kiểm tra phân quyền tạo poll (Host only), bỏ phiếu, chuyển đổi lựa chọn.
   - `test/game.test.ts`: Kiểm tra toàn bộ vòng đời ván đấu Kahoot từ WAITING đến FINISHED.
   - `test/game-security.test.ts`: Kiểm tra các kịch bản tấn công giả mạo danh tính, speed-hack, race condition CAS.
3. **Bộ tài liệu Postman Collection (chạy qua API Gateway)**:
   - `postman/qEvent_Microservices.postman_collection.json`: 36 request, 8 folder — Auth, Health, Events, Orders/Tickets/Check-in, Q&A, Polls, Quiz, Negative cases. Dùng `Authorization: Bearer <JWT>`; script trong từng request tự lưu token và id vào collection variables.
   - `postman/qEvent_Local.postman_environment.json`: trỏ `http://localhost:8000`, chứa sẵn id seed (`eventId`, `sessionId`, `ticketTypeId`) và tài khoản demo.
   - Không dùng header `x-user-id` thủ công: gateway xóa header này trước khi chuyển tiếp và chỉ tin JWT đã xác thực.
