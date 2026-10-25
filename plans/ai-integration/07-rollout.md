# Kế hoạch triển khai & Definition of Done

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** lập lịch, chọn việc tiếp theo, hoặc kiểm tra "xong" nghĩa là gì. Đây là file duy nhất cần cập nhật tiến độ.

---

> Số hiệu **§3.x** trong file này trỏ tới [05a](05a-hardening-rules.md) · [05b](05b-hardening-routes.md) · [05c](05c-hardening-ops.md) (bảng ánh xạ đầy đủ ở [mục lục](../AI_INTEGRATION.md)).

## Kế hoạch triển khai

### Sprint 0 — Cứng hoá module game (≈2 ngày) — **làm trước Sprint 3**
> Chi tiết, code từng route và 30 test case: [05a](05a-hardening-rules.md) · [05b](05b-hardening-routes.md)
> · [05c](05c-hardening-ops.md). Bỏ bước này thì mọi guard của Sprint 3 chỉ là hình thức
> (POST/start/next vẫn public).
- [ ] Query kiểm tra trùng `orderNum` → `@@unique([gameId, orderNum])` → `bun run db:push && bun run db:generate`
- [ ] `game/services/access.service.ts`: `requireHost`, `requireSessionHost`, `transition`, `isUniqueViolation`
- [ ] `game/schemas.ts`: siết validate (min/max), bỏ `userId` khỏi `submitAnswerBody`
- [ ] `game-lifecycle.routes.ts`: auth + state machine + CAS + transaction cho `start`/`next`/`reveal`/`end`
- [ ] `game-crud.routes.ts`: guard tạo game + `POST /:gameId/question`; `max+1`; `P2002 → 409`
- [ ] `answer.routes.ts`: bỏ fallback `body.userId`, server tính `responseTimeMs`, chỉ nhận câu đang active
- [ ] `game.ws.ts`: **xoá** nhánh `SUBMIT_ANSWER`, sửa `JOIN_GAME`
- [ ] `src/index.ts`: throw nếu `NODE_ENV=production` mà thiếu `JWT_SECRET`
- [ ] `test/game.test.ts`: thêm token organizer cho `start`/`reveal`/`end`
- [ ] `test/game.security.test.ts`: 30 case ở [05c §3.8](05c-hardening-ops.md)

### Sprint 1 — Nền tảng (≈1 ngày)
- [ ] `bun add @google/genai@2.31.0` (commit `bun.lock` — Dockerfile dùng `--frozen-lockfile`)
- [ ] Tạo `src/services/ai.service.ts` (lazy client, `generateJson`, error types, `aiErrorStatus`, `singleFlight`)
- [ ] Thêm env vào `.env` + document trong `backend/README.md` (không commit key)
- [ ] Schema: +3 field, +1 index → `bun x prisma db push && bun x prisma generate`
- [ ] Smoke test: thiếu key → server vẫn boot, endpoint trả 503

### Sprint 2 — Clustering (≈3 ngày)
- [ ] `qa-cluster.service.ts`: schema, prompt có delimiter, `validateClusters`, single-flight, transaction
- [ ] Append endpoint + phân quyền + cooldown vào `qa.routes.ts`
- [ ] Append `MODERATOR_ROLES` + `HOST_ROLES` vào `session-access.service.ts` (dùng chung cho cả 2 hướng)
- [ ] `test/ai.validators.test.ts` + `test/ai.cluster.test.ts`
- [ ] Manual: seed 20 câu trùng ý → gọi API → verify DB + WS event

### Sprint 3 — Quiz Generator (≈2 ngày)
> Phụ thuộc Sprint 0: dùng `requireHost` + `HOST_ROLES`, và `@@unique([gameId, orderNum])` đã có.
- [ ] `modules/ai/{index,schemas,services/quiz-draft.service,routes/generate-quiz.routes}.ts`
- [ ] Mount `aiModule` trong `index.ts` (trước `.listen`)
- [ ] `game-crud.routes.ts`: trả `questions` cho host + `isCorrect` cho host (`GET /:gameId`)
- [ ] `game-crud.routes.ts`: thêm `PATCH /:gameId/question/:questionId` (host-only, `WAITING`)
- [ ] Test validator + manual: paste slide thật → generate → **host thấy danh sách câu + đáp án đúng** → sửa 1 câu → start
- [ ] Test double-submit: 2 request song song → **1 lần gọi Gemini, 1 bộ câu hỏi** (không trùng)
- [ ] Test host bấm Start trong lúc AI đang chạy → 409, không ghi câu

### Sprint 4 — Frontend (**repo khác**, 3–5 ngày)
> ⚠️ **Repo này không còn frontend.** Commit `0270a5d` đã xoá toàn bộ thư mục app/mobile.
> Sprint 4 phải làm ở repo frontend riêng (hoặc khôi phục app), và phụ thuộc vào fix `isCorrect` ở Sprint 3.
- [ ] Host dashboard: nút gom nhóm + hiển thị cluster cards (đọc `clusterId`, `clusterLabel`, `clusteredAt`)
- [ ] Host dashboard: form `contextText` + preview/sửa câu hỏi AI (dùng response của `generate-quiz`, không refetch)
- [ ] Attendee Q&A: hiển thị `clusterLabel`, badge "kết quả gom nhóm lúc HH:mm" từ `clusteredAt`
- [ ] Xử lý lỗi UI cho 429/502/503 (nút disable + thông báo, không spam)

### Sprint 5 — Đo lường & báo cáo (≈1–2 ngày)
- [ ] **Kiểm tra hạn mức thật** tại `aistudio.google.com/rate-limit` trước khi benchmark
- [ ] Cache kết quả benchmark ra JSON fixture để không đốt quota khi viết báo cáo
- [ ] Đo latency 20/50/100/200 câu (ghi rõ p50/p95, không ghi "≤ 2s" khi chưa đo)
- [ ] Clustering accuracy: 30–50 câu, ground truth thủ công, tính Precision/Recall/F1
- [ ] So sánh baseline: embedding similarity (bge-m3 / `text-embedding-004`) + threshold
- [ ] Distractor attractiveness từ `QuizAnswer` (tỉ lệ chọn đáp án sai theo từng câu)
- [ ] Prompt-injection: thử 3 câu hỏi chứa "bỏ qua chỉ dẫn…" → chứng minh không ảnh hưởng output

---

## Definition of Done

### AI (HƯỚNG 1 & 2)

- [ ] Server boot được **khi không có** `GEMINI_API_KEY`; các tính năng cũ pass hết test
- [ ] `bun test` xanh, không gọi mạng, không cần key
- [ ] Gom nhóm 2 lần liên tiếp: lần 2 trả 429 (cooldown), không tạo dữ liệu rác
- [ ] Gemini trả ID bịa / JSON rỗng / `MAX_TOKENS` → 502, **DB không đổi**
- [ ] Attendee gọi endpoint AI → 403 (test cả REST)
- [ ] `sessionId` không tồn tại → 404 (cả 2 endpoint, không phải 422/500)
- [ ] Generate quiz vào game đã `QUESTION_ACTIVE` → 409, không chèn câu
- [ ] Host bấm Start trong lúc AI đang chạy → 409, không chèn câu (kiểm tra lại status sau khi gọi AI)
- [ ] Double-submit generate-quiz → 1 lần gọi Gemini, 1 bộ câu hỏi (không nhân đôi `orderNum`)
- [ ] Generate AI + `POST` thủ công song song → không 2 câu cùng `orderNum` (`P2002` → `409 ORDER_CONFLICT`)
- [ ] `GET /api/game/:gameId` khi `WAITING`: host thấy `questions` + `isCorrect`; player **không** thấy `questions` và **không** thấy `isCorrect`
- [ ] Host `PATCH` 1 câu rồi Start → game dùng nội dung/đáp án mới; `PATCH` khi không `WAITING` → 409
- [ ] Không token / attendee `POST /:gameId/question` → 401/403; game đã start → 409 (không chèn được câu)

### Module game (HƯỚNG 3)

- [ ] `POST /start` `/next` `/reveal` `/end` không token → `401`; attendee → `403`
- [ ] `start` lần 2 / `reveal` lần 2 / `next` khi đang `QUESTION_ACTIVE` → `409`; `questionStartedAt` **không** đổi
- [ ] Game `FINISHED` không thể `start`/`next`/`reveal` lại (không hồi sinh game)
- [ ] 2 request `start` song song → đúng 1 × `200`, 1 × `409`, `questionStartedAt` chỉ set 1 lần
- [ ] `POST /:gameId/question` 2 đáp án đúng / 4 đáp án trùng chữ / `timeLimitSec: 0` → `400`
- [ ] `orderNum` = `max + 1`: xoá 1 câu rồi thêm → không trùng số
- [ ] `POST /:gameId/answer` gửi `userId` của người khác → `QuizAnswer` ghi cho **người gọi token**
- [ ] Trả lời câu không phải câu đang active → `400 NOT_CURRENT_QUESTION`
- [ ] Trả lời sau `timeLimitSec + 2s` → `400 ANSWER_TOO_LATE`
- [ ] Client gửi `responseTimeMs: 0` sau 2.5s thực → điểm tính theo 2.5s (không phải 1000)
- [ ] Trả lời 2 lần → `409 ALREADY_ANSWERED`
- [ ] WS không còn nhánh `SUBMIT_ANSWER`; `JOIN_GAME` với game rác → `GAME_NOT_FOUND`, không subscribe
- [ ] `NODE_ENV=production` + thiếu `JWT_SECRET` → server **từ chối boot**
- [ ] `detect_changes()` trước khi commit: chỉ các symbol trong [bảng impact](06-errors-impact.md)

---

[← Lỗi & Impact](06-errors-impact.md) · [Mục lục](../AI_INTEGRATION.md) · [Lịch sử →](08-history.md)
