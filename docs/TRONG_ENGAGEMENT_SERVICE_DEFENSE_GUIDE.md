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
> 5. *Đồng thời, em là người tổng hợp toàn bộ bộ kịch bản Postman Collection gồm 16 API requests và các kịch bản kiểm thử lỗi phân tán cho cả nhóm."*

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
> *"Dạ, kịch bản thử nghiệm đã chứng minh được tính **Cô lập lỗi (Fault Isolation)** và **Suy giảm tính năng cục bộ (Graceful Degradation)**:
> - Khi tắt `engagement-service` (port 3003) hoặc `event-service` (port 3001), dịch vụ cốt lõi là `admission-service` (soát vé tại cửa) vẫn hoạt động hoàn hảo 100% với độ trễ dưới 15ms. Khán giả tại cổng vẫn check-in vào cửa bình thường mà không hề bị gián đoạn.
> - Tại API Gateway, khi một downstream service bị chết hoặc quá tải, thư viện `opossum` Circuit Breaker sẽ ngắt mạch (chuyển sang trạng thái OPEN) sau 5 lần lỗi liên tiếp, lập tức phản hồi `503 Service Unavailable` chỉ trong 2ms để bảo vệ toàn bộ connection pool của Gateway không bị cạn kiệt."*

---

## 4. DANH MỤC TÀI LIỆU & TEST SUITE BẠN ĐÃ XÂY DỰNG

1. **Mã nguồn Service**: `services/engagement-service/`
   - Framework: **ElysiaJS** trên runtime **Bun**.
   - Database: PostgreSQL với Prisma ORM (`prisma/schema.prisma` và `prisma/seed.ts`).
   - Module: `qa.routes.ts`, `poll.routes.ts`, `game.routes.ts`, `ws.routes.ts`.
   - Tiện ích tin cậy: `resilient-fetch.ts` (retry hạ tầng 2 lần, timeout 2s, không retry 4xx).
   - Module liên service: `admission-client.ts` (xác thực vé check-in kèm cache in-memory 60s).
2. **Bộ kiểm thử toàn diện (Unit & Security Tests)**:
   - `test/health.test.ts`: Kiểm tra health probe và degraded state.
   - `test/qa.test.ts`: Kiểm tra luồng đăng câu hỏi, chặn người chưa check-in, toggle upvote.
   - `test/poll.test.ts`: Kiểm tra phân quyền tạo poll (Host only), bỏ phiếu, chuyển đổi lựa chọn.
   - `test/game.test.ts`: Kiểm tra toàn bộ vòng đời ván đấu Kahoot từ WAITING đến FINISHED.
   - `test/game-security.test.ts`: Kiểm tra các kịch bản tấn công giả mạo danh tính, speed-hack, race condition CAS.
3. **Bộ tài liệu Postman Collection**:
   - `postman/qEvent_Microservices.postman_collection.json`: 16 API requests chuẩn RESTful.
   - `postman/qEvent_Local.postman_environment.json`: Biến môi trường local sẵn sàng import chạy ngay.
