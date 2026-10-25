# Lịch sử sửa lỗi (v1 → v2.2)

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** viết báo cáo hoặc cần biết lỗi nào đã từng có. Không dùng để code.

---

> Số hiệu **§3.x** trong file này trỏ tới [05a](05a-hardening-rules.md) · [05b](05b-hardening-routes.md) · [05c](05c-hardening-ops.md) (bảng ánh xạ đầy đủ ở [mục lục](../AI_INTEGRATION.md)).

## Giá trị học thuật (đã chỉnh cho đúng)

- **Prompt Engineering**: delimiter + "dữ liệu không tin cậy" + JSON Schema; có thực nghiệm prompt-injection.
- **Structured Output**: `responseJsonSchema` + validate 2 lớp (schema của model **và** validator của server).
  Nêu rõ: structured output đảm bảo *định dạng*, không đảm bảo *đúng sự thật* → đây là lý do có lớp validate.
- **Defensive LLM integration**: transaction, idempotency (single-flight), cooldown, fallback khi 429.
- **Đo lường**: F1 so với ground truth thủ công; latency theo p50/p95; so sánh với embedding clustering.
- **Human-in-the-loop**: host preview/sửa trước khi start; AI hỗ trợ, không thay thế.
- **Đánh giá distractor**: từ `QuizAnswer` sau mỗi game.

---

## Những gì đã sửa so với v1

| # | Lỗi v1 | Cách sửa ở v2 |
|---|---|---|
| 1 | `geminiClient.generateContent(...)` — không tồn tại trong `@google/genai` | `ai.models.generateContent({ model, contents, config })`; pin `2.31.0` |
| 2 | `responseSchema` với object `"type":"object"` → lỗi `tsc` (strict) | `responseJsonSchema` (plain JSON Schema, SDK type `unknown`) |
| 3 | `mergedUpvotes` do LLM tính | Server cộng từ `upvotes` trong DB |
| 4 | `JSON.parse` + đọc `result.clusters` trực tiếp | Validate: mảng tồn tại, ID có thật, nhóm rời nhau, representative hợp lệ, fallback |
| 5 | Lỗi giữa vòng lặp `update` để lại dữ liệu nửa vời | 1 `$transaction`: reset + `updateMany` theo nhóm |
| 6 | N+1: `update` tuần tự từng câu | `updateMany` theo nhóm (1 query/nhóm) |
| 7 | `clusterId = representativeId` | UUID riêng cho nhóm + `clusteredAt` |
| 8 | Chỉ check `currentUser` | Role gate (moderator/host) + cooldown + single-flight |
| 9 | Client khởi tạo ở module scope → sập server khi thiếu key | Lazy init + `AI_ENABLED` + 503 |
| 10 | Không có retry/timeout | `httpOptions.retryOptions` (408/429/5xx) + timeout |
| 11 | Quiz insert không transaction, không guard trạng thái | `$transaction`, guard `WAITING`, check `game.sessionId`, `orderNum = max+1` |
| 12 | Model tự chọn `timeLimitSec`/`points` | Model chọn `difficulty`; server map sang time/points |
| 13 | "Đúng 4 đáp án / 1 đúng" chỉ nằm trong prompt | Validator bắt buộc; sai → loại câu, không ghi |
| 14 | Host không xem được `isCorrect` khi preview (sanitizer) | Host/speaker thấy `isCorrect` ở `GET /api/game/:gameId` (v2.1: kèm cả `questions`) |
| 15 | Sprint 2 sửa `qa.ws.ts` (không cần) | Bỏ; broadcast ở REST route, `INITIAL_QUESTIONS` đã trả đủ field |
| 16 | Test gọi API thật → flaky + đốt quota | Inject `JsonGenerator`; validator test offline |
| 17 | "500 req/ngày" và "≤ 2s" như sự thật | Bỏ; kiểm tra AI Studio, đo p50/p95 |
| 18 | Sprint 4 không nêu repo frontend đã bị xoá | Ghi rõ: frontend ở repo khác, phụ thuộc fix #14 |
| 19 | 200–1.000 câu trong 1 call, không giới hạn | `limit` (mặc định 200, max 300) + `truncated` trong response |
| 20 | Impact analysis dựa vào con số 0 của GitNexus | Ghi rõ điểm mù `.use()` của graph; kết luận dựa trên đọc code |

---

## v2.1 — sửa sau review

| # | Lỗi v2 | Cách sửa ở v2.1 | Mức |
|---|---|---|---|
| 1 | `GET /:gameId` không trả `questions`; game `WAITING` có `currentQuestionIndex = -1` → host không preview được gì | Trả `questions: sanitizedQuestions` **chỉ khi `isHost`** (player không thấy câu chưa tới lượt) | 🔴 chặn |
| 2 | "Host preview + sửa" nhưng **không có route sửa** | Thêm `PATCH /:gameId/question/:questionId` (host-only, `WAITING`, đúng 4 đáp án / 1 đúng / khác nhau) | 🔴 chặn |
| 3 | Generate quiz không có single-flight → double-click tạo 2 bộ câu, `orderNum` nhân đôi | `singleFlight("quiz:" + gameId)` bọc generate + insert | 🔴 chặn |
| 4 | Status `WAITING` chỉ check **trước** khi gọi AI (chờ 5–20s) | Check lại status **sau** khi gọi AI, ngay trước transaction → `{ ok: false }` → 409 | 🔴 chặn |
| 5 | `HOST_ROLES` dùng trong code mẫu nhưng chưa định nghĩa | Thêm cạnh `MODERATOR_ROLES` (`readonly string[]`, để `includes()` type-check) | 🟡 |
| 6 | `AI_FAILED` 502 trong khi `aiErrorStatus` trả 500 | Thống nhất 500 (lỗi không rõ loại) | 🟡 |
| 7 | Cooldown + single-flight: key chỉ theo `sessionId` → 2 `limit` khác nhau dùng chung kết quả | Key gồm `limit`; reset cluster chỉ cho các câu vừa xét (câu ngoài top 200 giữ nhãn cũ) | 🟡 |
| 8 | Không kiểm tra `sessionId` tồn tại ở cả 2 endpoint | Thêm 404 `SESSION_NOT_FOUND` | 🟡 |
| 9 | `DEFAULT_MODEL` export thừa; `aiErrorStatus` trả `502` cho lỗi unknown | Bỏ `export`; unknown → `500` | 🟢 |
| 10 | Đáp án quiz có thể trùng chữ | Validator khử trùng theo `text.toLowerCase()` (cả lúc generate và PATCH) | 🟢 |
| 11 | `index.ts` mount mất `.listen(...)` | Code mẫu giữ `.listen({ port, hostname })` | 🟢 |
| 12 | PATCH host-only nhưng `POST /:gameId/question` công khai → guard PATCH vô nghĩa | Thêm cùng 3 guard (404/403/409) vào POST; phần còn lại giữ nguyên | 🔴 chặn |

**Vẫn là giới hạn ở thời điểm v2.1** — các mục gạch ngang **đã được xử lý ở v2.2 (HƯỚNG 3)**:

- `mergedUpvotes` không có trong REST/`INITIAL_QUESTIONS` (client tự cộng theo `clusterId`). → **vẫn còn**
- Phân quyền theo `role` toàn cục — không có bảng gán staff theo event. → **vẫn còn** (§3.11)
- ~~`POST /session/:sessionId`, `/start`, `/next`, `/reveal`, `/end` public~~ → **đã sửa ở v2.2** (§3.4)
- ~~`POST /:gameId/question` cho ≥1 đáp án đúng~~ → **đã sửa ở v2.2** (§3.4.2: đúng 1)
- Single-flight chỉ đúng trong 1 process (MVP 1 instance). Cooldown bền vững nhờ DB. → **vẫn còn**
- ~~Chưa có `@@unique([gameId, orderNum])`, `orderNum = count`~~ → **đã sửa ở v2.2** (§3.5: `max+1` + unique)

---

## v2.2 — cứng hoá module game

Bối cảnh: audit sau v2.1 phát hiện **toàn bộ** module `game` không có authorization. Bảng dưới là mọi lỗi
tìm được và nơi sửa — không còn mục nào bị "skip".

| # | Lỗi | Khai thác được? | Sửa ở |
|---|---|---|---|
| 1 | `POST /:gameId/question`: không auth, không check status, ≥1 đáp án đúng, `orderNum = count` | **Có** — chèn câu vào game đang chạy | §3.4.2 |
| 2 | `POST /session/:sessionId`: không auth | **Có** — tạo game trong session bất kỳ | §3.4.1 |
| 3 | `/start`: không auth, không check status | **Có** — restart game đã `FINISHED` | §3.4.4 |
| 4 | `/next`: không auth, không check status | **Có** — gọi khi `WAITING` ⇒ start lậu | §3.4.5 |
| 5 | `/reveal`: không auth, không check status | **Có** — hồi sinh game `FINISHED` | §3.4.6 |
| 6 | `/end`: không auth; game không tồn tại → `P2025` → 500 | **Có** — kết thúc game người khác | §3.4.7 |
| 7 | `answer`: `currentUser?.id \|\| body.userId` | **Có** — giả danh bất kỳ ai | §3.4.8 |
| 8 | `answer`: `responseTimeMs` do client gửi | **Có** — gửi `0` ăn điểm tối đa | §3.4.8 |
| 9 | `answer`: không check câu đang active | **Có** — trả lời trước toàn bộ câu | §3.4.8 |
| 10 | WS `SUBMIT_ANSWER`: `userId` + thời gian từ message | **Có** — y hệt #7/#8, còn không check câu hiện tại | §3.4.9 (xoá nhánh) |
| 11 | WS `JOIN_GAME`: subscribe trước khi kiểm tra game tồn tại | Không lộ dữ liệu, nhưng nhận game rác | §3.4.9 |
| 12 | Không có `@@unique([gameId, orderNum])` | Latent — thành lỗi thật khi có API xoá câu | §3.5 |
| 13 | Hai host bấm cùng lúc → ghi đè trạng thái (`read` rồi `update`) | **Có** — race condition | §3.3 `transition` (CAS) |
| 14 | `schemas.ts` không có min/max | **Có** — `timeLimitSec: 0`, câu rỗng, 100 đáp án | §3.6 |
| 15 | `JWT_SECRET` fallback hard-code ở 12 file | **Có** nếu deploy thiếu env → giả mạo token | §3.7 |
| 16 | `qa`/`poll`/`tickets`/`checkin` cùng loại lỗi | **Có** | §3.10 — ghi nhận, **không** sửa PR này |

**Thay đổi hành vi phải báo trước (breaking):**

- `/next` giờ chỉ chạy khi `ROUND_REVEALED` (trước đây gọi lúc nào cũng được) — client phải reveal trước.
- `/start`, `/reveal`, `/end` yêu cầu token host → `game.test.ts` phải đăng nhập organizer.
- WS không còn nhận `SUBMIT_ANSWER` → client trả lời qua `POST /:gameId/answer`.
- `POST /:gameId/question` từ chối câu có ≠1 đáp án đúng (trước đây ≥1).
- `POST /:gameId/question` từ chối `timeLimitSec` ngoài `[5,120]`, `points` ngoài `[100,5000]`.

**Đánh đổi được ghi vào báo cáo:**

- Phân quyền vẫn theo role toàn cục (không có bảng gán staff theo event) — giới hạn schema, không phải lỗi code.
- Không thêm rate limit / refresh token / audit log / API xoá câu — lý do ở §3.11.
- Không gom 12 fallback JWT; chỉ chặn ở production (§3.7).
- 11 route ngoài module game (§3.10) **không** sửa — báo cáo phải nói "module game đã phân quyền", không nói "hệ thống đã phân quyền".

---

[← Triển khai](07-rollout.md) · [Mục lục](../AI_INTEGRATION.md)
