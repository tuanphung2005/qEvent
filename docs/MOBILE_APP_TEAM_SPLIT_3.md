# qEvent Mobile — Bàn giao 3 người (Tuấn, Thành, Vũ)

- Chốt ngày: **2026-11-26**
- Trạng thái: **nguồn sự thật** cho việc xây app mobile Expo. Thay phần mobile trong
  `MVP.md` (đặc tả monolith cũ).
- Nền tảng backend đang dùng: `gateway/` + `event-service` + `admission-service` +
  `engagement-service` (không dùng `backend/` monolith trong `MVP.md`).
- Mốc code đã đối chiếu: `e1322f4` (`main`), web console và 3 service đã chạy.
- Phạm vi app: **ATTENDEE + STAFF/ORGANIZER** trên điện thoại.
  Không làm lại organizer console, host presenter, event CRUD trên mobile — web đã có.
- UI: `DESIGN.md` mục **Mobile (planned)** + mode **Operate** của `impeccable`.

> **Trạng thái 2026-11-27:** Tuấn đã dựng xong foundation trong `mobile/` (Expo 56 + Router +
> TypeScript strict + NativeWind/Reusables + auth/role gate + API client + realtime + SQLite
> cache/queue/verify/sync + CI) và backend P0 B1/B2/B3/B7. `app/(attendee)/**` và
> `app/(staff)/**` hiện chỉ là placeholder để Thành/Vũ thay bằng màn hình thật.

> **Kết luận ngắn:** `MVP.md` là đặc tả lịch sử, **không dùng trực tiếp để code mobile**:
> sai kiến trúc backend, sai endpoint, sai cách tạo QR, thiếu poll/quiz và thiếu hợp đồng
> cho offline. Bản này chốt lại scope, API, chia việc và các gap phải xử lý trước khi code.

---

## 0. Kiểm tra tài liệu mobile hiện có

| # | `MVP.md` / tài liệu cũ | Thực tế trong repo | Xử lý |
|---|---|---|---|
| 1 | Backend monolith `backend/` | 3 microservice + gateway | Bỏ `backend/`; gọi gateway `:8000` |
| 2 | Role `SPEAKER` | Role hiện tại: `ORGANIZER`, `HOST`, `STAFF`, `ATTENDEE` | Mobile chỉ dùng `ATTENDEE`, `STAFF`, `ORGANIZER` |
| 3 | Mua vé `POST /api/tickets/purchase-sandbox` | `POST /api/orders` (idempotency, saga) | Mobile MVP **không mua vé**; vé có sẵn |
| 4 | Vé của tôi `GET /api/tickets/my-tickets` | `GET /api/tickets/my` | Dùng endpoint hiện tại |
| 5 | Check-in `POST /api/checkin/verify` | `POST /api/checkins` | Dùng endpoint hiện tại |
| 6 | Cache vé `GET /api/checkin/cache/:eventId` | **Chưa có**; có `GET /api/tickets?eventId=&since=` cho staff | Dùng `/api/tickets` có phân trang, hoặc bổ sung cache endpoint (§4) |
| 7 | QR sinh client bằng `totpSecret` | Server ký RSA, trả `GET /api/tickets/:id/qr-token`; **không trả secret** | App gọi endpoint mỗi 30s; không giữ secret trên máy |
| 8 | Offline sync chỉ gửi `ticketId` | `POST /api/checkins/sync-offline` hiện chỉ nhận `ticketId` | Thêm `qrToken?` để server xác thực lại (§4) |
| 9 | Q&A chỉ có `QUESTION_ADDED`, `VOTE_UPDATED` | Message thật: `NEW_QUESTION`, `QUESTION_VOTED`, `POLL_CREATED`, `POLL_VOTED`, `QUESTION_ACTIVE`, `ROUND_REVEALED`, `GAME_FINISHED`… | App bỏ qua message lạ; dùng đúng hợp đồng §5 |
| 10 | Không có poll/quiz trên mobile | Backend đã có poll/quiz cho attendee | Đưa vào scope attendee |
| 11 | Chữ phụ mobile `#94A3B8` | `DESIGN.md` yêu cầu AA; `#94A3B8` trên trắng chỉ ~2.5:1 | Dùng `#475569` cho text phụ; `#94A3B8` chỉ cho icon trang trí |
| 12 | `expo-av` | Expo khuyến nghị `expo-audio` cho SDK mới | Dùng `expo-audio`; `expo-av` chỉ khi SDK pin cũ |
| 13 | “Offline QR vẫn chạy” | Token do server ký; app không có private key | Chốt: QR cần mạng để lấy token mới; offline chỉ giữ token đến hết hạn (§6) |
| 14 | Không có test/CI/EAS | Chưa có `mobile/` | Bổ sung §8 |

---

## 1. Phân công 3 người

| Người | Vai trò | Vùng sở hữu | Ước lượng |
|---|---|---|---|
| **Tuấn** (lead) | Foundation + Offline core | `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/**`, `src/api/**`, `src/auth/**`, `src/theme/**`, `src/components/**`, `src/lib/**` (gồm `offline/**`, `realtime/**`), `src/test/**`, E2E harness, CI/EAS, `app.config.ts` | **28** |
| **Thành** | Attendee experience | `app/(attendee)/**`, `src/features/tickets/**`, `src/features/engagement/**` | **28** |
| **Vũ** | Staff gate | `app/(staff)/**`, `src/features/scanner/**`, `src/features/sync/**` | **28** |

Tổng ≈ **84 ngày công**; 3 người × 5 ngày/tuần ≈ **5.6 tuần**, cộng buffer thành **6 tuần**.
Không tính công backend P0 (ước lượng +2–4 ngày, Tuấn điều phối).

**Vì sao chia như vậy**

- Tuấn giữ phần khó nhất về kiến trúc: auth, API, theme, SQLite/queue, xác thực offline,
  realtime hook. Đây là các đường nối mà Thành/Vũ chỉ được dùng, không sửa.
- Thành giữ toàn bộ trải nghiệm khán giả: vé, QR, live Q&A/poll/quiz. Một người sở hữu
  toàn bộ luồng attendee để không lệch trạng thái giữa các tab.
- Vũ giữ toàn bộ cổng soát vé: camera, phản hồi đa giác quan, cache, queue, sync, conflict.
  Đây là màn hình chịu áp lực cao nhất và cần test thiết bị thật.
- Không ai phải sửa file của người khác; `src/lib/offline/**` là hợp đồng giữa Tuấn và Vũ.

### 1.1. Đối chiếu năng lực sản phẩm → màn hình mobile

| Năng lực (`PRODUCT.md` / `MVP.md`) | Màn hình mobile | Owner |
|---|---|---|
| Đăng nhập, phiên, phân quyền | `(auth)/login`, role gate | Tuấn |
| Danh sách vé của tôi | `(attendee)/tickets` | Thành |
| Dynamic QR 30s + chống chụp màn hình | `(attendee)/tickets/[ticketId]` | Thành |
| Live Q&A + upvote realtime | `(attendee)/live/[sessionId]/qa` | Thành |
| Poll + kết quả | `(attendee)/live/[sessionId]/polls` | Thành |
| Quiz + leaderboard | `(attendee)/live/[sessionId]/quiz` | Thành |
| Quét QR + phản hồi đa giác quan | `(staff)/scanner` | Vũ |
| Cache SQLite + offline queue | `src/lib/offline` | Tuấn |
| Đồng bộ offline + conflict | `(staff)/sync` | Vũ |
| Chọn event/cổng/device | `(staff)/events` | Vũ |
| Mạng yếu/mất mạng, fallback polling | banner + hooks dùng chung | Tuấn |
| Tài khoản/đăng xuất | `(attendee)/profile`, `(staff)/profile` | Thành / Vũ |


---

## 2. Cây màn hình mobile (canonical)

```text
app/
├── _layout.tsx                 # provider, font, auth gate
├── index.tsx                   # redirect theo role
├── (auth)/
│   └── login.tsx
├── (attendee)/
│   ├── _layout.tsx             # bottom tabs: Vé · Live · Tài khoản
│   ├── tickets/
│   │   ├── index.tsx           # danh sách vé của tôi
│   │   └── [ticketId].tsx      # Dynamic QR + countdown + chống chụp
│   ├── live/
│   │   ├── index.tsx           # phiên đang live của event đã check-in
│   │   └── [sessionId]/
│   │       ├── qa.tsx
│   │       ├── polls.tsx
│   │       └── quiz.tsx
│   └── profile.tsx
└── (staff)/
    ├── _layout.tsx             # bottom tabs: Quét · Đồng bộ · Tài khoản
    ├── events.tsx              # chọn event, cổng, tải cache
    ├── scanner.tsx             # camera + nhập tay + kết quả
    ├── sync.tsx                # queue, trạng thái, conflict
    └── profile.tsx
```

**Quy tắc:** route param `[ticketId]`, `[sessionId]`; filter/`eventId`/`gate` nằm trên
route params hoặc query, không lưu trong store toàn cục. Deep link mở thẳng vé/phiên.

**Ngoài scope mobile (ghi rõ trong PR):** mua vé/thanh toán, đăng ký tài khoản, organizer
event CRUD, host presenter, check-in feed nhiều cột, export, push notification.

### 2.1. Môi trường chạy

```bash
# backend + seed (từ root)
docker compose up -d --build
bun run seed && bun run demo:seed

# mobile
cd mobile
bun install
bunx expo start
```

| Biến | Ví dụ | Ghi chú |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://192.168.1.20:8000` | iOS simulator dùng `localhost`; Android emulator dùng `10.0.2.2`; máy thật dùng LAN IP |
| `EXPO_PUBLIC_WS_BASE_URL` | `ws://192.168.1.20:8000` | Cùng host với API |
| `EXPO_PUBLIC_E2E` | `1` | Bật fixture/manual token cho Maestro |

Không đặt secret/JWT trong `EXPO_PUBLIC_*`. EAS profile: `development`, `preview`, `production`.

### 2.2. Thư viện chuẩn

| Nhu cầu | Chọn | Ghi chú |
|---|---|---|
| Routing | `expo-router` | file-based, route group `(auth)/(attendee)/(staff)` |
| Styling | `nativewind` v5 / Tailwind 4 | token qEvent trong `tailwind.config.js` + `global.css` |
| UI base | **React Native Reusables** (shadcn-style, copy-in) + `@rn-primitives` | component nằm trong `src/components/ui/**`, không import nguyên bộ |
| Icons | `lucide-react-native` | cùng bộ icon với web |
| Motion | `react-native-reanimated` + `react-native-gesture-handler` | chỉ cho kết quả scan/countdown/chuyển tab |
| Giữ màn hình | `expo-keep-awake` | QR/scanner không tắt màn |
| Camera/QR | `expo-camera` (`CameraView`) | barcode `qr` |
| SQLite cache/queue | `expo-sqlite` | chỉ trong `src/lib/offline` |
| Token | `expo-secure-store` | JWT, `deviceId`; không AsyncStorage |
| Mạng | `expo-network` | online/offline + banner |
| Haptics | `expo-haptics` | 1 nhịp xanh, 2 nhịp vàng, dài đỏ |
| Âm thanh | `expo-audio` | beep ≤120ms; `expo-av` chỉ khi SDK cũ |
| Chống chụp | `expo-screen-capture` | bật khi màn QR active |
| QR render | `react-native-qrcode-svg` | không tự vẽ QR |
| Server state | `@tanstack/react-query` | cache/refetch/fallback polling |
| API types | `openapi-typescript` + `openapi-fetch` | generated từ `services/*/openapi.json` |
| Unit/component | `jest-expo` + React Native Testing Library | mock API bằng MSW native |
| E2E | Maestro | flow YAML, chạy simulator + máy thật |

> **UI base đã chốt:** NativeWind + React Native Reusables. Không cài gluestack/RN Paper/Tamagui
> trong cùng app. Nếu đổi UI base, sửa mục này + prompt trước khi code; không mix hai hệ.




---

## 3. Ranh giới file

### 3.1. Tuấn — foundation + offline core

```text
mobile/package.json  bun.lock  app.config.ts  eas.json  tsconfig.json  babel.config.js  metro.config.js
mobile/tailwind.config.js  mobile/global.css  mobile/components.json  mobile/.env.example
mobile/app/_layout.tsx  mobile/app/index.tsx
mobile/app/(auth)/**
mobile/src/api/**              client, generated từ OpenAPI, errors, token
mobile/src/auth/**             AuthProvider, SecureStore, role gate
mobile/src/theme/**            colors, spacing, typography, shadows (mobile tokens)
mobile/src/components/ui/**    React Native Reusables primitives (copy-in, patch token)
mobile/src/components/**       Screen, OfflineBanner, ErrorState (composition tối thiểu)
mobile/src/lib/offline/**      SQLite schema, cache, queue, verify, sync engine
mobile/src/lib/realtime/**     useRealtime (WS + fallback polling)
mobile/src/lib/format/**       ngày, giờ, mã vé, trạng thái
mobile/src/test/**             setup, fixtures, MSW native handlers
mobile/e2e/**                  Maestro flows + fixtures
mobile/.github/workflows/mobile.yml (hoặc workflow chung)
```

### 3.2. Thành — attendee experience

```text
mobile/app/(attendee)/**
mobile/src/features/tickets/**
mobile/src/features/engagement/**
mobile/e2e/attendee-*.yaml
docs/evidence/mobile/attendee/**
```

### 3.3. Vũ — staff gate

```text
mobile/app/(staff)/**
mobile/src/features/scanner/**
mobile/src/features/sync/**
mobile/e2e/staff-*.yaml
docs/evidence/mobile/staff/**
```

### 3.4. Cấm sửa tay

```text
mobile/src/api/generated.ts    # openapi-typescript từ services/*/openapi.json
services/**  gateway/**        # backend đóng băng; cần đổi → §4
```

### 3.5. Luật dùng UI kit

- UI base là **React Native Reusables** (copy-in, NativeWind + `@rn-primitives`).
- Primitive nằm trong `src/components/ui/**`; thêm bằng CLI của Reusables, không tự viết lại
  Button/Input/Dialog.
- Feature chỉ import primitive từ `src/components/ui/**`; không import trực tiếp gluestack,
  RN Paper, Tamagui hay một UI kit thứ hai.
- Không có tầng composition chung: header màn hình, stat, banner là JSX ghép từ primitive ngay
  trong page. Pattern lặp 3–5 dòng thì lặp; không tạo wrapper mới.
- Muốn thêm primitive/variant → báo Tuấn; Tuấn thêm trong PR riêng và giữ token qEvent.
- Không `className` để đổi màu/bo góc/shadow ngoài token; không hex trong feature.
- Không dùng component `liquid-glass`, blur, gradient, dark mode của bất kỳ kit nào.


---

## 4. Backend gap phải chốt trước khi làm offline (P0)

Mobile **không thể** làm offline đúng nghĩa chỉ với API hiện tại. Các việc sau là additive,
không phá web:

| # | Gap | Trạng thái |
|---|---|---|
| B1 | Không có public key | ✅ `GET /api/qr/public-key` → `{ publicKey, kid }`, cache 1h; gateway route `/api/qr/*`. |
| B2 | Sync chỉ nhận `ticketId` | ✅ `qrToken?` trong log; server verify chữ ký + TOTP theo `scannedAt`; log cũ không có token vẫn chạy; lỗi → `INVALID_QR_TOKEN` / `QR_TICKET_MISMATCH`. |
| B3 | Cache vé phải phân trang | ✅ Mobile lặp `nextCursor` với `GET /api/tickets?eventId=&limit=100`. |
| B4 | QR attendee không thể offline | ✅ Chốt: QR cần mạng để refresh; offline giữ token hiện tại đến hết hạn và hiện “Cần mạng để lấy mã mới”. |
| B5 | `/tickets/my` không có tên event | Thành: gọi `GET /api/events/:id` khi mở vé và cache event info. |
| B6 | Leaderboard chỉ có `userId` | Thành: MVP hiển thị “Bạn”/thứ hạng; Phase 2 thêm `fullName` nếu backend đồng ý. |
| B7 | Không có `serverTime` trong body | ✅ Mobile đọc header `Date` của mọi response và bù offset. |

**Acceptance P0:** public key trả đúng PEM + `kid`, không lộ private key; sync với token bị sửa
→ `INVALID_QR_TOKEN`; token hết hạn theo `scannedAt` → lỗi; token hợp lệ → `SYNCED`; log cũ
không có `qrToken` vẫn chạy (backward compatible).

---

## 5. Hợp đồng API mobile (đã đối chiếu code)

| Màn hình | Endpoint | Role |
|---|---|---|
| Login | `POST /api/auth/login`, `GET /api/auth/me` | public / mọi role |
| Vé của tôi | `GET /api/tickets/my` | ATTENDEE |
| Chi tiết vé + QR | `GET /api/tickets/:id/qr-token` | ATTENDEE (vé của mình) |
| Event/session live | `GET /api/events`, `GET /api/events/:id` | mọi role đã đăng nhập |
| Q&A đọc | `GET /api/sessions/:sessionId/questions` | attendee đã đăng nhập (write mới cần check-in + live) |
| Q&A tạo | `POST /api/sessions/:sessionId/questions` | attendee đã check-in + live |
| Q&A vote | `PUT /api/questions/:questionId/votes` | attendee đã check-in + live |
| Poll đọc | `GET /api/sessions/:sessionId/polls` | attendee đã đăng nhập |
| Poll vote | `POST /api/polls/:pollId/vote` | attendee đã check-in + live |
| Quiz đọc | `GET /api/sessions/:sessionId/game` | attendee đã đăng nhập |
| Quiz answer | `POST /api/game/:gameId/answer` | attendee đã check-in + live |
| Quiz leaderboard | `GET /api/game/:gameId/leaderboard` | attendee đã đăng nhập |
| Realtime | `ws://…/ws/qa?token=`, `/ws/game?token=` | JWT bắt buộc |
| Staff cache | `GET /api/tickets?eventId=&since=&limit=100` | STAFF/ORGANIZER |
| Staff online scan | `POST /api/checkins` | STAFF/ORGANIZER |
| Staff sync | `POST /api/checkins/sync-offline` (`logs[].qrToken?`) | STAFF/ORGANIZER |
| Staff stats/gate | `GET /api/checkins/stats?eventId=` | STAFF/ORGANIZER |
| Public key (đã có) | `GET /api/qr/public-key` | public/cache |

**Không dùng:** `POST /api/tickets/purchase-sandbox`, `GET /api/tickets/my-tickets`,
`POST /api/checkin/verify`, `GET /api/checkin/cache/:eventId` — các endpoint này không tồn tại.

**Body quan trọng:** poll vote `{ optionId }` (vote lại cùng option = bỏ vote, option khác = đổi
vote); quiz answer `{ questionId, selectedOption }`; Q&A tạo `{ content }`.

---

## 6. Quy tắc offline & bảo mật (bắt buộc)

1. **JWT** chỉ trong `expo-secure-store`; không `AsyncStorage`, không log.
2. **QR attendee**: gọi `/qr-token`; đếm ngược `expiresIn`; hết hạn tự gọi lại. Không lưu
   token vào SQLite/AsyncStorage. Bật `expo-screen-capture` khi màn hình vé active. Lưu ý:
   iOS chỉ báo/che một phần, không chặn cứng như Android — demo phải nói rõ.
3. **QR không log** ở console, crash report, analytics, hay `alt`/accessibility label.
4. **Staff cache**: chỉ lưu field cần cho soát vé (`ticketId`, `eventId`, `status`,
   `orderStatus`, `attendeeName`, `updatedAt`). Không lưu `qrSecret` (server không trả).
5. **Offline verify** (B1/B2 đã có):
   - Parse token, verify RSA bằng public key đã cache.
   - Kiểm tra `iat` không cũ hơn 30s và không ở tương lai quá 5s.
   - Không cần verify TOTP trên máy: `code` nằm trong payload đã được server ký, nên chữ ký
     hợp lệ + `iat` còn hạn là đủ; TOTP chỉ được server kiểm khi sync.
   - Tra `ticketId` trong cache; chỉ xanh nếu event khớp, order `CONFIRMED`, vé chưa
     `CHECKED_IN` trong cache và chưa có trong queue.
   - Token hợp lệ bị chụp lại trong 30s vẫn có thể tái sử dụng; queue local chặn cùng thiết bị,
     sync server xử lý conflict giữa nhiều thiết bị.
   - Không verify được chữ ký → **vàng “Đã xếp hàng”**, không xanh.
6. **Queue**: mỗi scan gồm `ticketId`, `eventId`, `scannedAt` (ISO), `deviceId`, `gate`,
   `qrToken?`. Unique theo `ticketId`; lưu SQLite; xoá sau khi sync thành công. Queue được
   lọc theo `eventId` khi sync — không trộn vé của sự kiện khác.
7. **Sync**: tự động sync khi mạng trở lại (`expo-network`) + nút thủ công; gọi
   `POST /api/checkins/sync-offline` theo batch ≤500 của **đúng event đang chọn**; map
   `SYNCED / CONFLICT / DUPLICATE / ERROR`. Lỗi mạng/5xx **không** tiêu hao lượt retry;
   chỉ `ERROR` xác định (vé không tồn tại, sai event, token sai) mới đếm, tối đa 3 lần.
8. **Đồng hồ**: lấy header `Date` từ response (hoặc `serverTime` nếu có B7); lưu offset.
   `evaluateOfflineScan` mặc định dùng `serverNow()` để máy lệch giờ vẫn quét xanh đúng;
   hiển thị cảnh báo nếu lệch >2 phút.
9. **Mạng**: banner offline toàn app; scanner chuyển chế độ offline; attendee QR báo cần mạng.
10. **Thiết bị**: `deviceId` ổn định (SecureStore), `gate` do staff chọn (`gate-1`…).
11. **Quiz**: `POST /answer` trả `isCorrect` ngay, nhưng UI không được hiện đúng/sai trước
    `ROUND_REVEALED`; chỉ hiện “Đã gửi” để không lộ kết quả cho người bên cạnh.

---

## 7. Việc từng người

### 7.1. Tuấn — Foundation + Offline core (28 ngày)

| ID | Việc | Ngày |
|---|---|---|
| M1 | Scaffold Expo + Expo Router + TS strict + NativeWind/Reusables init + Biome/ESLint + CI + EAS + icon/splash + quyền camera/network | 3 |
| M2 | Theme mobile: màu, spacing, typography, shadow đổ đáy; import primitive Reusables vào `src/components/ui`; component nền (`Screen`, `OfflineBanner`, `ErrorState`) | 4 |
| M3 | API client + generated types + error tiếng Việt + auth/SecureStore + role gate | 4 |
| M4 | Root layout, redirect theo role, deep link, network banner | 3 |
| M5 | TanStack Query + `useRealtime` (WS, reconnect, fallback polling) dùng chung | 3 |
| M6 | SQLite schema + cache vé + queue + `verifyOfflineToken` + `syncQueue` | 7 |
| M7 | Backend P0: public key, `qrToken?` sync, cache contract; cập nhật OpenAPI/generated | 2 |
| M8 | Lead: review, merge, integration, demo, docs | 2 |

**Acceptance:** login attendee/staff; token trong SecureStore; reload giữ phiên; sai role bị
chặn; API lỗi có thông điệp tiếng Việt; SQLite cache/queue có test; public key cache được;
sync engine map đủ 4 trạng thái.

### 7.2. Thành — Attendee experience (28 ngày)

| ID | Việc | Ngày |
|---|---|---|
| A1 | Attendee tab shell + profile/logout | 2 |
| A2 | `/tickets`: danh sách vé, empty/error/loading, event info | 3 |
| A3 | `/tickets/[ticketId]`: QR, vòng đếm ngược 30s, refresh, chống chụp, trạng thái vé | 4 |
| A4 | `/live`: phiên live của event đã check-in; empty state | 3 |
| A5 | Q&A: list, tạo câu hỏi, upvote, realtime + fallback, 403 khi chưa check-in/chưa live | 5 |
| A6 | Polls: list, vote (toggle cùng option = bỏ vote), kết quả, poll đóng, 400/403 | 4 |
| A7 | Quiz: trạng thái game, câu hiện tại, answer `{questionId, selectedOption}`, reveal, leaderboard, displayMode FULL/LETTERS; **không hiện `isCorrect`/đáp án trước ROUND_REVEALED** | 5 |
| A8 | Test component + E2E Maestro + evidence iOS/Android | 2 |

**Acceptance:** vé hợp lệ hiện QR + đếm ngược; hết 30s tự đổi; chụp màn hình bị chặn;
vé cancelled/order chưa xác nhận có thông báo đúng; Q&A mới <1s; vote <1s; poll đóng không
vote được; quiz không lộ đáp án trước reveal; mất WS chuyển polling + banner.

### 7.3. Vũ — Staff gate (28 ngày)

| ID | Việc | Ngày |
|---|---|---|
| S1 | Staff tab shell + profile/logout + chọn event + chọn cổng (`gate-1..4` fallback) + `deviceId` + tải cache (lặp cursor đến hết, cảnh báo nếu 0 vé) | 4 |
| S2 | Scanner: `expo-camera`, quyền camera, nhập tay, debounce 3s, lịch sử 10 | 4 |
| S3 | Phản hồi: xanh/vàng/đỏ/xám, beep `expo-audio`, haptic `expo-haptics`, flash | 3 |
| S4 | Online check-in: `POST /api/checkins`, map 7 kết quả | 3 |
| S5 | Offline: verify public key, cache lookup, local duplicate, queue | 4 |
| S6 | Sync screen: queue count, auto-sync khi có mạng + nút thủ công, conflict/duplicate/error, retry, xoá item lỗi | 5 |
| S7 | Test thiết bị thật (camera, beep, rung, airplane mode), performance + E2E Maestro + evidence | 5 |

**Acceptance:** quét vé hợp lệ xanh <1s; quét lại vàng; mã rác đỏ; mất mạng vẫn quét được
theo cache; sync khi có mạng trả đúng conflict; không crash khi camera bị từ chối quyền;
beep/rung đúng; UI một tay, nút chính ≥48dp ở 1/3 dưới màn hình.

---

## 8. Lịch 6 tuần + cổng gác

| Tuần | Cổng gác | Tuấn | Thành | Vũ |
|---|---|---|---|---|
| 1 | Scaffold chạy; contract API + B1/B2 chốt | M1 + bắt đầu M2 | A1 + A2 skeleton | S1 skeleton |
| 2 | **Foundation merge**; auth/API/theme; vé đọc thật | M2–M3 | A2–A3 | S1–S2 |
| 3 | QR + scanner online chạy | M4–M5 | A3–A5 | S2–S4 |
| 4 | Offline verify + queue + poll/quiz | M6–M7 | A6–A7 | S5–S6 |
| 5 | E2E + device test + evidence | M6 hoàn tất + integration | A8 + fixes | S7 + fixes |
| 6 | Hardening + demo khô | M8 + docs/demo | bug | bug |

**Nhịp merge:** rebase `main` mỗi sáng; PR ≤ 400 dòng; 1 reviewer luân phiên
Tuấn↔Thành, Thành↔Vũ, Vũ↔Tuấn; PR chạm `src/lib/**`/`app/_layout` chỉ Tuấn merge.

**Thứ tự cắt nếu trễ:**
1. Không cắt: auth/role gate, vé + QR + chống chụp, scanner online, offline cache/queue,
   Q&A/poll/quiz cơ bản, 5 luồng E2E.
2. Cắt được: leaderboard tên, hiệu ứng nâng cao, lịch sử scan >10, cache tự động.
3. Hoãn: mua vé, push notification, offline QR, đa ngôn ngữ, analytics.

---

## 9. Test & bằng chứng

| Loại | Ai viết | Ở đâu |
|---|---|---|
| Unit (token/verify, cache, queue, format, error mapping) | Tuấn / chủ feature | `src/**/__tests__/*.test.ts` |
| Component (QR countdown, scan result, poll, Q&A) | chủ feature | `src/features/**/__tests__/*.test.tsx` |
| Integration API (MSW native) | chủ feature | `src/test/msw/**` + test |
| E2E (Maestro) | chủ feature; Tuấn giữ harness | `mobile/e2e/*.yaml` |
| Thiết bị thật | Vũ (staff), Thành (attendee) | checklist §10 |
| Ảnh chứng cứ | chủ feature | `docs/evidence/mobile/<feature>/<screen>-ios.png`, `-android.png` |

**Bắt buộc:** ảnh iOS + Android cho login, tickets, QR, live Q&A, poll, quiz, scanner,
sync; ảnh trạng thái scan xanh/vàng/đỏ/xám; quay màn hình 10s demo offline→sync.
**A11y:** label cho mọi nút icon, `accessibilityRole`, font scale 200%, target ≥48dp,
contrast AA; kiểm bằng mắt + lint a11y + VoiceOver/TalkBack trên 3 màn chính.

---

## 10. Checklist thiết bị thật (không thay thế bằng simulator)

- [ ] Camera sau, quyền bị từ chối → hướng dẫn mở Settings.
- [ ] Ánh sáng mạnh/tối; QR trên màn hình cong/kính.
- [ ] Beep + rung: iOS silent mode, Android DND.
- [ ] Airplane mode: quét 20 vé, tắt app, mở lại, queue còn; bật mạng → sync.
- [ ] 2 thiết bị quét cùng vé offline → 1 sync, 1 conflict.
- [ ] Đồng hồ thiết bị lệch 3 phút → cảnh báo.
- [ ] Screen capture/record trên màn hình QR → bị chặn hoặc che.
- [ ] Font scale 200%, dark mode hệ thống không làm app đổi theme.
- [ ] App kill/restart giữa queue → không mất scan.

---

## 10.1. Demo script (dùng cho handoff)

1. Attendee login → mở vé → QR + vòng đếm ngược; thử chụp màn hình (Android bị chặn).
2. Staff login → chọn event/cổng → tải cache → quét vé attendee → xanh <1s.
3. Quét lại cùng vé → vàng; quét mã rác → đỏ; tắt gateway → xám “cần mạng”.
4. Airplane mode → quét 3 vé → vàng “đã xếp hàng”; bật mạng → auto-sync → 3 `SYNCED`.
5. Hai staff cùng quét một vé offline → sync → 1 `SYNCED`, 1 `CONFLICT`.
6. Attendee vào live session (đã check-in) → Q&A mới hiện <1s; vote; poll vote/đổi vote;
   quiz answer → chỉ “Đã gửi”, host reveal mới thấy đúng/sai; leaderboard.
7. Organizer tắt session live trên web → attendee thấy 403 “phiên chưa live”; chưa check-in → 403 copy đúng.
8. Kill app giữa queue → mở lại → queue còn; sync tiếp.
9. Chạy lại toàn bộ E2E Maestro + checklist thiết bị; chụp evidence iOS/Android.

---

## 11. Definition of Done (mỗi feature)

- [ ] Chỉ sửa trong folder feature + `e2e/<feature>.yaml` + `docs/evidence/mobile/<feature>`.
- [ ] Có test unit/component; E2E nếu là luồng chính.
- [ ] Loading / empty / error / 401 / 403 / 404 / 409 / 422 / 503 / offline đủ.
- [ ] Role gate đúng: ATTENDEE không vào staff; STAFF/ORGANIZER không vào attendee nếu
      không có vé; HOST không dùng app mobile.
- [ ] Không log token/QR; không lưu secret; SecureStore cho JWT.
- [ ] UI theo `DESIGN.md` Mobile: light, `borderWidth: 0`, bottom shadow, no blur, AA, ≥48dp.
- [ ] `bun run typecheck && bun run lint && bun run test` xanh; E2E flow chính xanh.
- [ ] Ảnh iOS + Android + checklist thiết bị (nếu chạm camera/offline).
- [ ] PR ghi: màn hình nào, endpoint nào, phần cắt, gap B1/B2 đã xử lý chưa.

---

## 12. Rủi ro & quyết định cần chốt

1. **Offline QR của attendee** không khả thi với QR server-sign. Nếu bắt buộc, phải đổi kiến
   trúc (pre-signed token bundle hoặc HMAC), không nên làm trong MVP.
2. **B1/B2** đã xong (public key + `qrToken?` verify); offline scanner được phép hiện xanh khi
   verify chữ ký + cache khớp. Log cũ không có `qrToken` vẫn chạy để tương thích.
3. **Backend đóng băng**: thay đổi B1/B2/B3/B7 đã làm additive trong admission + gateway; không
   phá web. Mọi thay đổi backend sau này vẫn cần PR riêng, không để mobile tự sửa `services/**`.
4. **Camera trên simulator** không đại diện; phải test máy thật trước demo.
5. **EAS build**: cần tài khoản/credential; chốt trước tuần 1 để không chặn demo.
6. **Đăng ký tài khoản**: backend có `POST /api/auth/register` nhưng mobile MVP chỉ login;
   nếu demo cần tài khoản mới, thêm ~0.5 ngày (Thành) và phải chốt trước tuần 2.
7. **Reusables là copy-in**: nâng cấp thủ công; chốt version CLI trong PR đầu và ghi vào
   `components.json`. Không chạy CLI lung tung làm lệch style.
8. **Thiếu bottomsheet phức tạp**: Reusables có Dialog cơ bản; nếu cần sheet kéo-thả, thêm
   `@gorhom/bottom-sheet` (một dependency riêng), không đổi sang UI kit khác.
9. **SDK 57 (Hermes fix) chưa áp dụng**: SDK 56 đang chạy ổn định và bundle/test xanh, nhưng
   Hermes V1 có memory regression. Lần nâng SDK 57 đầu tiên treo ở `bun` resolve (registry
   stall) nên đã rollback. Làm PR riêng: `bunx expo install expo@^57.0.9 --fix`, chạy lại
   typecheck/lint/test + export iOS/Android trước khi merge; không trộn với feature.

---

## 13. Một dòng

Tuấn làm nền tảng + offline core; Thành làm toàn bộ trải nghiệm attendee (vé/QR/Q&A/poll/quiz);
Vũ làm toàn bộ cổng soát vé (camera/feedback/offline queue/sync); backend chỉ bổ sung public key
và `qrToken` trong sync, không phá web.
