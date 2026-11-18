# Staff Web — hướng dẫn prompt cho agent (đọc trước khi code)

Dành cho 3 người còn lại (Thành, Vũ, Trọng) và cho bất kỳ agent nào nhận việc trong `web/`.
Tài liệu này nói **prompt cái gì, đưa context nào, dùng skill nào, và những gì không được làm** —
kể cả cách prompt để dựng/sửa nền tảng như lần đầu (mục 5.1).

---

## 1. Đọc gì trước khi mở miệng prompt

| Thứ tự | File | Vì sao |
|---|---|---|
| 1 | `docs/STAFF_WEB_TEAM_SPLIT.md` | Nguồn sự thật: route, file ownership, 6 đường nối dùng chung, luật UI §8 |
| 2 | `docs/STAFF_WEB_CONSOLE_PLAN.md` | Kiến trúc, API, lộ trình, deployment |
| 3 | `docs/STAFF_WEB_STARTER.md` | Endpoint ↔ màn hình, auth, phân trang, RBAC |
| 4 | `web/README.md` | Script, ranh giới file, shadcn, dev mock |
| 5 | `DESIGN.md` + `PRODUCT.md` | Palette, typography, luật console compact (viền primitive, 32px, AA), mode Operate |

Không đưa cả 5 file vào prompt nếu agent tự đọc được — chỉ **đường dẫn** + mục nào liên quan.
Nếu task hẹp (1 màn hình), đưa: route, endpoint, file được sửa, ảnh/evidence mong muốn.

---

## 2. Skill phải dùng

| Skill | Khi nào | Ghi chú |
|---|---|---|
| `gitnexus-lfg` | Task có plan sẵn, cần chạy plan → gate → work → review | Orchestrator; gate là điểm bạn quyết định |
| `gitnexus-plan` | Việc > ~35 lượt, cần plan trước khi sửa | Plan ghi vào `docs/plans/` |
| `gitnexus-work` | Thực thi plan/việc nhỏ có bounded | Impact check trước mỗi symbol, `detect_changes` trước commit |
| `gitnexus-review` | Trước khi mở PR | Trả verdict, không tự sửa |
| `gitnexus-impact-analysis` | Trước khi sửa/rename/xoá symbol | Bắt buộc theo `AGENTS.md`; `risk: UNKNOWN` ≠ an toàn |
| `gitnexus-exploring` | Chưa hiểu luồng code | Dùng graph trước, grep sau |
| `gitnexus-refactoring` | Rename/extract/move | Không find-and-replace |
| `gitnexus-debugging` | Truy lỗi | Trace theo process |
| `impeccable` | **Mọi** thay đổi UI | Mode **Operate**. Cho phép `audit`, `critique`, `polish`, `harden`, `clarify`, `adapt`; **cấm** `bolder`, `colorize`, `delight`, `overdrive` |
| `ponytail` | Luôn bật | Diff nhỏ nhất giải quyết trọn vẹn; nêu rõ phần bỏ qua + rủi ro |
| `find-skills` | Khi thiếu capability (vd cần skill mới) | Tìm/đề xuất cài, đừng tự chế workflow |
| `opencode` | Câu hỏi về harness/config/agent | Không dùng cho code sản phẩm |
| `report` | Báo bug của OpenCode | Không dùng cho bug sản phẩm |

Không cần cho repo này: `hyperframes*`, `media-use`, `grilling` (trừ khi sếp yêu cầu stress-test plan).

---

## 3. Quy tắc bất di bất dịch

1. **KHÔNG commit cho đến khi được bảo "commit".** Kể cả khi bạn thấy xong, kể cả khi CI xanh.
2. **KHÔNG push.** Nếu được bảo commit: tạo nhánh trước (`feat/…`, `fix/…`, `docs/…`), commit trên nhánh đó,
   push chỉ khi được bảo. Cấm commit thẳng `main`.
3. **Không sửa `services/**`, `gateway/**`.** Backend đóng băng A1–A12. Contract lệch → báo Tuấn.
4. **Một file một chủ** (`docs/STAFF_WEB_TEAM_SPLIT.md` §3). Cần sửa file nhóm 1 → nhắn Tuấn, không "sửa tạm".
5. **Không tạo component tự viết.** UI = shadcn trong `src/components/ui/**`, thêm bằng
   `bunx shadcn@latest add <tên>`. Muốn pattern lặp → lặp JSX hoặc thêm block bằng CLI.
6. **Không hex, không `border`, không blur, không `!important`, không inline style né token.**
   Token duy nhất ở `src/styles/globals.css`. `bun run lint:design` sẽ chặn.
7. **Đủ trạng thái**: loading (skeleton) / empty (lý do + hành động) / 401 / 403 / 404 / 409 / 422 / 503.
8. **URL là state**: filter, `eventId`, tab nằm trên query string; không store riêng.

---

## 4. Quy trình chuẩn cho một màn hình

```text
1. /gitnexus-plan "<màn hình> theo docs/STAFF_WEB_TEAM_SPLIT.md §6.x"   (hoặc /gitnexus-lfg)
2. Đọc plan, chốt với lead ở gate
3. /gitnexus-work docs/plans/<plan>.md
4. /gitnexus-review (branch hoặc local)
5. Chụp evidence 390/768/1440, điền PR: màn hình nào, endpoint nào, phần cắt
```

Trước **mỗi** lần sửa symbol: `impact({ target, direction: "upstream" })`.
Trước khi commit: `detect_changes({ scope: "all" })`; `partial/truncated` không phải "sạch".

---

## 5. Prompt mẫu

### 5.1. Prompt dựng/sửa nền tảng (đã dùng để tạo `web/`)

```text
Xoá web/ và dựng lại nền tảng staff web. Yêu cầu:
- Vite + React 19 + TS strict, Tailwind 4, Biome. UI = shadcn/ui, thêm bằng CLI, KHÔNG tự viết component.
- Theo docs/STAFF_WEB_CONSOLE_PLAN.md + docs/STAFF_WEB_TEAM_SPLIT.md (Tuấn: foundation, auth, dashboard, settings).
- Token map từ DESIGN.md vào globals.css; console compact kiểu Ant Design: viền 1px chỉ trong `components/ui`/token, control 32px, radius 6/8/4, shadow hướng xuống.
- lib/**: api client + error tiếng Việt, generated từ services/*/openapi.json, query keys, format, routes,
  event-context, realtime hook.
- app/**: router glob features/*/routes.tsx, AppShell (sidebar 200/rail 64/bottom nav), RequireRole, ErrorBoundary.
- /login, /dashboard (3 service song song, degraded khi 503), /settings.
- Test: vitest + msw; e2e Playwright login/logout/403/401; chụp evidence 390/768/1440.
- Dùng skill: impeccable (Operate), gitnexus-lfg, ponytail.
- KHÔNG commit, KHÔNG push. Chỉ báo lại khi các check xanh.
```

Điều làm prompt này hiệu quả: nêu **phạm vi file**, **ràng buộc design**, **skill**, **điều cấm**, **định nghĩa xong**.

### 5.2. Prompt cho một feature (Thành / Vũ / Trọng)

```text
Làm /orders (Vũ) theo docs/STAFF_WEB_TEAM_SPLIT.md §6.3.
- Chỉ sửa trong src/features/orders/**, e2e/orders.spec.ts, docs/evidence/ui/orders/**.
- Dùng: shadcn Table/Pagination/Select/Field, qk.orders, routes.orders, useEventContext, lib/format.
- Endpoint: GET /api/orders?eventId=&status=&q=&cursor=&limit= (A2).
- Đủ trạng thái: loading skeleton 8 dòng, empty dạy cách dùng, error + "Thử lại", 403 không logout.
- Test: MSW handlers trong features/orders/mocks.ts, component test table empty/error.
- Không commit. Không sửa lib/**, app/**, components/ui/**.
- Dùng /gitnexus-lfg với plan ngắn; impeccable mode Operate; ponytail.
```

### 5.3. Prompt migrate kit UI (đã dùng)

```text
Migrate toàn bộ UI sang shadcn: xoá component tự viết, `bunx shadcn@latest add …` từng component,
map token DESIGN.md vào globals.css, patch source shadcn cho console compact (viền 1px + control 32px + radius 6/8/4), viết lại docs là dùng shadcn.
Không commit. Kiểm tra: typecheck, biome, test, build, lint:design/routes/encoding, e2e, evidence 3 bề rộng.
```

### 5.4. Prompt kiểm tra chất lượng (không sửa code)

```text
/impeccable audit /dashboard và /login ở 390/768/1440.
Chỉ báo finding theo mức serious/critical, kèm ảnh và vị trí; không sửa file.
```

---

## 6. Checklist trước khi báo "xong"

- [ ] `bun run typecheck && bun run lint && bun run test && bun run build`
- [ ] `bun run lint:design && bun run lint:routes && bun run lint:encoding`
- [ ] `bun run e2e` (cần `docker compose up -d` + `bun run seed` ở root)
- [ ] `bun run evidence` → mở **từng** ảnh ở 390/768/1440, không chỉ nhìn thumbnail
- [ ] Không hex/border tự thêm/blur; control 32px (scan/check-in ≥44px); bàn phím đi hết luồng; axe 0 serious/critical
- [ ] PR ghi: màn hình nào, endpoint nào, phần nào cắt
- [ ] **Chưa commit** (trừ khi được bảo), chưa push

---

## 7. Git

| Việc | Quy ước |
|---|---|
| Nhánh | `feat/<scope>-<việc>`, `fix/<scope>-<lỗi>`, `docs/<việc>`, `chore/<việc>` |
| Commit | Conventional Commits: `type(scope): subject` — type: `feat|fix|refactor|test|docs|build|ci|chore`; scope: `web|events|orders|tickets|checkin|engagement|foundation` |
| Chia nhỏ | Một commit = một ý (scaffold, tokens, api client, một màn hình…), không gộp 20 file không liên quan |
| Push | Chỉ khi được bảo, và **sau khi** đã tạo nhánh |
| PR | ≤ 400 dòng diff, 1 reviewer luân phiên (Tuấn↔Thành, Vũ↔Trọng) |

Ví dụ: `feat(orders): add cursor list with status filter`, `fix(checkin): keep feed polling after reconnect`.

---

## 8. Anti-pattern (đã gặp, đừng lặp)

- Tự viết `PageHeader`/`StatCard`/`Badge` wrapper → phải inline bằng shadcn.
- Dùng PowerShell `Set-Content` mặc định để sửa file tiếng Việt → **mất dấu**; dùng editor/UTF-8, và chạy
  `bun run lint:encoding` trước khi báo xong.
- Copy screenshot chụp lúc animation đang chạy → chart trống, kết luận sai.
- Bỏ qua `--frozen-lockfile` khi build Docker với Bun khác phiên bản → build fail; Dockerfile pin `oven/bun:1.4`.
- Sửa `components/ui/**` mà không giữ luật console compact (viền 1px, control 32px, radius 6/8/4, AA) → `lint:design` không bắt được, nhưng review sẽ bắt.
