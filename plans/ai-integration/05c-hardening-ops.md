# Hướng 3c — Schema, validate, JWT, test, phụ lục

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** thêm unique index, sửa `schemas.ts`, viết test, hoặc cần danh sách lỗ hổng ngoài module game.

---

## 3.5 Schema: `@@unique([gameId, orderNum])`

```prisma
model QuizQuestion {
  // ... giữ nguyên field
  @@unique([gameId, orderNum])
  // @@index([gameId])  ← bỏ được: unique ở trên đã tạo index tiền tố (gameId)
}
```

**Trước khi `db push`, chạy query kiểm tra trùng** (nếu có, `db push` sẽ fail):

```sql
SELECT "gameId", "orderNum", count(*) AS n
FROM "QuizQuestion"
GROUP BY 1, 2
HAVING count(*) > 1;
```

Có kết quả → đánh số lại theo thứ tự hiện tại rồi push:

```sql
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY "gameId" ORDER BY "orderNum", id) - 1 AS rn
  FROM "QuizQuestion"
)
UPDATE "QuizQuestion" q
SET "orderNum" = r.rn
FROM ranked r
WHERE q.id = r.id;
```

```bash
cd backend
bun run db:push      # áp unique index
bun run db:generate
```

Repo **không có** thư mục `prisma/migrations` — workflow là `db push` (đã kiểm tra). Vì vậy đừng viết
"migration" trong báo cáo; gọi đúng là "áp schema bằng `db push`".

`orderNum` sau thay đổi:

| Nơi ghi | Cách tính | Ghi chú |
|---|---|---|
| `POST /:gameId/question` | `max(orderNum) + 1` | đổi từ `count` → không trùng sau khi xoá câu |
| `POST /api/ai/generate-quiz` | `max(orderNum) + 1` | đã đúng từ v2; thêm catch `P2002` → `409 ORDER_CONFLICT` |
| `PATCH` | không đổi `orderNum` | sửa nội dung, không sắp xếp lại |

> Vẫn **không** thêm API xoá câu. Nếu thêm sau này: xoá câu → không đánh số lại (lỗ hổng thứ tự sẽ
> xuất hiện trong UI) → phải chạy lại câu SQL `ranked` ở trên trong cùng transaction.

## 3.6 TypeBox schemas

`backend/src/modules/game/schemas.ts` — thay toàn bộ:

```typescript
import { t } from "elysia";

export const createGameBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 500 })),
});

const optionBody = t.Object({
  text: t.String({ minLength: 1, maxLength: 120 }),
  isCorrect: t.Boolean(),
});

export const addQuestionBody = t.Object({
  question: t.String({ minLength: 1, maxLength: 500 }),
  timeLimitSec: t.Optional(t.Integer({ minimum: 5, maximum: 120 })),
  points: t.Optional(t.Integer({ minimum: 100, maximum: 5000 })),
  options: t.Array(optionBody, { minItems: 4, maxItems: 4 }),
});

export const submitAnswerBody = t.Object({
  questionId: t.String({ minLength: 1 }),
  optionId: t.String({ minLength: 1 }),
  /**
   * @deprecated server tự tính từ `questionStartedAt`. Giữ field để client cũ không bị 422;
   * giá trị gửi lên bị bỏ qua.
   */
  responseTimeMs: t.Optional(t.Number({ minimum: 0 })),
});

export const updateQuestionBody = addQuestionBody;
```

> `userId` đã bị **xoá** khỏi `submitAnswerBody`. Không còn đường nào để client chỉ định danh tính.

## 3.7 JWT secret: chặn fallback ở production

Fallback `"qevent_super_secret_jwt_key_2026_production_grade"` được copy ở **12 file**. Nếu deploy
thiếu `JWT_SECRET`, mọi token đều giả mạo được bằng secret công khai trong source. Sửa 3 dòng, một chỗ:

```typescript
// backend/src/index.ts — ngay trước `export const app = ...`
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET bắt buộc ở production (fallback hard-code chỉ dành cho dev/test)");
}
```

- `bun test`: không set `NODE_ENV` → không ảnh hưởng.
- `Dockerfile` đã set `NODE_ENV=production` → container **từ chối boot** nếu thiếu secret. Đúng ý đồ.
- Ghi vào `backend/README.md` + `.env.example`.

> Không gom 12 chỗ fallback thành một module ở plan này: đó là refactor cơ học 12 file, không đổi hành
> vi, và làm tăng diff của một PR vốn đã lớn. Ghi thành issue "JWT config tập trung".

## 3.8 Test plan

File mới `backend/test/game.security.test.ts`. **Tự tạo game riêng** trong `beforeAll` (không đụng game
seed — `game.test.ts` phụ thuộc game seed ở trạng thái `WAITING`). Login sẵn 3 token:
`organizer@qevent.com`, `attendee2@qevent.com` (đã check-in), `attendee@qevent.com` (chưa check-in).

| # | Given | Hành động | Mong đợi |
|---|---|---|---|
| 1 | game `WAITING` | `POST /start` không token | `401 UNAUTHORIZED` |
| 2 | game `WAITING` | `POST /start` token attendee | `403 FORBIDDEN` |
| 3 | game `WAITING`, 0 câu | `POST /start` token organizer | `422 NO_QUESTIONS` |
| 4 | game `WAITING`, 1 câu | `POST /start` organizer | `200`, status `QUESTION_ACTIVE`, index 0 |
| 5 | đang `QUESTION_ACTIVE` | `POST /start` lần 2 | `409 INVALID_GAME_STATE`, `questionStartedAt` **không** đổi |
| 6 | đang `QUESTION_ACTIVE` | `POST /next` organizer | `409 INVALID_GAME_STATE` (phải reveal) |
| 7 | đang `QUESTION_ACTIVE` | `POST /next` không token | `401` (không phải 409 — auth trước) |
| 8 | đang `QUESTION_ACTIVE` | `POST /reveal` organizer | `200`, status `ROUND_REVEALED` |
| 9 | đang `ROUND_REVEALED` | `POST /reveal` lần 2 | `409 INVALID_GAME_STATE` |
| 10 | đang `ROUND_REVEALED` | `POST /next` organizer | `200`, index + 1, `questionStartedAt` mới |
| 11 | đã `FINISHED` | `POST /reveal` / `/start` / `/next` | `409` (không hồi sinh game) |
| 12 | đã `FINISHED` | `POST /end` lần 2 | `409 INVALID_GAME_STATE` |
| 13 | `gameId` không tồn tại | `POST /end` organizer | `404 GAME_NOT_FOUND` (**không phải 500**) |
| 14 | 2 request `/start` song song | `Promise.all` | đúng 1 × `200`, 1 × `409`, `questionStartedAt` chỉ set 1 lần |
| 15 | game `WAITING` | `POST /:id/question` không token | `401` |
| 16 | game `WAITING` | `POST /:id/question` attendee | `403` |
| 17 | game `QUESTION_ACTIVE` | `POST /:id/question` organizer | `409 INVALID_GAME_STATE` (không chèn câu giữa ván) |
| 18 | game `WAITING` | `POST /:id/question` 2 đáp án đúng | `400 INVALID_OPTIONS` |
| 19 | game `WAITING` | `POST /:id/question` 4 đáp án trùng chữ | `400 INVALID_OPTIONS` |
| 20 | game `WAITING` | `POST /:id/question` `timeLimitSec: 0` | `400` (TypeBox `minimum: 5`) |
| 21 | có 2 câu, xoá câu giữa bằng Prisma | `POST /:id/question` organizer | `orderNum = 2` (max+1), **không** trùng số cũ |
| 22 | đang `QUESTION_ACTIVE` | `POST /answer` body có `userId` của người khác | `200` nhưng **không** tạo `QuizAnswer` cho `userId` đó (chỉ cho người gọi) |
| 23 | đang `QUESTION_ACTIVE` | `POST /answer` không token | `401` |
| 24 | đang `QUESTION_ACTIVE`, câu index 0 | `POST /answer` với `questionId` của câu index 1 | `400 NOT_CURRENT_QUESTION` |
| 25 | `questionStartedAt` = now − 30s, `timeLimitSec` 20 | `POST /answer` | `400 ANSWER_TOO_LATE` |
| 26 | `questionStartedAt` = now − 2500ms | `POST /answer` đúng | `200`, `scoreAwarded ≈ 937` (không phải 1000 dù client gửi `0`) |
| 27 | đã trả lời câu hiện tại | `POST /answer` lần 2 | `409 ALREADY_ANSWERED` |
| 28 | đang `QUESTION_ACTIVE` | `POST /answer` khi `game.status` = `ROUND_REVEALED` | `400 ANSWER_WINDOW_CLOSED` |
| 29 | game `WAITING` | `POST /session/:sessionId` không token | `401`; attendee → `403`; organizer → `201` |
| 30 | — | WS message `{type:"JOIN_GAME", gameId:"không-tồn-tại"}` | nhận `{type:"GAME_NOT_FOUND"}` và **không** subscribe |

Cập nhật `backend/test/game.test.ts`: test 3/6/7 gọi `/start`, `/reveal`, `/end` **không token** → thêm
login `organizer@qevent.com` trong `beforeAll` và gắn header. Test 5 (`responseTimeMs: 2500`, kỳ vọng
`> 900`) vẫn pass vì server tính ~0ms → ~1000 điểm; nếu muốn kiểm tra chính xác thì sửa `questionStartedAt`
bằng Prisma trước khi gọi (như case 26).

Chạy:

```bash
cd backend
bun test                       # không cần mạng, không cần GEMINI_API_KEY
bun test test/game.security.test.ts
```

## 3.9 Thứ tự thi công & ước lượng

| Bước | Việc | Ước lượng |
|---|---|---|
| 1 | Query kiểm tra trùng `orderNum` → `@@unique` → `db push` → `db:generate` | 30' |
| 2 | `access.service.ts` + `schemas.ts` | 45' |
| 3 | `game-lifecycle.routes.ts`: start/next/reveal/end | 1h |
| 4 | `game-crud.routes.ts`: create game + POST question + PATCH dùng guard | 1h |
| 5 | `answer.routes.ts`: bỏ `body.userId`, server-side time, check câu hiện tại | 1h |
| 6 | `game.ws.ts`: xoá `SUBMIT_ANSWER`, sửa `JOIN_GAME` | 30' |
| 7 | Test: sửa `game.test.ts` + viết `game.security.test.ts` (30 case) | 2h |
| 8 | Smoke tay: Postman/`curl` 1 ván đầy đủ 2 câu | 30' |
| | **Tổng** | **≈ 1,5–2 ngày** |

Làm **trước** Sprint 3 (quiz generator), vì `generate-quiz` và `PATCH` đều dựa vào `requireHost`.

## 3.10 Phụ lục: cùng lỗi ngoài module game

Không sửa trong PR này (không liên quan tính năng AI), nhưng **phải** ghi vào báo cáo — đừng viết
"hệ thống đã phân quyền đầy đủ".

| Route | File:dòng | Vấn đề | Fix 1 dòng |
|---|---|---|---|
| `GET /api/qa/session/:id?userId=` | `qa.routes:37` | Nhận `query.userId` → xem quyền của người khác | bỏ fallback, dùng `currentUser?.id` |
| `POST /api/qa/question` | `qa.routes:105` | `bodyUserId` → đăng câu với danh nghĩa người khác | như trên |
| `POST /api/qa/question/:id/upvote` | `qa.routes:165` | `body.userId` → vote hộ | như trên |
| `POST /api/qa/question/:id/answer` | `qa.routes:221` | **Không auth** → ai cũng đánh dấu đã trả lời + sửa `answerText` | `requireHost`-tương đương (session) |
| `POST /api/qa/question/:id/pin` | `qa.routes:261` | **Không auth** → ai cũng ghim câu lên màn hình | như trên |
| `GET /api/qa/session/:id/polls` | `poll.routes:35` | `query.userId` → xem "bạn đã vote chưa" của người khác | bỏ fallback |
| `POST /api/qa/poll/:id/vote` | `poll.routes:121` | `bodyUserId` → vote hộ người khác | bỏ fallback, dùng `currentUser.id` |
| `PATCH /api/qa/poll/:id/toggle` | `poll.routes:218` | **Không auth** → ai cũng bật/tắt poll | role theo session |
| `POST /api/tickets/events/:id/toggle-live` | `tickets.routes:436` | **Không auth** → bật/tắt live cả event | `ORGANIZER` + owner |
| `POST /api/tickets/sessions/:id/toggle-live` | `tickets.routes:456` | **Không auth** | như trên |
| `GET /api/checkin/stats/:eventId` | `monitor.routes:174` | **Không auth** → lộ số liệu điểm danh | `STAFF`/`ORGANIZER` |

Khuôn fix giống hệt §3.2; chỉ khác nguồn role (session của câu hỏi/poll, hoặc event của ticket).

## 3.11 Những gì **không** làm (và vì sao)

| Không làm | Vì sao |
|---|---|
| Bảng gán staff theo event | Cần migration + UI quản trị; ngoài phạm vi đồ án. Giới hạn đã ghi rõ. |
| Rate limit theo IP | Cần Redis/upstash; 1 instance + cooldown DB là đủ cho MVP. |
| Refresh token / thu hồi token | JWT 7 ngày hiện tại; thêm refresh là một feature riêng. |
| Audit log | Không có yêu cầu; thêm bảng + middleware là scope mới. |
| Xoá enum `ACTIVE` | `db push` xoá enum value có rủi ro, không mang lại gì. |
| Gom 12 fallback JWT | Refactor cơ học 12 file; đã chặn bằng guard production ở §3.7. |
| API xoá câu hỏi | Không ai yêu cầu; thêm vào là mở thêm đường phải đánh số lại `orderNum`. |
| Chặn spectator ở WS | Người xem projector là hợp lệ; `isCorrect` đã mask. |

---

[← 3b Routes](05b-hardening-routes.md) · [Mục lục](../AI_INTEGRATION.md) · [Lỗi & Impact →](06-errors-impact.md)
