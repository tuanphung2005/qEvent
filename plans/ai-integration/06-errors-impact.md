# Bảng lỗi & Impact Analysis

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** cần mã lỗi/HTTP status, hoặc kiểm tra blast radius trước khi sửa (`impact`, `detect_changes`).

---

> Số hiệu **§3.x** trong file này trỏ tới [05a](05a-hardening-rules.md) · [05b](05b-hardening-routes.md) · [05c](05c-hardening-ops.md) (bảng ánh xạ đầy đủ ở [mục lục](../AI_INTEGRATION.md)).

## Bảng lỗi & HTTP status

### AI / Q&A

| Error code | HTTP | Khi nào |
|---|---|---|
| `AI_NOT_CONFIGURED` | 503 | Thiếu `GEMINI_API_KEY` (server vẫn chạy) |
| `FORBIDDEN` | 403 | Không phải moderator/host |
| `CLUSTER_COOLDOWN` | 429 | Gom nhóm lại quá nhanh |
| `AI_INVALID_OUTPUT` | 502 | JSON hỏng, bị safety chặn, `MAX_TOKENS`, không có nhóm/câu hợp lệ |
| `AI_FAILED` | 500 | Lỗi khác từ SDK/DB (không rõ loại) |
| `AI_RATE_LIMITED` | 429 | Gemini trả 429 sau khi SDK retry hết |
| `AI_TIMEOUT` | 504 | Vượt `GEMINI_TIMEOUT_MS` |
| `GAME_NOT_FOUND` | 404 | `gameId` sai |
| `GAME_SESSION_MISMATCH` | 400 | `gameId` không thuộc `sessionId` |
| `GAME_ALREADY_STARTED` | 409 | Game không còn `WAITING` |
| `SESSION_NOT_FOUND` | 404 | `sessionId` sai (cả 2 endpoint) |
| `NO_QUESTIONS` | 422 | Game chưa có câu hỏi để start |

### Module game (HƯỚNG 3)

| Error code | HTTP | Khi nào |
|---|---|---|
| `UNAUTHORIZED` | 401 | Không có / token sai (`currentUser === null`) |
| `FORBIDDEN` | 403 | Đã đăng nhập nhưng không thuộc `HOST_ROLES` |
| `GAME_NOT_FOUND` | 404 | `gameId` không tồn tại |
| `SESSION_NOT_FOUND` | 404 | `sessionId` không tồn tại |
| `QUESTION_NOT_FOUND` | 404 | `questionId` không thuộc game |
| `INVALID_GAME_STATE` | 409 | Trạng thái không cho phép hành động (bảng §3.3) |
| `GAME_STATE_CHANGED` | 409 | Request khác vừa đổi trạng thái (CAS thua) |
| `INVALID_OPTIONS` | 400 | Không phải 4 đáp án / ≠1 đáp án đúng / trùng chữ |
| `ORDER_CONFLICT` | 409 | Hai request lấy cùng `orderNum` (unique `(gameId, orderNum)`) |
| `NO_MORE_QUESTIONS` | 409 | `/next` khi đã ở câu cuối |
| `ANSWER_WINDOW_CLOSED` | 400 | Game không còn `QUESTION_ACTIVE` |
| `NOT_CURRENT_QUESTION` | 400 | `questionId` không phải câu đang active |
| `ANSWER_TOO_LATE` | 400 | Quá `timeLimitSec + 2s` |
| `QUESTION_NOT_STARTED` | 409 | `questionStartedAt` null (dữ liệu bất thường) |
| `ALREADY_ANSWERED` | 409 | Đã trả lời câu này (unique `(questionId, userId)`) |
| `INVALID_OPTION` | 400 | `optionId` không thuộc câu đang active |

---

## Impact Analysis (theo AGENTS.md)

```bash
node .gitnexus/run.cjs analyze   # index đã rebuild tại v2.1 (376 symbols / 674 edges / 3 flows), HEAD f5d6cca
```

Nếu `npx gitnexus analyze` crash `Analyzer identity input changed while it was being hashed`, dùng
`npm i -g gitnexus` rồi `gitnexus analyze` (npm 11 + shim `.ps1` trên Windows).

| Symbol / file | Loại thay đổi | Risk | Ghi chú |
|---|---|---|---|
| `qaRoutes` (`realtime/routes/qa.routes.ts`) | Append 1 endpoint | 🟡 LOW | File được `realtime/index.ts` import; route cũ không đổi |
| `session-access.service.ts` | Append 2 hằng số role (`MODERATOR_ROLES`, `HOST_ROLES`) | 🟢 VERY LOW | Chỉ export thêm, không sửa hàm cũ |
| `game/services/access.service.ts` | **File mới** (`requireHost`, `requireSessionHost`, `transition`, `isUniqueViolation`) | 🟢 VERY LOW | Chỉ thêm file; không import ngược vào `realtime` |
| `game/schemas.ts` | Siết `minLength`/`maxLength`/`minimum`; bỏ `userId` khỏi `submitAnswerBody` | 🟡 LOW | Payload cũ thiếu field optional vẫn qua; `userId` bị bỏ |
| `gameCrudRoutes` / `GET /:gameId` | Trả thêm `questions` **chỉ cho host** + `isCorrect` cho host | 🟡 LOW | Player nhận response y như cũ; không lộ câu chưa tới lượt |
| `gameCrudRoutes` / `PATCH /:gameId/question/:questionId` | **Route mới** | 🟡 LOW | Chỉ thêm; host-only, `WAITING`-only |
| `gameCrudRoutes` / `POST /:gameId/question` | +guard (401/403/404/409) + `max+1` + `P2002→409` + đúng 1 đáp án đúng | 🟡 LOW | Không test nào gọi route này (seed bằng Prisma) |
| `gameCrudRoutes` / `POST /session/:sessionId` | +guard `requireSessionHost` | 🟡 LOW | Không test nào gọi route này |
| `gameLifecycleRoutes` (`/start`, `/next`, `/reveal`, `/end`) | +auth +state machine +CAS +transaction | 🟠 MEDIUM | **4 route đổi hành vi**; `game.test.ts` phải đăng nhập organizer |
| `answerRoutes` / `POST /:gameId/answer` | Bỏ `body.userId`, server tính `responseTimeMs`, chỉ nhận câu active, `P2002→409` | 🟠 MEDIUM | `responseTimeMs` trong response đổi nguồn; test 5 vẫn pass (`>900`) |
| `gameWs` | **Xoá** nhánh `SUBMIT_ANSWER`, sửa `JOIN_GAME` | 🟡 LOW | Client nào đang trả lời qua WS phải chuyển sang REST |
| `app` (`src/index.ts`) | +1 import, +1 `.use()`, +guard `JWT_SECRET` production | 🟢 VERY LOW | Guard chỉ throw khi `NODE_ENV=production` |
| `QuizQuestion` model | +1 unique `(gameId, orderNum)` | 🟡 LOW | `db push` fail nếu đang có trùng → chạy query kiểm tra trước (§3.5) |
| `QAQuestion` model | +3 field optional, +1 index | 🟢 VERY LOW | `db push` không mất data |
| `qaWs` | **Không chạm** | ✅ Safe | `INITIAL_QUESTIONS` đã trả đủ field |
| `ticketsModule`, `checkinModule` | **Không chạm** | ✅ Safe | Lỗ hổng của chúng ghi ở §3.10, không sửa |

**Cảnh báo về cách đọc kết quả GitNexus:** `impact({target:"qaRoutes"})` và
`impact({target:"gameCrudRoutes"})` trả `0 impacted / LOW` — đó là **điểm mù của graph**, không phải
bằng chứng an toàn. Elysia dùng builder chain `.use()`, GitNexus chỉ ghi nhận edge `IMPORTS` ở mức
**file** (`realtime/index.ts → qa.routes.ts`), không có `CALLS` tới symbol; `route_map("/api/game")`
cũng trả **0 route** vì lý do tương tự. Kết luận "append-only, LOW risk" ở trên được xác nhận bằng
**đọc code**, không phải bằng con số 0 của tool.

Với HƯỚNG 3, con số 0 càng nguy hiểm: `gameLifecycleRoutes` / `answerRoutes` bị **sửa hành vi** ở 4–5
route, nhưng graph vẫn báo 0 caller vì lý do trên. Vì vậy bắt buộc có test hành vi (§3.8) — không có
test nào khác bắt được regression này.

Ngược lại, các symbol **có** dữ liệu thật trong graph đều đã được kiểm tra:
`checkUserSessionAccess` 11 impacted (7 caller trực tiếp, MEDIUM) — thêm 5 chỗ gọi mới nhưng **không
đổi signature**; `getSessionLiveStatus` 10 impacted (6 trực tiếp, MEDIUM) — không chạm;
`getGameLeaderboard` được gọi thêm 1 lần ở `/start`/`/next`/`/end` mới nhưng signature giữ nguyên.

---

[← 3c Vận hành](05c-hardening-ops.md) · [Mục lục](../AI_INTEGRATION.md) · [Triển khai →](07-rollout.md)
