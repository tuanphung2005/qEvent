# Kế hoạch triển khai & Definition of Done

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** lập lịch, chọn việc tiếp theo, hoặc kiểm tra "xong" nghĩa là gì. Đây là file duy nhất cần cập nhật tiến độ.
>
> **Tiến độ 2026-10-26:** Sprint 0–3 (backend) đã xong, `bun test` 78 pass / 0 fail. Sprint 4 nằm ở repo
> frontend riêng; Sprint 5 cần `GEMINI_API_KEY` + quota thật nên chưa chạy. Các ô còn `[ ]` bên dưới là
> việc thật sự chưa làm, không phải việc đã bỏ qua.

---

> Số hiệu **§3.x** trong file này trỏ tới [05a](05a-hardening-rules.md) · [05b](05b-hardening-routes.md) · [05c](05c-hardening-ops.md) (bảng ánh xạ đầy đủ ở [mục lục](../AI_INTEGRATION.md)).

## Kế hoạch triển khai

### Sprint 0 — Cứng hoá module game (≈2 ngày) — **làm trước Sprint 3**
> Chi tiết, code từng route và 30 test case: [05a](05a-hardening-rules.md) · [05b](05b-hardening-routes.md)
> · [05c](05c-hardening-ops.md). Bỏ bước này thì mọi guard của Sprint 3 chỉ là hình thức
> (POST/start/next vẫn public).
- [x] Query kiểm tra trùng `orderNum` → `@@unique([gameId, orderNum])` → `bun run db:push && bun run db:generate`
- [x] `game/services/access.service.ts`: `requireHost`, `requireSessionHost`, `transition`, `isUniqueViolation`
- [x] `game/schemas.ts`: siết validate (min/max), bỏ `userId` khỏi `submitAnswerBody`
- [x] `game-lifecycle.routes.ts`: auth + state machine + CAS + transaction cho `start`/`next`/`reveal`/`end`
- [x] `game-crud.routes.ts`: guard tạo game + `POST /:gameId/question`; `max+1`; `P2002 → 409`
- [x] `answer.routes.ts`: bỏ fallback `body.userId`, server tính `responseTimeMs`, chỉ nhận câu đang active
- [x] `game.ws.ts`: **xoá** nhánh `SUBMIT_ANSWER`, sửa `JOIN_GAME`
- [x] `src/index.ts`: throw nếu `NODE_ENV=production` mà thiếu `JWT_SECRET` (và chặn luôn fallback công khai)
- [x] `test/game.test.ts`: thêm token organizer cho `start`/`reveal`/`end`
- [x] `test/game.security.test.ts`: 30 case ở [05c §3.8](05c-hardening-ops.md) (hiện 32 case)

### Sprint 1 — Nền tảng (≈1 ngày)
- [x] `bun add @google/genai@2.31.0` (commit `bun.lock` — Dockerfile dùng `--frozen-lockfile`)
- [x] Tạo `src/services/ai.service.ts` (lazy client, `generateJson`, error types, `aiErrorStatus`, `singleFlight`)
- [x] Thêm env vào `.env` + document trong `backend/README.md` (không commit key)
- [x] Schema: +3 field, +1 index → `bun x prisma db push && bun x prisma generate`
- [x] Smoke test: thiếu key → server vẫn boot, endpoint trả 503 (test `ai.routes.test.ts`)

### Sprint 2 — Clustering (≈3 ngày)
- [x] `qa-cluster.service.ts`: schema, prompt có delimiter, `validateClusters`, single-flight, transaction
- [x] Append endpoint + phân quyền + cooldown vào `qa.routes.ts`
- [x] Append `MODERATOR_ROLES` + `HOST_ROLES` vào `session-access.service.ts` (dùng chung cho cả 2 hướng)
- [x] `test/ai.validators.test.ts` + `test/ai.cluster.test.ts`
- [ ] Manual: seed 20 câu trùng ý → gọi API → verify DB + WS event

### Sprint 3 — Quiz Generator (≈2 ngày)
> Phụ thuộc Sprint 0: dùng `requireHost` + `HOST_ROLES`, và `@@unique([gameId, orderNum])` đã có.
- [x] `modules/ai/{index,schemas,services/quiz-draft.service,routes/generate-quiz.routes}.ts`
- [x] Mount `aiModule` trong `index.ts` (trước `.listen`)
- [x] `game-crud.routes.ts`: trả `questions` cho host + `isCorrect` cho host (`GET /:gameId`)
- [x] `game-crud.routes.ts`: thêm `PATCH /:gameId/question/:questionId` (host-only, `WAITING`)
- [x] Test validator (pure, không DB/network)
- [ ] Manual: paste slide thật → generate → **host thấy danh sách câu + đáp án đúng** → sửa 1 câu → start
- [x] Test double-submit: 2 request song song → **1 lần gọi Gemini, 1 bộ câu hỏi** (không trùng)
- [x] Test host bấm Start trong lúc AI đang chạy → 409, không ghi câu

### Sprint 4 — Frontend (**repo khác**, 3–5 ngày)
> ⚠️ **Repo này không còn frontend.** Commit `0270a5d` đã xoá toàn bộ thư mục app/mobile.
> Sprint 4 phải làm ở repo frontend riêng (hoặc khôi phục app), và phụ thuộc vào fix `isCorrect` ở Sprint 3.
> **Không thực hiện trong repo này.**
- [ ] Host dashboard: nút gom nhóm + hiển thị cluster cards (đọc `clusterId`, `clusterLabel`, `clusteredAt`)
- [ ] Host dashboard: form `contextText` + preview/sửa câu hỏi AI (dùng response của `generate-quiz`, không refetch)
- [ ] Attendee Q&A: hiển thị `clusterLabel`, badge "kết quả gom nhóm lúc HH:mm" từ `clusteredAt`
- [ ] Xử lý lỗi UI cho 429/502/503 (nút disable + thông báo, không spam)

### Sprint 5 — Đo lường & báo cáo (≈1–2 ngày)
> ⚠️ **Chưa chạy:** không có `GEMINI_API_KEY`/quota thật trong môi trường này. Không ghi số liệu giả.
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

- [x] Server boot được **khi không có** `GEMINI_API_KEY`; các tính năng cũ pass hết test
- [x] `bun test` xanh, không gọi mạng, không cần key
- [x] Gom nhóm 2 lần liên tiếp: lần 2 trả 429 (cooldown), không tạo dữ liệu rác — service test; route map `CLUSTER_COOLDOWN` → 429
- [x] Gemini trả ID bịa / JSON rỗng / `MAX_TOKENS` → 502, **DB không đổi** (route test với generator giả)
- [x] Attendee gọi endpoint AI → 403 (test cả REST)
- [x] `sessionId` không tồn tại → 404 (cả 2 endpoint, không phải 422/500)
- [x] Generate quiz vào game đã `QUESTION_ACTIVE` → 409, không chèn câu (route test)
- [x] Host bấm Start trong lúc AI đang chạy → 409, không chèn câu (route test)
- [x] Double-submit generate-quiz → 1 lần gọi Gemini, 1 bộ câu hỏi (route test)
- [ ] Generate AI + `POST` thủ công song song → không 2 câu cùng `orderNum` (`P2002` → `409 ORDER_CONFLICT`) — code + unique index có, chưa có test ép được race
- [x] `GET /api/game/:gameId` khi `WAITING`: host thấy `questions` + `isCorrect`; player **không** thấy `questions` và **không** thấy `isCorrect`
- [x] Host `PATCH` 1 câu rồi Start → game dùng nội dung/đáp án mới; `PATCH` khi không `WAITING` → 409
- [x] Không token / attendee `POST /:gameId/question` → 401/403; game đã start → 409 (không chèn được câu)

### Module game (HƯỚNG 3)

- [x] `POST /start` `/next` `/reveal` `/end` không token → `401`; attendee → `403`
- [x] `start` lần 2 / `reveal` lần 2 / `next` khi đang `QUESTION_ACTIVE` → `409`; `questionStartedAt` **không** đổi
- [x] Game `FINISHED` không thể `start`/`next`/`reveal` lại (không hồi sinh game)
- [x] 2 request `start` song song → đúng 1 × `200`, 1 × `409`, `questionStartedAt` chỉ set 1 lần
- [x] `POST /:gameId/question` 2 đáp án đúng / 4 đáp án trùng chữ / `timeLimitSec: 0` → `400`
- [x] `orderNum` = `max + 1`: xoá 1 câu rồi thêm → không trùng số
- [x] `POST /:gameId/answer` gửi `userId` của người khác → `QuizAnswer` ghi cho **người gọi token**
- [x] Trả lời câu không phải câu đang active → `400 NOT_CURRENT_QUESTION`
- [x] Trả lời sau `timeLimitSec + 2s` → `400 ANSWER_TOO_LATE`
- [x] Client gửi `responseTimeMs: 0` sau 2.5s thực → điểm tính theo 2.5s (không phải 1000)
- [x] Trả lời 2 lần → `409 ALREADY_ANSWERED`
- [x] WS không còn nhánh `SUBMIT_ANSWER`; `JOIN_GAME` với game rác → `GAME_NOT_FOUND`, không subscribe
- [x] `NODE_ENV=production` + thiếu (hoặc dùng fallback) `JWT_SECRET` → server **từ chối boot**
- [x] `detect_changes()` trước khi commit: chỉ các symbol trong [bảng impact](06-errors-impact.md)

---

[← Lỗi & Impact](06-errors-impact.md) · [Mục lục](../AI_INTEGRATION.md) · [Lịch sử →](08-history.md)
