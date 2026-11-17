# Kế hoạch triển khai: Trọng — Engagement Web (G1–G5)

Nguồn: `docs/STAFF_WEB_TEAM_SPLIT.md` §6.4 & `docs/WEB_AGENT_PROMPTS.md`.
Phạm vi: Chỉ tạo và sửa trong `web/src/features/engagement/**`, `web/e2e/engagement.spec.ts`, `docs/plans/engagement-web-trong.md`, `docs/evidence/ui/engagement/**`.
Tuyệt đối KHÔNG sửa file nhóm 1 (foundation) và KHÔNG commit/push khi chưa có lệnh.

---

## 1. Phạm vi công việc (G1–G5)

| ID | Chức năng & Màn hình | Chi tiết kỹ thuật & Endpoint Gateway |
|---|---|---|
| **G1** | Shell & Điều hướng: `/engagement/:sessionId` | - Session Selector (gọi `GET /api/events/:eventId` lấy danh sách sessions từ Event Context)<br>- Tabs switch (`/qa`, `/polls`, `/quiz`)<br>- Tích hợp hook `useRealtime({ channel: "qa", sessionId })`<br>- Banner hiển thị realtime status: `open` (Xanh/Đang kết nối), `connecting` / `reconnecting` (Vàng/Đang kết nối lại), `fallback` / `offline` (Báo chuyển sang polling sau 30s) |
| **G2** | Tab Q&A: `/engagement/:sessionId/qa` | - `GET /api/sessions/:sessionId/questions`: Danh sách sắp xếp theo upvote giảm dần<br>- `POST /api/sessions/:sessionId/questions`: Host/Staff đặt câu hỏi nếu cần<br>- `PUT /api/questions/:questionId/votes`: Toggle upvote realtime<br>- `DELETE /api/questions/:questionId`: Ẩn/xoá câu hỏi vi phạm (kèm Confirm Dialog)<br>- Animation highlight câu hỏi mới từ WebSocket event `QUESTION_CREATED` |
| **G3** | Tab Polls: `/engagement/:sessionId/polls` | - `GET /api/sessions/:sessionId/polls`: Danh sách bình chọn của session<br>- `POST /api/sessions/:sessionId/polls`: Tạo poll mới với 2–10 lựa chọn<br>- `PATCH /api/polls/:pollId`: Đóng/Mở poll (`isActive: boolean`)<br>- Hiển thị thanh tỷ lệ vote (progress / vote count) & tổng số lượt vote<br>- Disable tương tác và gắn nhãn "Đã đóng" khi poll kết thúc |
| **G4** | Tab Quiz: `/engagement/:sessionId/quiz` | - `GET /api/sessions/:sessionId/game` & `POST .../game`: Tạo hoặc lấy Quiz game của session<br>- `POST /api/game/:gameId/question`: Thêm câu hỏi (2–6 options, `correctOption`, `timeLimitSec`) khi trạng thái `WAITING`<br>- State Machine điều khiển: `WAITING` ➔ `start` ➔ `QUESTION_ACTIVE` ➔ `reveal` ➔ `ROUND_REVEALED` ➔ `next` (hoặc `end`) ➔ `FINISHED`<br>- Confirm Dialog trước khi bấm hành động nhạy cảm `next` / `end`<br>- `GET /api/game/:gameId/leaderboard`: Bảng xếp hạng điểm số & số câu đúng theo thời gian thực |
| **G5** | Tests & Mocks | - Mocks MSW đầy đủ tại `web/src/features/engagement/mocks.ts`<br>- Unit / Component tests với Vitest + Testing Library: `__tests__/engagement.test.tsx`<br>- E2E spec: `web/e2e/engagement.spec.ts` kiểm tra luồng Q&A, Polls, Quiz<br>- Đảm bảo toàn bộ test pass |

---

## 2. Quyết định kiến trúc & UX (Tuân thủ `@impeccable` Operate Mode)

1. **Tuân thủ Design System Tokens:**
   - Hoàn toàn không dùng `border`, không `borderWidth`, không `blur`, không mã hex inline.
   - Phân cấp bề mặt bằng background tokens (`bg-background`, `bg-card`, `bg-muted`, `bg-secondary`).
   - Các nút bấm, tabs, picker đạt chuẩn control accessibility: chiều cao tối thiểu 44px (`h-11`).
   - Đổ bóng chiều sâu chỉ dùng bottom drop shadow theo token Tailwind (`shadow-sm`, `shadow`).
2. **Sử dụng shadcn primitives có sẵn:**
   - Tận dụng `Card`, `Button`, `Input`, `Dialog`, `AlertDialog`, `Tabs`, `Badge`, `Skeleton`, `Empty`, `Select`.
   - Không tự viết wrapper component ngoài các primitives chuẩn.
3. **Realtime & Fallback:**
   - Tích hợp hook WebSocket có sẵn `useRealtime` từ `@/lib/realtime/useRealtime`.
   - Khi WebSocket ở trạng thái `fallback` (sau 30s mất kết nối) hoặc `offline`, giao diện hiển thị banner cảnh báo và kích hoạt `refetchInterval: 5000` (polling fallback) cho React Query.

---

## 3. Phân bổ thời gian (Theo 20 ngày công §6.4)

| Hạng mục | Kế hoạch (ngày) | Trạng thái | Ghi chú |
|---|---|---|---|
| G1: Shell & Session Picker + Realtime Banner | 5 | Đang thực hiện | Route `/engagement/:sessionId`, `useRealtime` status banner |
| G2: Tab Q&A (Upvotes, Delete Dialog, Live list) | 4 | Chuẩn bị | Toggle vote, highlight new item, delete dialog |
| G3: Tab Polls (Create 2–10 options, Close/Open, Results) | 4 | Chuẩn bị | Tạo poll form, thanh tỷ lệ kết quả |
| G4: Tab Quiz (Game State Machine, Advance, Leaderboard) | 5 | Chuẩn bị | Control CAS buttons, confirm next/end, leaderboard |
| G5: Mocks, Unit Tests & E2E spec | 2 | Chuẩn bị | MSW handlers, vitest component tests, Playwright spec |

---

## 4. Kế hoạch kiểm chứng (Verification)

- `bun run typecheck`: Không có lỗi TypeScript.
- `bun run lint:design`: 0 vi phạm về hex / border / blur / pale grey text.
- `bun run lint:routes`: Tuyến đường không trùng lặp.
- `bun run lint:encoding`: Mã hóa UTF-8 chuẩn.
- `bun run test`: Toàn bộ unit/component tests pass 100%.
- Báo cáo kết quả và giữ nguyên tắc: **KHÔNG commit, KHÔNG push** trừ khi người dùng ra lệnh.
