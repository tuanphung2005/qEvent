# Staff Web — Chia việc 4 người (không giẫm chân)

Mục tiêu: 4 người làm song song, mỗi người sở hữu một thư mục feature riêng; chỉ Tuấn sửa file dùng chung. Review theo folder, không review cả repo.

## 1. Nguyên tắc chống conflict

1. **Mỗi feature một thư mục**: `web/src/features/<feature>/**`. Không import chéo giữa các feature.
2. **Không ai sửa file dùng chung** trừ Tuấn:
   - `web/src/app/**`, `web/src/lib/**`, `web/src/components/ui/**`, `web/src/styles/**`, `web/src/main.tsx`, `package.json`, `vite.config.ts`, `tsconfig.json`.
3. **Router không sửa tay**: mỗi feature export route trong `features/<name>/routes.tsx`; `app/router.tsx` tự gom bằng `import.meta.glob`. Thêm màn hình = thêm file trong feature của mình, không sửa router.
4. **Mock không dùng chung file**: mỗi feature có `features/<name>/mocks.ts`; MSW gom bằng glob.
5. **API type sinh tự động**: `web/src/lib/api/generated.ts` sinh từ `services/*/openapi.json`. Không sửa tay; muốn đổi contract thì báo Tuấn.
6. **E2E theo feature**: `web/e2e/<feature>.spec.ts`; chỉ owner của feature sửa file đó.
7. **Feature không tự thêm dependency**: yêu cầu Tuấn thêm vào `package.json` để tránh 4 người sửa cùng file.

## 2. Phân quyền thư mục

| Người | Feature | Thư mục sở hữu | Route sở hữu |
|---|---|---|---|
| **Tuấn** | Foundation + Dashboard + Settings | `features/auth`, `features/dashboard`, `features/settings`, `app/**`, `components/ui/**`, `lib/**` | `/login`, `/dashboard`, `/settings` |
| **Thành** | Events | `features/events/**` | `/events`, `/events/new`, `/events/:id`, `/events/:id/rooms`, `/events/:id/sessions`, `/events/:id/ticket-types` |
| **Vũ** | Orders, Tickets, Check-in, Scan | `features/orders/**`, `features/tickets/**`, `features/checkin/**` | `/orders`, `/orders/:id`, `/tickets`, `/tickets/:id`, `/checkins`, `/scan`, `/sync` |
| **Trọng** | Engagement | `features/engagement/**` | `/engagement/:sessionId`, `/engagement/:sessionId/qa`, `/polls`, `/quiz` |

`/` là redirect `/dashboard` (Tuấn).

## 3. Thứ tự làm & merge

1. **PR 1 — Foundation (Tuấn, blocking)**
   - Scaffold Vite + React + TS strict + Router + TanStack Query + Tailwind tokens.
   - `AuthProvider`, `RequireRole`, API client, error mapping, `AppShell`, UI kit tối thiểu.
   - Router glob + MSW glob + Playwright config + CI.
   - Xong PR này mọi người mới bắt đầu feature.
2. **PR 2–5 — Feature (song song)**
   - Mỗi người một PR: chỉ folder feature + `routes.tsx` + `mocks.ts` + `e2e/<feature>.spec.ts`.
   - Không sửa file của người khác; nếu cần shared component, nhắn Tuấn.
3. **PR 6 — Integration (Tuấn)**
   - Nối mock → gateway thật, bật feature flags/routes, chạy E2E toàn bộ, sửa lỗi tích hợp.
4. **PR 7 — Hardening**
   - Accessibility, performance, empty/error states, responsive; mỗi người sửa feature của mình.

Merge nhỏ, thường xuyên; rebase `main` mỗi ngày. Không merge nếu `bun run test`, `bun run typecheck`, `bun run e2e` đỏ.

## 4. API theo feature (đã có backend)

| Feature | Endpoint chính |
|---|---|
| Auth/Settings | `POST /api/auth/login`, `GET /api/auth/me` |
| Dashboard | `GET /api/events/:id`, `GET /api/checkins/stats?eventId=`, `GET /api/sessions/:id/stats` |
| Events | `GET/POST /api/events`, `GET/PATCH /api/events/:id`, `POST/PATCH .../rooms`, `.../sessions`, `.../ticket-types` |
| Orders | `GET /api/orders?eventId=`, `GET /api/orders/:id` |
| Tickets | `GET /api/tickets?eventId=`, `GET /api/tickets/:id`, `GET /api/tickets/:id/qr-token` |
| Check-in/Scan | `POST /api/checkins`, `POST /api/checkins/sync-offline`, `GET /api/checkins?eventId=`, `GET /api/checkins/stats` |
| Engagement | `/api/sessions/:id/questions`, `/api/questions/:id/votes`, `DELETE /api/questions/:id`, `/api/sessions/:id/polls`, `/api/polls/:id`, `/api/polls/:id/vote`, `/api/game/*`, `GET /api/sessions/:id/stats`, `/ws/qa`, `/ws/game` |

Hợp đồng đầy đủ: `docs/STAFF_WEB_STARTER.md` + `services/*/openapi.json`.

## 5. Review map (kiểm tra nhanh)

| Xem gì | Ở đâu | Ai review |
|---|---|---|
| Foundation, auth, router, UI kit | `web/src/app`, `web/src/lib`, `web/src/components/ui` | Thành + Vũ |
| Events | `web/src/features/events` | Tuấn |
| Orders/Tickets/Check-in | `web/src/features/orders`, `tickets`, `checkin` | Trọng |
| Engagement/Realtime | `web/src/features/engagement` | Vũ |
| E2E | `web/e2e/<feature>.spec.ts` | Người đối ứng |
| Contract lệch | `services/*/openapi.json` | Tuấn |

Luân phiên: Tuấn↔Thành, Vũ↔Trọng; PR nào chạm shared file thì Tuấn review.

## 6. Definition of Done cho mỗi feature

- [ ] Chỉ sửa trong folder feature của mình (trừ khi Tuấn đồng ý).
- [ ] Có `routes.tsx`, `mocks.ts`, `e2e/<feature>.spec.ts`.
- [ ] Loading / empty / error / 401 / 403 / 404 / 503 states.
- [ ] RBAC: STAFF không thấy nút sửa event; server vẫn là nơi enforce.
- [ ] Không dùng `any`; không import chéo feature.
- [ ] `bun run test`, `bun run typecheck`, `bun run e2e` xanh.
- [ ] `DESIGN.md`: light theme, không border, bottom shadow, không blur, contrast ≥ 4.5:1.
- [ ] Mobile responsive (≥ 375px).

## 7. Việc backend không cần làm nữa

A1–A12 đã xong; nếu UI thiếu dữ liệu, báo Tuấn để bổ sung **additive** vào OpenAPI/service, không tự sửa service. Các mục để Phase 2: cancel/refund, export CSV, offline web, cột `hidden`, cột `gate`.
