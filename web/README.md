# qEvent — Staff Web Console (phần của Tuấn)

Frontend cho STAFF/ORGANIZER: nền tảng, UI kit, AppShell, `/login`, `/dashboard`, `/settings`,
E2E harness và deploy. Kế hoạch gốc: `docs/STAFF_WEB_CONSOLE_PLAN.md`, chia việc:
`docs/STAFF_WEB_TEAM_SPLIT.md`. Design system ràng buộc: `DESIGN.md` (mode **Operate**).
Cách prompt agent để làm tiếp: `docs/WEB_AGENT_PROMPTS.md`.

## Chạy

```bash
bun install
bun run dev          # http://localhost:5173, proxy /api + /ws sang gateway :8000
```

Gateway phải chạy trước: `docker compose up -d` ở repo root.

Tài khoản demo: `organizer@qevent.com` / `staff1@qevent.com` / `attendee@qevent.com` — mật khẩu
`password123`.

## Script

| Lệnh | Việc |
|---|---|
| `bun run dev` | Vite dev server + proxy |
| `bun run build` | typecheck rồi build production |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | Biome check |
| `bun run lint:design` | chặn hex / border / blur / xám nhạt / màu Tailwind thô / HTML primitive trong code mình viết |
| `bun run lint:routes` | chặn 2 feature khai báo cùng một route |
| `bun run lint:encoding` | chặn chuỗi tiếng Việt bị lỗi double-encoding |
| `bun run test` | Vitest + MSW |
| `bun run e2e` | Playwright qua gateway thật (`docker compose up -d` trước) |
| `bun run evidence` | chụp ảnh 390/768/1440 vào `docs/evidence/ui/` (cần `bun run dev`) |
| `bun run gen:api` | sinh `src/lib/api/generated.ts` từ `services/*/openapi.json` |

## Ranh giới file

- Nhóm 1 (chỉ Tuấn): `package.json`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `src/main.tsx`,
  `src/app/**`, `src/components/ui/**`, `src/lib/**`, `src/styles/**`, `src/features/{auth,dashboard,settings}/**`,
  `scripts/**`, `test/**`, `e2e/**`, `Dockerfile`, `nginx.conf`.
- Nhóm 2 (mỗi người một vùng): `src/features/{events,orders,tickets,checkin,engagement}/**`.
- Nhóm 3 (generated, cấm sửa): `src/lib/api/generated.ts`.

Thêm màn hình = thêm `features/<tên>/routes.tsx` export `routes` (RouteObject[]) và `nav` (NavItem[]).
`router.tsx` và `AppShell` tự gom bằng glob; không sửa file của Tuấn.

## Nối dùng chung (đã đóng băng)

| Đường nối | File | Dùng thế nào |
|---|---|---|
| Event đang chọn | `lib/event-context.tsx` | `useEventContext()` → `eventId`, `setEventId`; URL là nguồn sự thật |
| Route | `lib/routes.ts` | `routes.orders({ eventId })`, không tự nối chuỗi |
| DTO | `lib/api/types.ts` | `EventSummary`, `OrderListItem`, `TicketListItem`, `CheckinListItem` |
| Query key | `lib/query/keys.ts` | `qk.orders.list(f)`; invalidate theo bảng §4.5 |
| Format | `lib/format/*` | `formatDate`, `formatMoney`, `formatTicketCode`, `statusLabel` |
| Realtime | `lib/realtime/useRealtime.ts` | `useRealtime({ channel: "qa", sessionId })` |

**Toàn bộ UI là shadcn/ui** (Radix + Tailwind 4), cài bằng CLI. **Không có component tự viết** — không
`components/app`, không wrapper riêng cho Button/Card/Table… Mọi màn hình ghép trực tiếp từ primitive shadcn.

```bash
bunx shadcn@latest add dialog sheet alert-dialog select table pagination tabs
```

- `src/components/ui/**` là source shadcn do CLI sinh (Tuấn hiệu chỉnh theo `DESIGN.md`): Button, Card,
  Input, Textarea, Select, Checkbox, Label, Badge, Dialog, Sheet, AlertDialog, Table, Pagination, Tabs,
  Skeleton, Sonner (toast), Chart, Field, Empty, Alert, Separator, DropdownMenu, Tooltip, Sidebar.
- Không có thư mục composition. Header màn hình, stat, banner, switcher… là JSX ghép từ `Card`,
  `Badge`, `Alert`, `Select`, `Button` ngay trong page/shell. Cần pattern lặp lại → thêm block bằng CLI
  hoặc chấp nhận lặp 3–5 dòng, **không tạo component mới**.
- Hàm thuần (format, map trạng thái → class Badge) nằm trong `src/lib/**`; nó không render gì.
- Token nằm duy nhất ở `src/styles/globals.css` (`--primary`, `--background`, `--radius`, `--shadow-card`…).
  Feature không hex, không override màu/bo góc bằng `className`, không `!important`.
- Sửa `src/components/ui/**` phải qua Tuấn; mọi thay đổi phải giữ luật console compact: viền 1px chỉ trong primitive/token, control 32px, radius 6/8/4, shadow hướng xuống.
- `bun run lint:design` quét `features/**`, `app/**`; `src/components/ui/**` do CLI sinh nên được miễn.
  Nó cũng chặn màu Tailwind thô (`emerald-600`, `amber-500`…) và HTML primitive (`<button>`, `<input>`…):
  dùng token (`success`, `warning`, `destructive`…) và component shadcn (`Button`, `Input`, `Progress`…).

Dev không cần gateway: mở `http://localhost:5173/login?mock=1` để chạy trên MSW fixtures
(`features/*/mocks.ts`), hoặc `bun run evidence` để chụp lại ảnh 390/768/1440.

## Trạng thái bắt buộc

Loading = skeleton đúng hình dạng (không spinner toàn trang) · Empty = lý do + hành động ·
Error = mã lỗi + thông điệp tiếng Việt + "Thử lại" · 401 = xoá phiên về `/login` ·
403 = màn hình từ chối, không logout · 503/504 = banner, phần còn lại vẫn render.
