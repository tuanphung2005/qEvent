# Staff Web — Kế hoạch chia việc 4 người (bản thực thi)

- Chốt ngày: 2026-11-15
- Trạng thái: **nguồn sự thật** cho chia việc frontend staff web. Bản 2026-11-14 chỉ chia theo folder; bản này chốt tới **file + hợp đồng nối**, đủ để 4 người code song song không sửa cùng một file.
- Tài liệu gốc (không thay thế): `docs/STAFF_WEB_CONSOLE_PLAN.md` — kiến trúc, API, lộ trình, demo script.
- Hợp đồng backend: `docs/STAFF_WEB_STARTER.md` + `services/*/openapi.json`.
- Design system ràng buộc: `DESIGN.md`, `PRODUCT.md`.
- Code hiện tại: **chưa có `web/`** — tất cả là greenfield, nên chốt ranh giới trước khi ai viết dòng đầu.

---

## 0. Đã chia 4 người chưa?

**Rồi, nhưng chưa đủ.** Bản cũ chia theo thư mục (`features/events`, `features/orders`…) nên tránh được conflict thô. Vẫn còn 14 điểm chồng lấn mà folder không giải quyết được, và 1 lỗi lệch route giữa 2 doc:

| # | Va chạm | Ai chạm | Cách chặn trong bản này |
|---|---|---|---|
| 1 | Thêm item sidebar = sửa `AppShell` | cả 4 | `features/<name>/routes.tsx` export `nav`; AppShell glob, không sửa tay (§4.2) |
| 2 | "Event đang chọn" mỗi người tự làm filter riêng | cả 4 | `lib/event-context` + `?eventId=` trên URL (§4.1) |
| 3 | DTO `attendee`/`ticket` lặp ở orders, tickets, checkins → lệch kiểu | Vũ, Tuấn | `lib/api/types.ts` alias từ generated (§4.4) |
| 4 | Invalidate cache chéo feature (`scan` → danh sách vé) | Vũ, Tuấn | `lib/query/keys.ts` (§4.5) |
| 5 | Link chéo feature (sessions → engagement) | Thành, Trọng | `lib/routes.ts` (§4.3) |
| 6 | Mỗi người tự thêm variant `Table`/`Card` | cả 4 | UI kit freeze ở PR1, thêm variant phải xin Tuấn (§6.0) |
| 7 | Fixture E2E/MSW ai cũng cần, ai cũng sửa | cả 4 | `test/msw/fixtures.ts` + `e2e/fixtures.ts` của Tuấn (§4.6) |
| 8 | 4 người cùng sửa `package.json` | cả 4 | Cài hết dependency ở PR1 (§5.1) |
| 9 | Hex/màu/spacing rải rác trong feature | cả 4 | Token Tailwind duy nhất + `bun run lint:design` (§8.3) |
| 10 | MSW handler trùng path | Vũ, Trọng | `features/<name>/mocks.ts` + glob, prefix theo feature (§4.7) |
| 11 | Tên route param lệch (`:id` vs `:eventId`) | Thành, Vũ, Trọng | Chốt `:eventId`, `:orderId`, `:ticketId`, `:sessionId` (§2) |
| 12 | `/engagement/:sessionId/polls` vs `/polls` — 2 doc ghi khác nhau | Trọng | Chốt nested (`/engagement/:sessionId/polls`, `/quiz`) (§2) |
| 13 | Format ngày/tiền/mã vé mỗi người một kiểu | cả 4 | `lib/format/*` (§4.8) |
| 14 | Ai cũng cần token đăng nhập trong test | cả 4 | `e2e/fixtures.ts` seed sẵn 3 role (§4.6) |

> Quy tắc vàng: **một file chỉ một chủ.** Nếu bạn cần sửa file không thuộc mình → nhắn chủ file, không tự sửa, không "sửa tạm".

---

## 1. Tóm tắt phân công

| Người | Vai trò | Màn hình sở hữu | Thư mục |
|---|---|---|---|
| **Tuấn** (lead) | Nền tảng + Dashboard + Tích hợp | `/login`, `/`, `/dashboard`, `/settings` | `app/**`, `components/ui/**`, `lib/**`, `styles/**`, `features/{auth,dashboard,settings}` |
| **Thành** | Event domain | `/events`, `/events/new`, `/events/:eventId` + 3 tab | `features/events/**` |
| **Vũ** | Admission domain + Scan | `/orders`, `/orders/:orderId`, `/tickets`, `/tickets/:ticketId`, `/checkins`, `/scan`, `/sync` | `features/{orders,tickets,checkin}/**` |
| **Trọng** | Engagement + Realtime | `/engagement/:sessionId` + 3 tab | `features/engagement/**` |

Tải: 20 / 20 / 20 / 20 ngày công (§6). Ai xong trước nhận bug từ bảng §10, không nhận feature của người khác.

---

## 2. Chốt route (canonical)

Bảng này thay cho route tree ở `STAFF_WEB_CONSOLE_PLAN.md` §4.1. Không thêm/bớt/đổi tên nếu không có PR của Tuấn.

| Route | Quyền | Chủ | Endpoint chính |
|---|---|---|---|
| `/login` | public | Tuấn | `POST /api/auth/login` |
| `/` → `/dashboard` | STAFF/ORG | Tuấn | — |
| `/dashboard` | STAFF/ORG | Tuấn | `GET /api/events/:id`, `/api/checkins/stats?eventId=`, `/api/sessions/:id/stats` |
| `/settings` | STAFF/ORG | Tuấn | `GET /api/auth/me` |
| `/events` | STAFF xem / ORG tạo | Thành | `GET /api/events` |
| `/events/new` | ORG | Thành | `POST /api/events` |
| `/events/:eventId` | STAFF xem / ORG sửa | Thành | `GET/PATCH /api/events/:id` |
| `/events/:eventId/rooms` | STAFF xem / ORG sửa | Thành | `POST/PATCH .../rooms` |
| `/events/:eventId/sessions` | STAFF xem / ORG sửa | Thành | `POST/PATCH .../sessions` |
| `/events/:eventId/ticket-types` | STAFF xem / ORG sửa | Thành | `POST/PATCH .../ticket-types` |
| `/orders` | STAFF/ORG | Vũ | `GET /api/orders?eventId=&status=&q=&cursor=` |
| `/orders/:orderId` | STAFF/ORG | Vũ | `GET /api/orders/:id` |
| `/tickets` | STAFF/ORG | Vũ | `GET /api/tickets?eventId=&status=&q=&cursor=` |
| `/tickets/:ticketId` | STAFF/ORG | Vũ | `GET /api/tickets/:id`, `/qr-token` |
| `/checkins` | STAFF/ORG | Vũ | `GET /api/checkins?eventId=&since=&gate=`, `/api/checkins/stats` |
| `/scan` | STAFF/ORG | Vũ | `POST /api/checkins` |
| `/sync` | STAFF/ORG | Vũ | `POST /api/checkins/sync-offline` (MVP: chỉ hiển thị trạng thái online-only) |
| `/engagement/:sessionId` | STAFF/ORG | Trọng | `GET /api/sessions/:id/questions` + `/polls` + `/api/sessions/:id/game` |
| `/engagement/:sessionId/qa` | STAFF/ORG | Trọng | `GET/POST /api/sessions/:id/questions`, `PUT /api/questions/:id/votes`, `DELETE /api/questions/:id` |
| `/engagement/:sessionId/polls` | STAFF/ORG | Trọng | `GET/POST /api/sessions/:id/polls`, `PATCH /api/polls/:id` |
| `/engagement/:sessionId/quiz` | STAFF/ORG | Trọng | `/api/sessions/:id/game`, `/api/game/:id/{question,start,reveal,next,end,leaderboard}` |

**Chốt kỹ thuật:**
- Param luôn đặt tên đầy đủ: `:eventId`, `:orderId`, `:ticketId`, `:sessionId`. Không dùng `:id`.
- Tab engagement là **route con**, không phải local state → reload/back/deep-link đều đúng, và Trọng không cần sửa file của người khác để thêm tab.
- `/poll`, `/quiz` độc lập ở bản cũ: **bỏ**, vì host luôn thao tác trong ngữ cảnh một session.
- Bộ lọc danh sách nằm trên **URL query** (`?status=&q=&cursor=&eventId=`), không nằm trong store → refresh giữ nguyên trạng thái, dễ E2E.

---

## 3. Ranh giới file (ai sở hữu cái gì)

Ba nhóm. Nhóm 1 chỉ Tuấn. Nhóm 2 chỉ chủ feature. Nhóm 3 là generated, **không ai sửa tay**.

### 3.1. Nhóm 1 — dùng chung, chủ: Tuấn (không ai khác commit vào)

```text
web/package.json  bun.lock  vite.config.ts  tsconfig.json  biome.json
web/index.html  Dockerfile  nginx.conf  .env.example
web/src/main.tsx
web/src/app/**                router, providers, AppShell, RequireRole, ErrorBoundary
web/src/components/ui/**      shadcn primitives (CLI; Tuấn hiệu chỉnh theo DESIGN.md) — không có component tự viết
web/src/lib/api/**            client, errors, generated.ts, types.ts
web/src/lib/query/**          keys.ts, client.ts
web/src/lib/format/**         date, currency, ticket-code, status-label
web/src/lib/event-context.tsx
web/src/lib/routes.ts
web/src/lib/realtime/**       useRealtime (Trọng dùng, không sửa)
web/src/styles/**             tokens.css, globals.css
web/src/features/{auth,dashboard,settings}/**
web/scripts/**                gen-api.ts, lint-design.mjs
web/test/setup.ts  web/test/msw/server.ts  web/test/msw/fixtures.ts
web/e2e/fixtures.ts  web/e2e/global-setup.ts  web/playwright.config.ts
.github/workflows/web.yml
```

### 3.2. Nhóm 2 — mỗi người một vùng, tự chứa

```text
web/src/features/events/**       Thành
web/src/features/orders/**       Vũ
web/src/features/tickets/**      Vũ
web/src/features/checkin/**      Vũ
web/src/features/engagement/**   Trọng
```

Trong feature của mình, cấu trúc bắt buộc:

```text
features/events/
├── routes.tsx        # export const routes: RouteObject[]; export const nav: NavItem[]
├── mocks.ts          # export const handlers: RequestHandler[]
├── api.ts            # hook TanStack Query + gọi lib/api client
├── types.ts          # type riêng của feature (view model), DTO lấy từ lib/api/types
├── pages/            # 1 file / màn hình, tên = route
├── components/       # component riêng feature
└── __tests__/        # unit + component
```

### 3.3. Nhóm 3 — generated, cấm sửa

```text
web/src/lib/api/generated.ts     # openapi-typescript, sinh từ services/*/openapi.json
```

Contract lệch → báo Tuấn, Tuấn chạy `bun run gen:api`. Không ai sửa `services/**` (backend đã đóng băng A1–A12).

---

## 4. Sáu đường nối bắt buộc dùng chung

Đây là phần khiến 4 người không giẫm chân. Tuấn ship trong PR1, **API đóng băng**; ai cần thêm thì mở issue, không tự thêm.

### 4.1. Event đang chọn — `lib/event-context.tsx`

```ts
export function useEventContext(): {
  eventId: string | null;          // nguồn sự thật: query ?eventId=
  setEventId(id: string): void;    // setQuery, không setState cục bộ
  event: EventSummary | null;
  isLoading: boolean;
};
```

- URL là nguồn sự thật duy nhất. Không ai tự lưu event vào context/store riêng.
- Mọi màn hình hình thành từ chọn event. `/scan`, `/settings` không bắt buộc.
- bộ chọn sự kiện (Select) nằm trong AppShell (Tuấn). Feature chỉ đọc `eventId` để build query.
- Không có `eventId` → màn hình hiện `Empty` "Chọn sự kiện để xem dữ liệu", không tự gọi API `?eventId=undefined`.

### 4.2. Route + nav tự gom — `features/<name>/routes.tsx`

```ts
import type { RouteObject } from 'react-router';
export interface NavItem {
  to: string;
  label: string;                                    // tiếng Việt
  icon: 'calendar' | 'receipt' | 'ticket' | 'scan' | 'chart' | 'settings';
  roles: Array<'STAFF' | 'ORGANIZER'>;
  order: number;
}
export const routes: RouteObject[];
export const nav: NavItem[];
```

- `app/router.tsx` dùng `import.meta.glob('../features/*/routes.tsx', { eager: true })` → gom `routes`.
- `AppShell` dùng cùng glob → gom `nav`, sort theo `order`, ẩn theo `roles`.
- **Hệ quả:** thêm màn hình = thêm file trong feature mình; không ai mở `AppShell` hay `router.tsx`.
- Một route chỉ được khai báo đúng một lần trên toàn repo. Trùng path → CI fail (`lint:routes`).

### 4.3. Link chéo feature — `lib/routes.ts`

```ts
export const routes = {
  dashboard: () => '/dashboard',
  events: (f?: ListFilter) => qs('/events', f),
  event: (eventId: string) => `/events/${eventId}`,
  eventRooms: (eventId: string) => `/events/${eventId}/rooms`,
  eventSessions: (eventId: string) => `/events/${eventId}/sessions`,
  eventTicketTypes: (eventId: string) => `/events/${eventId}/ticket-types`,
  orders: (f?: ListFilter) => qs('/orders', f),
  order: (orderId: string) => `/orders/${orderId}`,
  tickets: (f?: ListFilter) => qs('/tickets', f),
  ticket: (ticketId: string) => `/tickets/${ticketId}`,
  checkins: (f?: ListFilter) => qs('/checkins', f),
  scan: () => '/scan',
  sync: () => '/sync',
  engagement: (sessionId: string, tab: 'qa' | 'polls' | 'quiz' = 'qa') =>
    `/engagement/${sessionId}${tab === 'qa' ? '' : `/${tab}`}`,
  settings: () => '/settings',
};
```

Cấm viết chuỗi `'/orders/' + id` trong feature. Lý do: đổi route 1 lần, 4 người không phải sửa 40 chỗ.

### 4.4. Kiểu DTO dùng chung — `lib/api/types.ts`

```ts
import type { components } from './generated';
export type User = components['schemas']['User'];
export type Attendee = components['schemas']['Attendee'];
export type EventSummary = components['schemas']['EventSummary'];
export type OrderListItem = components['schemas']['OrderListItem'];
export type TicketListItem = components['schemas']['TicketListItem'];
export type CheckinListItem = components['schemas']['CheckinListItem'];
export type ListResponse<T> = { items: T[]; nextCursor: string | null };
export type ApiError = { code: string; message: string; status: number };
```

- Feature **không** khai báo lại shape response. Chỉ được thêm view model riêng (`EventsTableRow`) trong `features/<name>/types.ts`, suy ra từ DTO bằng `Pick`/`Omit`.
- `any` bị chặn ở lint. Bất khả kháng thì `unknown` + type guard, ghi lý do tại chỗ.

### 4.5. Query key — `lib/query/keys.ts`

```ts
export const qk = {
  me: () => ['me'] as const,
  events: {
    list: (f: ListFilter) => ['events', 'list', f] as const,
    detail: (eventId: string) => ['events', 'detail', eventId] as const,
  },
  orders: {
    list: (f: ListFilter) => ['orders', 'list', f] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  },
  tickets: { list: (f) => ['tickets', 'list', f] as const, detail: (id) => ['tickets', 'detail', id] as const },
  checkins: { list: (f) => ['checkins', 'list', f] as const, stats: (eventId) => ['checkins', 'stats', eventId] as const },
  engagement: {
    questions: (sessionId: string) => ['engagement', 'questions', sessionId] as const,
    polls: (sessionId: string) => ['engagement', 'polls', sessionId] as const,
    game: (sessionId: string) => ['engagement', 'game', sessionId] as const,
  },
};
```

Quy ước invalidate (bắt buộc, để không ai phải đọc code người khác):

| Hành động | Invalidate |
|---|---|
| Quét vé thành công (`/scan`) | `qk.checkins.list('*')`, `qk.checkins.stats(eventId)`, `qk.tickets.list('*')` |
| Sửa event/room/session/ticket type | `qk.events.detail(eventId)`, `qk.events.list('*')` |
| Ẩn/xoá Q&A, mở/đóng poll, đổi state quiz | key engagement tương ứng của `sessionId` |
| Nhận message WebSocket | invalidate đúng key engagement, không refetch toàn bộ |

### 4.6. Fixture test — `test/msw/fixtures.ts`, `e2e/fixtures.ts`

```ts
// test/msw/fixtures.ts  (chỉ Tuấn sửa)
export const organizer: User;
export const staff: User;
export const eventFixture: EventSummary;
export const sessionFixture: Session;
export const orderFixture: OrderListItem;
export const ticketFixture: TicketListItem;
export const checkinFixture: CheckinListItem;
export function makeList<T>(items: T[], nextCursor?: string | null): ListResponse<T>;

// e2e/fixtures.ts  (chỉ Tuấn sửa)
export async function seedBase(page: Page): Promise<{ organizerToken: string; staffToken: string; attendeeToken: string; eventId: string }>;
export const storageState = { organizer: string; staff: string; attendee: string };
```

Feature chỉ được **đọc/import** các fixture này và tự thêm data riêng trong `features/<name>/mocks.ts` của mình.

### 4.7. MSW theo feature

- `features/<name>/mocks.ts` export `handlers: RequestHandler[]`, path phải nằm trong miền của feature (orders → `/api/orders*`).
- `test/msw/server.ts` (Tuấn) glob handler; dev dùng `?mock=1` để bật.
- Cấm override handler của feature khác. Cần response lỗi cho feature mình → khai báo handler riêng trong file của mình.

### 4.8. Format — `lib/format/*`

`formatDate(iso) → "15/11/2026 14:30"`, `formatTime`, `formatMoney(vnd) → "1.200.000 ₫"`, `formatTicketCode(id) → "QE-7F3A-…"`, `statusLabel(code) → "Đã xác nhận"`. Cấm `toLocaleString` rải rác trong feature (lệch locale giữa các máy).

---

## 5. Gate PR1 — Foundation (Tuấn, blocking)

Không ai bắt đầu UI trước khi PR1 merge. Nhưng để không chết thời gian, Thành/Vũ/Trọng làm **phần không cần UI** song song ngay từ ngày 1 (§7).

### 5.1. PR1a — Scaffold (ngày 1–2)

- Vite 6 + React 19 + TS strict + React Router 7 + TanStack Query 5 + Tailwind 4 + Biome.
- Cài **hết** dependency một lần (không ai thêm sau):

```text
react-router  @tanstack/react-query  react-hook-form  zod  @hookform/resolvers
recharts  @zxing/browser  idb  clsx
vitest  @testing-library/react  @testing-library/user-event  jsdom  msw
@playwright/test  @axe-core/playwright
openapi-typescript  openapi-fetch  @biomejs/biome  tailwindcss
```

- `styles/tokens.css` map đủ `DESIGN.md` (§8.3), `styles/globals.css` reset + selection + focus.
- `lib/api/client.ts` (bearer, base URL rỗng + Vite proxy), `lib/api/errors.ts` (map `ApiError` → message tiếng Việt), `lib/api/generated.ts` từ `bun run gen:api`.
- `lib/format/*`, `lib/routes.ts`, `lib/query/keys.ts`, `lib/event-context.tsx`.
- `scripts/lint-design.mjs`: fail khi trong `src/features/**` hoặc `src/components/**` có `#rrggbb`, `border:`/`borderWidth`, `blur(`, `backdrop-filter`, `#94A3B8`/`#CBD5E1`/`#9CA3AF`, `outline:`. Chạy trong CI.
- Router glob + MSW glob + `nav` glob + `lint:routes` (trùng path fail).

### 5.2. PR1b — Kit + Shell + Auth (ngày 3–5)

- UI kit shadcn qua CLI: `button`, `card`, `input`, `select`, `textarea`, `checkbox`, `label`, `badge`, `dialog`, `sheet`, `alert-dialog`, `table`, `pagination`, `tabs`, `skeleton`, `sonner`, `chart`, `field`, `empty`, `alert`, `separator`, `dropdown-menu`, `tooltip`, `sidebar`. Không có component tự viết; page ghép trực tiếp từ các primitive này.
- `AuthProvider` + `RequireRole` + `LoginPage` + logout + 401 handler.
- `AppShell`: sidebar/rail/bottom-nav theo breakpoint, bộ chọn sự kiện (Select), realtime dot, user menu.
- `e2e/fixtures.ts`, `playwright.config.ts`, `test/setup.ts`, `test/msw/{server,fixtures}.ts`, CI workflow, Dockerfile + nginx.conf.

**Điều kiện merge PR1:** `bun run lint && typecheck && test && build && e2e:smoke` xanh; app mở được, login organizer thật, thấy sidebar rỗng (nav do feature cung cấp) và `/dashboard` skeleton.

---

## 6. Việc từng người

### 6.0. Luật dùng UI kit (áp cho cả 4)

- UI kit là **shadcn/ui** trong `src/components/ui/**`, cài bằng CLI — không tự viết primitive, không
  wrapper riêng, không copy-paste style.
  ```bash
  bunx shadcn@latest add dialog sheet alert-dialog select table pagination tabs skeleton
  ```
- Không có tầng composition: header màn hình (h1 + meta + actions), stat card, banner lỗi, event switcher… là JSX ghép từ `Card`,
  `Badge`, `Alert`, `Select`, `Button` ngay trong page/shell. Cần pattern lặp → thêm block bằng CLI hoặc
  lặp vài dòng, không tạo component mới.
- Hàm thuần (format, `statusToneClass`) ở `src/lib/**` — không render.
- Được phép: dùng `variant` (`default | secondary | ghost | destructive | outline | link`), `size`
  (`sm | default | lg | icon`), và các primitive có sẵn. Không `className` để đổi màu/bo góc/shadow.
- Sửa `src/components/ui/**` phải qua Tuấn; giữ luật zero-border / 44px / shadow hướng xuống.
- Không bao giờ `!important`, không `style={{}}` inline để né token.

### 6.1. Tuấn — Nền tảng, Dashboard, Tích hợp (20 ngày)

| ID | Việc | File | Ngày |
|---|---|---|---|
| T1 | Scaffold + tooling + lint:design + lint:routes | `package.json`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `scripts/**` | 3 |
| T2 | API client, lỗi, generated, types, format, query keys, event context, routes | `lib/**` | 3 |
| T3 | UI kit 23 component + test hành vi chính | `components/ui/**` | 5 |
| T4 | AppShell, nav glob, bộ chọn sự kiện (Select), RequireRole, ErrorBoundary, providers | `app/**` | 3 |
| T5 | `/login`, `/settings` | `features/auth`, `features/settings` | 1.5 |
| T6 | `/dashboard`: 3 service song song, degraded khi 503, chart check-in | `features/dashboard/**` | 2.5 |
| T7 | E2E harness, fixtures, CI, Dockerfile, nginx, compose service `web` | `e2e/**`, `test/**`, CI, Docker | 2 |

**Acceptance:** login organizer/staff OK, attendee 403; reload giữ phiên; 401 tự logout; dashboard đúng số liệu event đang chọn và vẫn hiển thị phần còn lại khi 1 service chết; `docker compose up` → `http://localhost:8080`.

**Không làm:** màn hình của người khác, kể cả khi "tiện tay sửa 1 dòng".

### 6.2. Thành — Event domain (20 ngày)

| ID | Việc | Ngày |
|---|---|---|
| E1 | `/events`: bảng + hàng lọc (Input + Select) (status, search debounce 300ms) + cursor | 3 |
| E2 | `/events/new`: form nested rooms/sessions/ticketTypes, Zod, 422 theo field | 5 |
| E3 | `/events/:eventId`: header màn hình (h1 + meta + actions) + overview + counts + edit inline | 3 |
| E4 | tab Rooms: bảng + modal thêm/sửa + validate capacity | 2.5 |
| E5 | tab Sessions: bảng + modal + toggle `isLive` có confirm | 3 |
| E6 | tab Ticket Types: bảng + modal + cảnh báo quota > maxCapacity (không chặn) + 409 `QUOTA_BELOW_SOLD` | 2.5 |
| E7 | Unit/component test + mocks + polish | 1 |

**Acceptance:** tạo 1 event + 2 session + 2 ticket type trong 1 form; lỗi thời gian hiện đúng field; STAFF **không thấy** nút tạo/sửa ở cả 6 màn hình; gọi API trực tiếp vẫn 403; sửa session `isLive` → engagement nhận được.

**Không làm:** `/scan`, `/orders`, engagement, `lib/**`, `components/ui/**`.

### 6.3. Vũ — Orders, Tickets, Check-in, Scan (20 ngày)

| ID | Việc | Ngày |
|---|---|---|
| V1 | `/orders`: bảng + filter status + search + cursor | 2.5 |
| V2 | `/orders/:orderId`: chi tiết + tickets + timeline trạng thái | 2 |
| V3 | `/tickets`: bảng + filter + search email/tên/mã | 2.5 |
| V4 | `/tickets/:ticketId`: chi tiết + `checkinLogs` + Reveal QR (modal, tự ẩn 30s, không log token) | 2 |
| V5 | `/checkins`: feed + stats + polling 3s khi tab active + pause/resume + filter gate | 3 |
| V6 | `/scan`: ZXing lazy, manual paste, gate/deviceId, result state, beep Web Audio, `navigator.vibrate`, debounce 3s, lịch sử 10 | 5 |
| V7 | `/sync`: trạng thái online-only, giải thích lý do, link sang app mobile | 1.5 |
| V8 | Test mapping scan + component test + mocks | 1.5 |

**Bảng mapping kết quả scan (đóng băng):**

| HTTP / code | UI | Âm/rung |
|---|---|---|
| `201 CHECKIN_SUCCESS` | Xanh, tên attendee, giờ | 1 beep, 1 rung ngắn |
| `409 ALREADY_CHECKED_IN` | Vàng, giờ check-in trước | 2 beep, 2 rung |
| `400 INVALID_QR_TOKEN` | Đỏ, lý do | beep dài, rung dài |
| `409 ORDER_NOT_CONFIRMED` | Đỏ, "đơn chưa xác nhận" | beep dài |
| `403` | Đỏ, "không có quyền" | 1 rung |
| `503/504` | Xám, "dịch vụ không phản hồi" | không beep |
| mất mạng | Xám, "cần mạng" | không beep |

**Acceptance:** vé hợp lệ → xanh <1s sau response; quét lại → vàng; sai chữ ký → đỏ; 2 staff quét cùng vé → 1 xanh 1 vàng; `/checkins` cập nhật ≤5s; search không gọi API mỗi ký tự.

**Không làm:** engagement, event CRUD, `lib/**`, `components/ui/**`.

### 6.4. Trọng — Engagement + Realtime (20 ngày)

| ID | Việc | Ngày |
|---|---|---|
| G1 | `/engagement/:sessionId`: shell + session picker (gọi `GET /api/events/:eventId` lấy sessions) + `useRealtime` + banner trạng thái | 5 |
| G2 | tab Q&A: list theo upvote, highlight câu mới, ẩn/xoá có confirm, số vote realtime | 4 |
| G3 | tab Polls: tạo 2–10 option, mở/đóng, thanh kết quả, tổng vote, disable khi đóng | 4 |
| G4 | tab Quiz: tạo game, thêm câu 2–6 option + correct + timeLimit, start/reveal/next/end, leaderboard, confirm cho next/end | 5 |
| G5 | Test state machine UI + fallback polling + mocks | 2 |

**Dùng `lib/realtime` của Tuấn** (reconnect 1/2/4/8/16/30s + jitter, heartbeat 25s, fallback polling 5s sau 30s, refetch 1 lần khi reconnect). Không tự viết WebSocket client thứ hai.

**Acceptance:** 2 browser — Q&A mới <1s, vote <1s; poll đóng thì vote bị từ chối và UI disable; quiz chỉ host đổi state, attendee không thấy đáp án trước reveal (web chỉ hiển thị theo response); mất WS → polling + banner; reconnect tự phục hồi; Q&A khi session chưa live → 403 đúng thông điệp.

**Không làm:** sửa `lib/realtime`, sửa engagement service, màn hình của người khác.

---

## 7. Lịch 4 tuần + cổng gác

| Tuần | Cổng gác (không qua = không merge tiếp) | Tuấn | Thành | Vũ | Trọng |
|---|---|---|---|---|---|
| 1 | **PR1 merge ngày 5**; route tree + nav + DTO freeze | T1–T4 một phần, PR1a/PR1b | E1 ở chế độ mock + skeleton form E2 | V1 + V6 prototype camera (không style) | G1 skeleton + hook realtime gọi service thật |
| 2 | Event CRUD chạy thật; orders/tickets đọc thật | T5/T6 dashboard, CI | E2–E3 | V2–V4 | G1 + G2 |
| 3 | Scan xanh/vàng/đỏ thật; poll/quiz chạy | T6 polish, E2E harness | E4–E6 | V5 + V6 | G3–G4 |
| 4 | **Hardening + demo khô** | T7 + integration (mock → gateway), a11y toàn cục | E7 + bug | V7–V8 + bug | G5 + bug |

**Nhịp merge:** rebase `main` mỗi sáng; PR ≤ 400 dòng diff; mỗi PR 1 reviewer luân phiên (Tuấn↔Thành, Vũ↔Trọng); PR chạm file nhóm 1 chỉ Tuấn merge.

**Thứ tự cắt khi trễ** (chỉ cắt 3, không cắt 1):
1. Không cắt: auth/RBAC, event CRUD, scan online, check-in result, Q&A/poll/quiz cơ bản, 5 luồng E2E.
2. Cắt được: chart nâng cao, `/sync` chi tiết, rate limit login, dashboard nhiều chart.
3. Hoãn: offline web, export CSV, cancel/refund, visual regression, settings nâng cao.

---

## 8. Quy tắc UI (theo `impeccable`, mode **Operate**)

Staff web là **Operate**, không phải Persuade. Người dùng đang làm việc dưới áp lực cổng soát vé: mục tiêu là **quen thuộc và nhanh**, không phải gây ấn tượng. "Công cụ phải biến mất vào công việc." Thương hiệu nằm ở chi tiết chính xác, không ở trang trí.

Hệ quả trực tiếp: **không** chạy `impeccable bolder | colorize | delight | overdrive` cho surface này. Được chạy `audit`, `critique`, `polish`, `harden`, `clarify`, `adapt`.

### 8.1. Mười nguyên tắc

1. **Một ngôn ngữ component.** Nút "Lưu" ở 2 màn hình phải giống hệt nhau. Lệch = 1 trong 2 sai.
2. **Trạng thái đủ bộ.** Mỗi control có default / hover / focus / active / disabled / loading / error. Không ship nửa bộ.
3. **Phân tầng bằng nền, không bằng đường kẻ.** `border: 0` toàn bộ.
4. **Một màu nhấn.** Xanh `#2563EB` chỉ cho hành động chính, mục đang chọn, link. Không tô màu để trang trí.
5. **Màu ngữ nghĩa là monosemy.** Emerald/Amber/Crimson **chỉ** cho trạng thái vé và đồng bộ.
6. **Số liệu đọc được trong 1 giây.** `tabular-nums`, căn phải, đơn vị nhỏ hơn số.
7. **Skeleton thay spinner.** Spinner toàn trang bị cấm; skeleton đúng hình dạng nội dung cuối.
8. **Empty state dạy cách dùng**, không phải "Không có dữ liệu".
9. **Modal là lựa chọn cuối.** Ưu tiên inline edit / progressive disclosure; modal chỉ cho quyết định phải chặn luồng.
10. **Mật độ là tính năng.** Bảng nhiều dòng, panel nhiều nhãn — nhưng khoảng thở vẫn theo thang 4/8/16/24/32.

### 8.2. Mode & "slop test"

Test trước khi merge: *một người quen dùng admin tool có tin được giao diện này ngay không, hay phải dừng lại ở từng component hơi lệch?* Lỗi thường gặp phải tránh: nút quá trang trí, form control không đồng bộ, animation vô nghĩa, font display trên label, affordance tự chế (scrollbar riêng, modal lạ, control không chuẩn), màu đậm trên trạng thái không active.

### 8.3. Token — nguồn duy nhất `styles/globals.css`

```css
:root {
  --color-primary: #2563EB;      --color-primary-hover: #1D4ED8;
  --color-primary-light: #EFF6FF;
  --color-surface: #FFFFFF;      --color-bg: #F8FAFC;
  --color-ink: #0F172A;          --color-body: #334155;   --color-muted: #475569;
  --color-fill: #F1F5F9;         --color-fill-active: #E2E8F0;
  --color-success: #10B981;      --color-success-bg: #ECFDF5;
  --color-warning: #D97706;      --color-warning-bg: #FFFBEB;
  --color-error: #DC2626;        --color-error-bg: #FEF2F2;
  --color-scrim: rgba(15, 23, 42, 0.45);
  --radius-card: 16px; --radius-control: 12px; --radius-pill: 9999px;
  --shadow-subtle: 0 2px 6px rgba(0,0,0,.05);
  --shadow-card: 0 4px 10px rgba(0,0,0,.07);
  --shadow-float: 0 8px 16px rgba(0,0,0,.12);
  --space-1: 4px; --space-2: 8px; --space-3: 16px; --space-4: 20px; --space-5: 24px; --space-6: 32px;
  --dur-fast: 150ms; --dur-base: 200ms;
}
```

Tailwind theme map 1-1 (shadcn variables): `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-secondary`, `text-primary`, `bg-success/10`, `text-warning`, `text-destructive`, `rounded-card`, `shadow-card`, `shadow-float`. **Cấm hex trong feature** — `bun run lint:design` fail CI.

### 8.4. Cấm tuyệt đối

`border` / `border-bottom` / hairline · `blur` / `backdrop-filter` / glass · gradient · chữ xám nhạt (`#94A3B8`, `#CBD5E1`, `#9CA3AF`) · shadow đa hướng hoặc offset Y âm · dark mode · icon-only button có nền màu (icon đen, vùng bấm 48×48) · card lồng card (elevation soup) · spinner toàn trang · `outline` làm focus ring (dùng `box-shadow`) · palette-load choreography, parallax, animation lặp vô hạn · scrollbar tự chế · `!important` · inline style để né token · emoji làm icon.

### 8.5. Typography

- **Một family**: system sans (Roboto/SF). Không font display trong UI. Mono chỉ cho mã vé/order id.
- Thang cố định (không `clamp`): `28/700` display · `20/700` headline · `16/600` title · `14/400` body · `12/600` label + `tracking:.2px` (chữ thường nhãn bảng có thể uppercase).
- Weight tối thiểu cho label và badge: **600**. Không weight < 400.
- Số trong bảng/stat: `font-variant-numeric: tabular-nums`.
- Đo dòng prose (mô tả, ghi chú): 65–75ch. Bảng được phép >120ch.

### 8.6. Layout

| Breakpoint | Nav | Content |
|---|---|---|
| ≥1280px | sidebar 240px cố định | max-width 1440px, padding 24px |
| 768–1279px | rail 72px (icon + tooltip) | full, padding 20px |
| <768px | bottom nav 3–5 mục | padding 16px; bảng cuộn ngang trong container riêng |

- Page pattern cố định: header màn hình (h1 + meta + actions) (title + meta + actions bên phải) → hàng lọc (Input + Select) (nếu là list) → nội dung → `Pagination` ở chân.
- Nhịp dọc: 16px giữa card, 24px giữa section, 32px giữa nhóm chức năng.
- Hai lớp nền: app `#F8FAFC`, content `#FFFFFF`. Sidebar và top bar là surface trắng + `shadow-subtle`, **không** tô màu thương hiệu.
- Vùng bấm: ≥44px desktop, ≥48px tablet (scan/check-in). Khoảng cách giữa 2 target ≥8px.
- Không đặt hành động chính ở góc trên phải xa tầm tay trên tablet ở cổng.

### 8.7. Bảng (thành phần dùng nhiều nhất)

- Header: label 12/600, sticky khi scroll, nền `#F8FAFC`, cao 44px.
- Row: cao 52px, hover `#F8FAFC`, selected `#EFF6FF`, **không** zebra striping.
- Căn: text trái, số/money phải + `tabular-nums`, badge cột riêng.
- Trạng thái = `Badge` pill (nền nhạt + chữ đậm semantic), không dùng màu chữ trần.
- Cột ngày: `15/11 · 14:30` (không lặp năm nếu cùng năm).
- Rỗng: `Empty` bên trong bảng (không render header trống).
- Loading: 8 skeleton row đúng số cột. Error: 1 dòng trong bảng + nút "Thử lại".
- Phân trang: cursor, `limit` 20, hiện "20 / 240". Search debounce 300ms, giữ từ khoá trên URL.
- Cột đầu (mã vé/order) là mono và được copy bằng click — có feedback "Đã copy".

### 8.8. Form

- Label trên field 6px, 12/600; helper 12/400 `--color-muted`; lỗi **thay chỗ** helper, `--color-error` + icon, có `aria-describedby`.
- Control cao 44px, radius 12, nền `--color-fill`, focus đổi nền sang `--color-fill-active` + ring `0 0 0 3px rgba(37,99,235,.25)`.
- 12px giữa field cùng nhóm, 24px giữa nhóm; nhóm dài chia section có heading 16/600.
- Validate khi blur + submit, không validate từng ký tự. Lỗi server 422 map về field theo `code`.
- Nút submit cố định chân form khi form dài; disable khi `isPending`; **không** reset form sau lỗi 503.
- Hành động phá huỷ (đóng poll, end quiz, xoá câu hỏi): `AlertDialog` nêu rõ hậu quả; không dùng `window.confirm`.

### 8.9. Trạng thái bắt buộc (mỗi màn hình)

| Trạng thái | Yêu cầu |
|---|---|
| Loading | Skeleton đúng layout; không spinner giữa nội dung |
| Empty | 1 dòng lý do + 1 hành động chính ("Chưa có sự kiện. Tạo sự kiện đầu tiên.") |
| Error | Mã lỗi + thông điệp tiếng Việt + "Thử lại"; không stack trace |
| 401 | Xoá phiên → `/login` + "Phiên đã hết hạn" |
| 403 | Trang/banner "Bạn không có quyền cho thao tác này" + đường về; **không** tự logout |
| 404 | "Không tìm thấy" + quay lại danh sách |
| 409 / 422 | Lỗi tại chỗ (field hoặc banner trong màn hình), giữ nguyên dữ liệu người dùng đã nhập |
| 503/504 | Banner "Dịch vụ tạm thời không phản hồi", các phần khác vẫn render, có "Thử lại" |
| Mất mạng | Banner offline cố định trên cùng; scanner báo "cần mạng" (không quyết định xanh) |

### 8.10. Overlay

- Dùng `<dialog>` / portal, `position: fixed`; không nhét dropdown trong ancestor `overflow: hidden`.
- `Dialog` (shadcn): scrim `rgba(15,23,42,.45)`, surface trắng radius 16, `shadow-float`, max-width 560px, focus trap, `Esc` đóng, focus trả về phần tử mở.
- `Sheet` (shadcn): dùng cho chi tiết nhanh trên desktop (order/ticket) khi không cần URL riêng.
- Toast = `sonner` (`toast()`), góc dưới phải, 4s, tối đa 3 cái, chỉ cho kết quả hành động; lỗi field không dùng toast.

### 8.11. Motion

- 150–200ms, `ease-out`. Chỉ cho: đổi trạng thái, hành động, loading, reveal, kết quả scan.
- Cấm: chuỗi animation khi vào trang, parallax, animation lặp (trừ countdown/connection pulse của engagement), transition trên layout của bảng.
- `prefers-reduced-motion: reduce` → cắt về 0ms hoặc crossfade 100ms.
- Realtime: dòng mới fade-in 150ms, **không** auto-scroll nếu người dùng đang đọc (hiện chip "3 câu hỏi mới").

### 8.12. Accessibility (không thương lượng)

- Keyboard: mọi thao tác làm được không cần chuột; thứ tự tab theo thứ tự đọc; `Esc` đóng overlay; `/` focus ô search.
- Focus **luôn nhìn thấy** bằng ring `box-shadow`, không `outline: none` trần.
- `aria-live="polite"` cho kết quả scan và dòng realtime mới; `role="status"` cho banner.
- Icon-only button có `aria-label`; input có label thật (không placeholder-only).
- Contrast: body ≥4.5:1, chữ ≥18px/700 ≥3:1; badge kiểm bằng axe trong E2E.
- Ảnh/QR có `alt`; QR token không bao giờ vào `alt`, `title`, hay log.

### 8.13. Ngoại lệ: `/scan` (màn hình áp lực cao nhất)

- Camera chiếm ≥50% chiều cao; không có card bao quanh camera (viền/bo góc làm mất vùng quét).
- Kết quả là **một khối màu toàn màn hình** (xanh/vàng/đỏ/xám) + tên attendee + giờ, chữ ≥20/700; không mở modal sau khi quét.
- "Quét tiếp" nằm trong 1/3 dưới màn hình, ≥56px cao, là hành động lớn nhất trên màn hình.
- Gate selector (segmented) + `deviceId` hiển thị cố định trên cùng; đổi gate không reset lịch sử.
- Lịch sử 10 lần gần nhất: giờ + dot màu + mã vé rút gọn; bấm để xem lại lý do.
- Beep ≤120ms, âm lượng vừa; rung qua `navigator.vibrate` có guard; tôn trọng chế độ im lặng của OS.
- Không animate kết quả quá 200ms; không đổi màu liên tục; không rung lặp.

### 8.14. Copy (tiếng Việt, identifier tiếng Anh)

- Nút: động từ trước — "Tạo sự kiện", "Quét tiếp", "Đóng poll", "Lưu thay đổi".
- Lỗi = **chuyện gì xảy ra + làm gì tiếp** — "Không giảm được sức chứa: đã bán 120 vé. Tăng quota hoặc huỷ vé trước." Không "Oops", không "Đã xảy ra lỗi", không dấu chấm than.
- Không viết hoa toàn bộ câu; chỉ uppercase nhãn ngắn ≤2 từ.
- Số và ngày theo `lib/format`; tiền có đơn vị `₫`.
- Trạng thái dùng đúng từ backend: `CONFIRMED` → "Đã xác nhận", `ALREADY_CHECKED_IN` → "Vé đã được soát".

### 8.15. Chart (dashboard)

- Tối đa 1 chart/dashboard; bar chart check-in theo giờ hoặc tỉ lệ đã soát.
- Một màu nhấn cho dữ liệu, xám cho trục/lưới; semantic color chỉ khi trạng thái là chủ đề.
- Không 3D, không gradient, không legend nếu ≤2 series; số cụ thể hiện trong card số liệu phía trên.
- Trục Y bắt đầu từ 0; nhãn ≤6 mốc; tooltip hiện số + giờ.

### 8.16. Kiểm chứng (mỗi feature, trước khi mở PR)

1. `bun run lint:design` xanh (không hex, không border, không blur, không xám nhạt).
2. `bun run audit` trên màn hình của mình: axe 0 serious/critical, keyboard đi hết luồng, contrast đạt.
3. Screenshot 3 bề rộng **390 / 768 / 1440** cho mỗi màn hình vào `docs/evidence/ui/<feature>/<screen>-{390,768,1440}.png`.
4. Soát 10 mục §8.1 + bảng cấm §8.4 bằng mắt, ghi 1 dòng "đã soát" trong PR.
5. Chỉ **một** vòng sửa sau khi review, một vòng xác nhận. Không polish vô hạn.

### 8.17. Ranh giới thẩm mỹ

- Bar là *familiarity*, không phải *novelty*. Nếu một pattern chuẩn (sidebar, tabs, table, pagination, modal) đã đúng thì dùng nó, đừng phát minh.
- Cá tính chỉ được đặt ở 3 chỗ: **màn hình kết quả scan** (khối màu dứt khoát), **empty state** (giọng văn), **số liệu** (typography số đẹp). Ngoài 3 chỗ đó: im lặng.
- Nếu một quyết định visual không phục vụ tốc độ đọc hoặc tốc độ bấm → cắt.

---

## 9. Test & bằng chứng

| Loại | Ai viết | Ở đâu |
|---|---|---|
| Unit (format, error mapping, scan mapping, reducer) | chủ feature | `features/<name>/__tests__/*.test.ts` |
| Component (form, table empty/error, scan result, poll form) | chủ feature | `features/<name>/__tests__/*.test.tsx` |
| Contract (MSW + type generated) | chủ feature | `features/<name>/mocks.ts` + test |
| E2E | chủ feature viết spec của mình; Tuấn giữ hạ tầng | `e2e/events.spec.ts`, `e2e/scan.spec.ts`, `e2e/orders.spec.ts`, `e2e/engagement.spec.ts`, `e2e/auth.spec.ts` (Tuấn) |
| A11y | chủ feature | axe trong spec của mình |
| Ảnh chứng cứ UI | chủ feature | `docs/evidence/ui/<feature>/…` |

E2E bắt buộc (từ `STAFF_WEB_CONSOLE_PLAN.md` §13.2): organizer tạo event; staff quét vé xanh/vàng; `/checkins` cập nhật ≤5s; Q&A realtime + ẩn câu; poll vote + đóng; quiz start→answer→reveal→next→end; RBAC staff không thấy nút sửa.

---

## 10. Review map

| Xem gì | Ở đâu | Reviewer |
|---|---|---|
| Foundation, auth, router, nav glob, UI kit | `app/**`, `lib/**`, `components/ui/**` | Thành + Vũ |
| Events | `features/events` | Tuấn |
| Orders / Tickets / Check-in / Scan | `features/{orders,tickets,checkin}` | Trọng |
| Engagement / Realtime | `features/engagement` | Vũ |
| E2E, evidence UI | `e2e/<feature>.spec.ts`, `docs/evidence/ui/<feature>` | người đối ứng |
| Contract lệch | `services/*/openapi.json` | Tuấn (không tự sửa service) |

Luân phiên Tuấn↔Thành, Vũ↔Trọng. PR chạm file nhóm 1 → Tuấn review + merge.

`CODEOWNERS` (tạo cùng PR1) phản chiếu bảng này để GitHub chặn merge sai chủ.

---

## 11. Definition of Done (mỗi feature)

- [ ] Chỉ sửa trong folder feature + `e2e/<feature>.spec.ts` + `docs/evidence/ui/<feature>`.
- [ ] Có `routes.tsx` (routes + nav), `mocks.ts`, test, evidence 3 bề rộng.
- [ ] Loading / empty / error / 401 / 403 / 404 / 409 / 422 / 503 đủ.
- [ ] RBAC: UI ẩn đúng, server vẫn enforce; ATTENDEE không vào được console.
- [ ] Không `any`, không import chéo feature, không hex, không `border`, không `blur`.
- [ ] Dùng `qk`, `routes`, `useEventContext`, `format` — không tự chế bản sao.
- [ ] `bun run lint && typecheck && test && build && lint:design && e2e` xanh.
- [ ] Keyboard + axe sạch; screenshot 390/768/1440 có trong PR.
- [ ] PR nêu rõ: màn hình nào, endpoint nào, phần nào chưa làm (nếu cắt).

---

## 12. Khi bí / khi cần vượt rào

1. Thiếu dữ liệu từ API → báo Tuấn, bổ sung **additive** vào OpenAPI/service; không tự sửa service, không tự scrape DB.
2. Cần component mới/variant mới → issue, Tuấn làm trong PR riêng.
3. Cần sửa file nhóm 1 → nhắn Tuấn kèm diff đề xuất; Tuấn merge.
4. Hai người cùng cần một thay đổi shared → gộp vào PR của Tuấn, không chia đôi file.
5. Contract đổi giữa chừng → dừng feature, chốt lại ở daily 15 phút, rồi mới code tiếp.
6. Không chắc một pattern UI đã đúng → chọn pattern quen thuộc nhất với người dùng admin; ghi lại trong PR, đừng phát minh.

---

## 13. Một dòng

Tuấn sở hữu nền tảng + 6 đường nối (event context, routes, DTO, query key, fixtures, UI kit) và đóng băng chúng ở PR1; Thành làm Event, Vũ làm Admission + Scan, Trọng làm Engagement; mỗi người chỉ commit trong folder của mình, UI theo `DESIGN.md` + mode Operate của `impeccable`, và mọi PR phải kèm screenshot 3 bề rộng + axe sạch.
