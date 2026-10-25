# 🤖 qEvent AI Integration Plan — Gemini (Flash) — v2.2

> Tích hợp Google Gemini vào hai tính năng cốt lõi:
> **Hướng 1 — Smart Q&A Clustering** và **Hướng 2 — AI Quiz Generator**.
> **Hướng 3** (bắt buộc trước khi ship) cứng hoá module `game` — không có nó thì mọi guard của Hướng 2
> chỉ là hình thức.
>
> **Trạng thái:** kế hoạch. Chưa có dòng code nào trong `backend/` bị sửa. Mọi thứ dưới đây là thiết kế
> đã đối chiếu với source tại HEAD `f5d6cca` (GitNexus: 376 symbols / 674 edges / 3 flows).
>
> **Cách dùng:** file này là **mục lục**, không chứa code. Code, bảng, test nằm trong
> [`ai-integration/`](ai-integration/). Đừng đọc hết 10 file một lượt — đọc theo bảng dưới.

---

## Đọc gì trước

| Bạn đang làm gì | Đọc theo thứ tự |
|---|---|
| Mới nhận task, cần biết bối cảnh | `01` → `02` → `07` (đủ để hiểu phạm vi + thứ tự) |
| Làm Hướng 1 (clustering) | `01` → `02` → `03` |
| Làm Hướng 2 (quiz generator) | `01` → `02` → `05a` → `05b` → `05c` → `04` |
| Cứng hoá module game (Sprint 0) | `05a` → `05b` → `05c` |
| Review / viết báo cáo | `06` → `07` → `08` |

> Thứ tự **05a → 05b → 05c → 04** là cố ý: `04` dùng `requireHost` và `@@unique([gameId, orderNum])`
> do Sprint 0 tạo ra. Làm `04` trước sẽ phải viết lại guard.

## Bản đồ file

| File | Nội dung | Dòng | Đọc khi |
|---|---|---|---|
| [`01-context.md`](ai-integration/01-context.md) | Kiến trúc, nguyên tắc thiết kế, file bị sửa, env | 102 | Cần biết vì sao có plan này, đụng file nào, cần env gì |
| [`02-schema.md`](ai-integration/02-schema.md) | `QAQuestion` +3 field, `QuizQuestion` +1 unique | 45 | Trước khi `db push` hoặc sửa `schema.prisma` |
| [`03-clustering.md`](ai-integration/03-clustering.md) | Hướng 1: `ai.service.ts`, `qa-cluster.service.ts`, endpoint, WS | 498 | Làm clustering |
| [`04-quiz-generator.md`](ai-integration/04-quiz-generator.md) | Hướng 2: `modules/ai/*`, host preview, `PATCH` câu hỏi, test | 680 | Làm quiz generator |
| [`05a-hardening-rules.md`](ai-integration/05a-hardening-rules.md) | Hiện trạng 14 route, 6 nguyên tắc, `requireHost`, `transition`, state machine | 183 | Bắt đầu Sprint 0 |
| [`05b-hardening-routes.md`](ai-integration/05b-hardening-routes.md) | Code thay thế từng route (`start`/`next`/`reveal`/`end`/`answer`/`question`/WS) | 568 | Đang viết handler cụ thể |
| [`05c-hardening-ops.md`](ai-integration/05c-hardening-ops.md) | `@@unique`, TypeBox, JWT guard, 30 test case, phụ lục 11 route ngoài module | 223 | Thêm index, sửa `schemas.ts`, viết test |
| [`06-errors-impact.md`](ai-integration/06-errors-impact.md) | Bảng lỗi/HTTP + Impact Analysis (blast radius) | 98 | Cần mã lỗi, hoặc kiểm tra impact trước khi sửa |
| [`07-rollout.md`](ai-integration/07-rollout.md) | Sprint 0–5 + Definition of Done | 107 | Lập lịch, chọn việc tiếp theo, kiểm tra "xong" |
| [`08-history.md`](ai-integration/08-history.md) | Lỗi từng bản (v1 → v2.1 → v2.2), breaking change, đánh đổi | 118 | Viết báo cáo |

Đọc tuần tự `01` → `08` cho ra đúng bản gộp cũ — không mất nội dung nào khi tách file.
**Chỉ `07-rollout.md` cần cập nhật tiến độ**; các file còn lại là thiết kế, sửa khi thiết kế đổi.

## Bản đồ §3.x (Hướng 3)

Số hiệu `§3.x` được giữ nguyên như bản gộp để mọi tham chiếu cũ vẫn đúng:

| Mục | File | Nội dung |
|---|---|---|
| §3.0 – §3.3 | `05a` | Hiện trạng route, nguyên tắc, guard dùng chung, state machine |
| §3.4 – §3.4.9 | `05b` | Code thay thế 9 handler |
| §3.5 – §3.11 | `05c` | Unique index, TypeBox, JWT, test, thứ tự thi công, phụ lục, non-goals |

## Ba bất biến (đừng vi phạm khi implement)

1. **Không có guard thì không có tính năng.** Sprint 0 (auth + state machine) phải xong **trước**
   Sprint 3. `POST /:gameId/question` public ⇒ `PATCH` host-only vô nghĩa.
2. **Server sở hữu danh tính và thời gian.** `userId` luôn lấy từ JWT; `responseTimeMs` luôn tính từ
   `questionStartedAt`. Không nhận cả hai từ body/message. Áp cho cả REST và WS.
3. **Mọi chuyển trạng thái là compare-and-set.** `updateMany({ where: { id, status } })` rồi kiểm
   `count === 1`; đọc-rồi-ghi là race, hai host bấm cùng lúc sẽ ghi đè.

## Quyết định đã chốt (đừng mở lại khi chưa đọc 08)

| Quyết định | Vì sao |
|---|---|
| Một plan, không tách plan AI / plan hardening | Tính năng AI ghi vào `QuizGame`; tách ra thì guard ở Hướng 2 thành hình thức |
| Host preview trả `questions` + thêm `PATCH /:gameId/question/:id` | Không có preview/sửa thì "human-in-the-loop" chỉ là tên gọi; player vẫn không thấy `isCorrect` |
| `singleFlight<T>` cho generate-quiz + cooldown DB | Double-submit của host là hành vi thật, không phải edge case |
| Kiểm tra lại `game.status` **sau** khi gọi AI | AI chạy 5–20s; trong lúc đó host có thể bấm Start |
| Phân quyền theo `role` toàn cục (không có bảng staff theo event) | Giới hạn schema, ghi rõ trong báo cáo — không giả vờ đã có |
| Sửa `POST /:gameId/question` cùng lúc với `PATCH` | Hai đường ghi cùng nội dung phải cùng chuẩn quyền |
| Không sửa 11 route ngoài module game (§3.10) | Ngoài phạm vi; nhưng **phải** liệt kê, không được nói "hệ thống đã phân quyền" |
| Không xoá `QuizGameStatus.ACTIVE` | `db push` xoá enum value có rủi ro, không mang lại gì |

Chi tiết lý do + danh sách breaking change: [`08-history.md`](ai-integration/08-history.md).
