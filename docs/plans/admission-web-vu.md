# Vũ — Admission web (V1–V8)

Nguồn: `docs/STAFF_WEB_TEAM_SPLIT.md` §6.3. Chỉ sửa `web/src/features/{orders,tickets,checkin}/**`,
`web/e2e/*` và `docs/evidence/ui/{orders,tickets,checkin}/**`. Không commit.

## Phạm vi

| ID | Màn hình | Endpoint |
|---|---|---|
| V1 | `/orders` | `GET /api/orders?eventId=&status=&q=&cursor=&limit=` |
| V2 | `/orders/:orderId` | `GET /api/orders/:orderId` |
| V3 | `/tickets` | `GET /api/tickets?eventId=&status=&q=&cursor=&limit=` |
| V4 | `/tickets/:ticketId` | `GET /api/tickets/:id`, `GET /api/tickets/:id/qr-token` |
| V5 | `/checkins` | `GET /api/checkins?eventId=&gate=`, `GET /api/checkins/stats` |
| V6 | `/scan` | `POST /api/checkins` |
| V7 | `/sync` | — (online-only) |

## Quyết định

- Filter/search/cursor nằm trên URL (`?eventId=&status=&q=&cursor=&gate=`), không store riêng.
- UI ghép trực tiếp shadcn primitive; không tạo component/wrapper.
- Bảng: header 44px, row 52px, badge trạng thái, số căn phải, skeleton 8 dòng, empty dạy cách dùng,
  lỗi 1 dòng + "Thử lại".
- Scan: ZXing lazy, kết quả là khối màu toàn màn hình, beep Web Audio + `navigator.vibrate`,
  debounce cùng mã 3s, lịch sử 10.
- Kết quả scan map theo bảng §6.3, tách hàm thuần `scan-result.ts` để test.

## Cắt (ghi trong PR)

- QR token hiển thị dạng chuỗi + countdown 30s, **không** render ảnh QR: PR1 chưa cài QR encoder và
  `package.json` thuộc nhóm 1.
- `/checkins` lấy 50 mục gần nhất (feed polling), không phân trang cursor; `since` để API, UI chưa dùng
  (merge cursor + incremental không đáng đổi rủi ro với 50 dòng/3s).
- `/sync` chỉ báo trạng thái online-only; không có hàng đợi offline trên web (Phase 2).
- Header bảng chưa sticky: `components/ui/table.tsx` bọc `overflow-x-auto` nên `th` sticky không dính;
  cần sửa kit (nhóm 1).
- Banner offline toàn cục thuộc `AppShell` (nhóm 1); trong feature chỉ báo được ở `/sync` và kết quả scan.

## Kiểm chứng

`bun run typecheck && bun run lint && bun run test && bun run build`, `lint:design`, `lint:routes`,
`lint:encoding`; evidence 390/768/1440 cho 6 màn hình + 4 trạng thái scan (xanh/vàng/đỏ/xám).

E2E (gateway thật + seed): `bun run e2e` → 9/10 pass. `e2e/orders.spec.ts` (danh sách, phím `/`,
axe), `e2e/scan.spec.ts` (mã rác → đỏ; tự mua 1 vé qua API rồi quét → xanh, quét lại → vàng, axe).
Test scan tự tạo vé nên chạy lại không cần seed lại. 1 fail duy nhất: axe `color-contrast` trên
Badge trạng thái — `statusToneClass()` trong `lib/format/status-label.ts` (file nhóm 1) cho
`bg-success/10 text-success` = 2.3:1; cần Tuấn đổi sang chữ đậm hơn.

## Phân bổ thời gian

Theo 20 ngày công ở `STAFF_WEB_TEAM_SPLIT.md` §6.3 (1 ngày = 8h):

| Hạng mục | Kế hoạch | Trạng thái | Ghi chú |
|---|---|---|---|
| V1 `/orders` | 2.5 | xong | cursor + filter + search debounce 300ms |
| V2 `/orders/:orderId` | 2 | xong | timeline 2 mốc (API thiếu `updatedAt`) |
| V3 `/tickets` | 2.5 | xong | search mã/email/tên |
| V4 `/tickets/:ticketId` | 2 | xong | còn ảnh QR (chờ dep) |
| V5 `/checkins` | 3 | xong | `since` cắt có chủ đích |
| V6 `/scan` | 5 | xong | còn test camera thiết bị thật |
| V7 `/sync` | 1.5 | xong | |
| V8 test + mocks | 1.5 | xong | 27 unit/component test |
| E2E + axe + evidence | +1.5 | xong | 2 spec, 36 ảnh, 9/10 pass |

### Thời gian còn lại trước khi merge

| # | Việc | Ước lượng | Chờ ai |
|---|---|---|---|
| 1 | Contrast badge + AppShell (nested `main`, `aria-label` user menu) | 0.5 ngày | Tuấn |
| 2 | Chạy lại e2e/axe 6 màn, mở scope axe về `main` | 0.5 ngày | Vũ |
| 3 | Test camera + beep/rung trên điện thoại thật | 0.5 ngày | Vũ |
| 4 | Ảnh QR thật sau khi có dep | 0.5 ngày | Tuấn |
| 5 | Sticky header sau khi `table.tsx` cho phép | 0.25 ngày | Tuấn |
| 6 | Banner offline toàn cục | 0.25 ngày | Tuấn |
| 7 | Attendee + mốc timeline chi tiết đơn (field API) | 0.5 ngày | Tuấn |
| | **Tổng** | **~2.5 ngày sau khi gỡ blocker** | |

Ưu tiên: 1 → 2 → 3 → 4 → 5 → 6 → 7. Không mở thêm scope trước khi e2e xanh.
