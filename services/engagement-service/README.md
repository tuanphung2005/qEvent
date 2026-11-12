# Engagement Service (qEvent)

Microservice phụ trách **Tương tác thời gian thực: Live Q&A, Bình chọn Polls và Kahoot-like Live Quiz Game** của qEvent.
Thuộc phần việc của **Trọng** theo `plans/AI_MICROSERVICES_EXECUTION_PLAN.md` (mục 2, mục 4.4, mục 9).

- Cổng nội bộ: `3003`
- Database riêng: `qevent_engagement` (PostgreSQL 16, không foreign key xuyên service)
- Giao tiếp liên service: Gọi HTTP nội bộ sang Admission Service (`PORT 3002`) để thực thi quy tắc **BR-6** (chỉ người đã check-in mới được tương tác).

## Trách nhiệm

| Nhóm | Nội dung |
|---|---|
| Live Q&A | Đặt câu hỏi theo session, Upvote/Unvote (idempotent toggle), realtime broadcast qua WS |
| Live Polls | Tạo bình chọn (Host: `ORGANIZER`/`STAFF`), bỏ phiếu (chỉ khán giả đã check-in `BR-6`), chuyển đổi lựa chọn |
| Quiz Game | State machine Kahoot (WAITING -> start -> QUESTION_ACTIVE -> reveal -> ROUND_REVEALED -> next -> end -> FINISHED) |
| Bảo mật Quiz | Chống gian lận: Server tính `responseTimeMs` từ `questionStartedAt`, cấm giả danh `userId`, CAS compare-and-set |
| WebSockets | `/ws/qa` (realtime questions/polls) và `/ws/game` (state sync; cấm gửi đáp án qua WS) |

## API

| Method | Endpoint | Thành công | Lỗi tiêu biểu |
|---|---|---|---|
| GET | `/api/sessions/:sessionId/questions` | `200` | — |
| POST | `/api/sessions/:sessionId/questions` | `201` | `401`, `403 NOT_CHECKED_IN` |
| PUT | `/api/questions/:questionId/votes` | `200` (toggle upvote) | `401`, `403 NOT_CHECKED_IN`, `404` |
| GET | `/api/sessions/:sessionId/polls` | `200` | — |
| POST | `/api/sessions/:sessionId/polls` | `201` | `401`, `403 FORBIDDEN` (chỉ Host), `400` |
| POST | `/api/polls/:pollId/vote` | `200` (vote/toggle) | `401`, `403 NOT_CHECKED_IN`, `404`, `400` |
| GET | `/api/sessions/:sessionId/game` | `200` | `404 GAME_NOT_FOUND` |
| POST | `/api/sessions/:sessionId/game` | `201` | `401`, `403 FORBIDDEN` |
| POST | `/api/game/:gameId/question` | `201` | `401`, `403`, `409 INVALID_GAME_STATE` (chỉ thêm khi WAITING), `400` |
| GET | `/api/game/:gameId` | `200` | `404` (Host thấy đáp án; Attendee chỉ thấy câu hỏi đang active) |
| POST | `/api/game/:gameId/start` | `200` (CAS sang QUESTION_ACTIVE) | `401`, `403`, `400 NO_QUESTIONS`, `409` |
| POST | `/api/game/:gameId/reveal` | `200` (CAS sang ROUND_REVEALED) | `401`, `403`, `409` (phải từ QUESTION_ACTIVE) |
| POST | `/api/game/:gameId/next` | `200` (CAS sang QUESTION_ACTIVE) | `401`, `403`, `409` (phải từ ROUND_REVEALED) |
| POST | `/api/game/:gameId/end` | `200` (CAS sang FINISHED) | `401`, `403`, `409` |
| POST | `/api/game/:gameId/answer` | `200` (`{ isCorrect, score }`) | `401`, `403 NOT_CHECKED_IN`, `400 ANSWER_TOO_LATE`, `409 ALREADY_ANSWERED` |
| GET | `/api/game/:gameId/leaderboard` | `200` (Bảng xếp hạng) | `404` |
| GET | `/health` | `200` | `503` khi DB không sẵn sàng |

## Quy tắc nghiệp vụ cốt lõi

1. **BR-6 (Kiểm soát check-in)**:
   - Trước khi nhận câu hỏi Q&A, bình chọn Poll, hay câu trả lời Quiz, service gọi sang Admission Service:
     `GET /internal/tickets/verify-access?userId=...&eventId=...`
   - Kèm cơ chế cache in-memory TTL 60s để tránh làm nghẽn Admission Service.
2. **State Machine Compare-And-Set (CAS)**:
   - Toàn bộ chuyển đổi trạng thái của ván đấu Quiz sử dụng câu lệnh nguyên tử `updateMany` với điều kiện `where.status`. Hai Host bấm Start/Next cùng lúc sẽ chỉ 1 request thắng (200), request còn lại nhận `409 INVALID_GAME_STATE`.
3. **Chống gian lận tính điểm (Anti-Speed-Hack & Anti-Spoofing)**:
   - Server sở hữu thời gian: `responseTimeMs` luôn được tính từ `now - questionStartedAt`, tuyệt đối không tin giá trị gửi từ client.
   - Dung sai mạng: Cho phép trễ tối đa `2000ms` (`ANSWER_GRACE_MS`) sau khi hết giờ `timeLimitSec`. Quá thời gian này trả `400 ANSWER_TOO_LATE`.
   - Danh tính bất biến: Luôn lấy `userId` từ JWT token hoặc header `x-user-id` tin cậy từ API Gateway. Bỏ qua mọi trường `userId` client truyền trong body.
4. **WebSocket an toàn**:
   - `/ws/qa`: Đồng bộ câu hỏi mới và số lượng upvote tức thì.
   - `/ws/game`: Đồng bộ trạng thái ván đấu. Cấm nhận đáp án qua WebSocket để đảm bảo xác thực và tính điểm chặt chẽ qua REST API.

## Chạy local

```bash
cd services/engagement-service
cp .env.example .env
bun install
bunx prisma migrate deploy    # hoặc bunx prisma db push
bun prisma/seed.ts
bun run dev                   # http://localhost:3003
```

Chạy toàn bộ unit test & security test:

```bash
bun test
```
