# qEvent Mobile — Prompt cho agent (3 người)

Dành cho **Thành**, **Vũ** và bất kỳ agent nào nhận việc trong `mobile/`.
Đọc `docs/MOBILE_APP_TEAM_SPLIT_3.md` trước; tài liệu này chỉ nói **prompt cái gì, đưa context
nào, dùng skill nào, không được làm gì**.

---

## 1. Đọc gì trước khi prompt

| Thứ tự | File | Vì sao |
|---|---|---|
| 1 | `docs/MOBILE_APP_TEAM_SPLIT_3.md` | Nguồn sự thật: scope, route, ownership, API, offline gap |
| 2 | `PRODUCT.md` + `DESIGN.md` (mục Mobile) | Vai trò, ràng buộc UI, AA, no border/blur, bottom shadow |
| 3 | `ARCHITECTURE.md` + `README.md` | Gateway, service, auth, WebSocket |
| 4 | `services/*/openapi.json` | Contract thật; không đoán response |
| 5 | `MVP.md` | **Chỉ tham khảo lịch sử**; endpoint/QR trong đây đã cũ |
| 6 | `PROMPTING.md` | Mẫu prompt, GitNexus, Ponytail, Impeccable |

Nếu task hẹp (1 màn hình), chỉ đưa: route, endpoint, file được sửa, ảnh/evidence mong muốn.

---

## 2. Skill phải dùng

| Skill | Khi nào | Ghi chú |
|---|---|---|
| `impeccable` | **Mọi** thay đổi UI | Mode **Operate**; native iOS/Android. Được `audit`, `polish`, `harden`, `clarify`, `adapt`; **cấm** `bolder`, `colorize`, `delight`, `overdrive` |
| `ponytail` | Luôn bật | Diff nhỏ nhất; không thêm dependency/wrapper nếu Expo/RN có sẵn |
| `gitnexus-lfg` / `gitnexus-plan` | Task > ~35 lượt | Plan ghi vào `docs/plans/` |
| `gitnexus-work` | Thực thi plan | `impact` trước mỗi symbol; `detect_changes` trước commit |
| `gitnexus-impact-analysis` | Trước khi sửa/rename/xoá symbol | `UNKNOWN` ≠ an toàn |
| `gitnexus-exploring` | Chưa hiểu luồng | Graph trước, grep sau |
| `gitnexus-review` | Trước PR | Verdict, không tự sửa |
| `find-skills` | Thiếu capability | Đề xuất cài, không tự chế workflow |

Không dùng `hyperframes*`, `media-use`, `report` cho app mobile.

---

## 3. Quy tắc bất di bất dịch

1. **KHÔNG commit/push** trừ khi được bảo rõ. Nếu được bảo commit: tạo nhánh `feat/mobile-…`,
   commit trên nhánh, push chỉ khi được bảo.
2. **Không sửa `services/**`, `gateway/**`.** Cần public key / sync `qrToken` → báo Tuấn.
3. **Một file một chủ** theo `MOBILE_APP_TEAM_SPLIT_3.md` §3. Sửa `src/lib/**`/`app/_layout` →
   nhắn Tuấn.
4. **Không bịa endpoint.** Chỉ dùng bảng API §5; `MVP.md` không phải contract.
5. **Không lưu JWT/QR token** trong AsyncStorage, SQLite, log, analytics, ảnh chụp.
6. **Không hex/BlurView/gradient/dark mode** trong feature; token ở `src/theme/**` và
   `src/components/**` (Tuấn).
7. **Đủ trạng thái**: loading / empty / error / 401 / 403 / 404 / 409 / 422 / 503 / offline.
8. **Offline không được đoán xanh**: không verify được chữ ký → vàng “đã xếp hàng”.
9. **Không tự thêm dependency** nếu Expo/RN có sẵn (camera, sqlite, secure-store, haptics,
   audio, network, screen-capture).
10. **Không tạo màn hình organizer/host/purchase** trên mobile — ngoài scope.
11. **UI base đã chốt**: NativeWind v5 + **React Native Reusables**. Primitive nằm trong
   `src/components/ui/**`; thêm bằng CLI của Reusables, không tự viết Button/Input/Dialog.
   Không cài gluestack/RN Paper/Tamagui; không mix hai UI kit.

---

## 4. Quy trình chuẩn cho một màn hình

```text
1. /gitnexus-plan "<màn hình> theo docs/MOBILE_APP_TEAM_SPLIT_3.md §7.x" (hoặc /gitnexus-lfg)
2. Đọc plan, chốt với Tuấn ở gate
3. /gitnexus-work docs/plans/<plan>.md
4. /gitnexus-review (branch hoặc local)
5. Test máy thật (nếu camera/offline), chụp evidence iOS + Android
6. PR ghi: màn hình, endpoint, phần cắt, gap B1/B2 đã xử lý chưa
```

Trước **mỗi** lần sửa symbol: `impact({ target, direction: "upstream" })`.
Trước commit: `detect_changes({ scope: "all" })`; `partial/truncated` không phải “sạch”.

---

## 5. Prompt khởi động cho từng người

### 5.1. Tuấn — Foundation + Offline core

```text
Khởi tạo app mobile qEvent bằng Expo + Expo Router trong mobile/ theo
docs/MOBILE_APP_TEAM_SPLIT_3.md §3.1, §7.1.

Phạm vi:
- Expo SDK stable, React Native, TypeScript strict, Expo Router; Bun để cài.
- Styling: NativeWind v5 / Tailwind 4. UI base: React Native Reusables (copy-in,
  `@rn-primitives`). Không cài gluestack/RN Paper/Tamagui.
- Theme mobile: light only, nền #F8FAFC, card #FFFFFF, text #0F172A/#475569,
  primary #2563EB; borderWidth 0; bottom shadow; không blur/gradient/dark mode.
- Import primitive Reusables vào src/components/ui (Button, Input, Card, Dialog, Tabs,
  Badge, Skeleton, Empty...) và patch token qEvent; component nền: Screen, OfflineBanner,
  ErrorState. Nếu thiếu primitive, dùng RN/Expo tương ứng hoặc @gorhom/bottom-sheet;
  không đổi UI kit.
- src/api: openapi-fetch + generated từ services/*/openapi.json; error tiếng Việt.
- src/auth: login, /auth/me, JWT trong expo-secure-store, role gate ATTENDEE vs STAFF/ORGANIZER.
- src/lib/realtime: WS /ws/qa + /ws/game, reconnect 1/2/4/8/16/30s + jitter,
  heartbeat 25s, fallback polling 5s sau 30s, refetch 1 lần khi reconnect.
- src/lib/offline: SQLite schema cache vé + queue; verifyOfflineToken (public key,
  iat 30s, event/order/status); syncQueue gọi /api/checkins/sync-offline; map
  SYNCED/CONFLICT/DUPLICATE/ERROR.
- Backend P0: chốt với backend owner GET /api/qr/public-key và qrToken? trong sync
  (additive, không phá web). Cập nhật OpenAPI + generated.
- app/_layout, app/index redirect theo role, deep link, network banner.
- Test: unit token/verify/cache/queue; typecheck/lint CI; EAS config.
- Env: EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_WS_BASE_URL; không đặt secret trong EXPO_PUBLIC_*.
- UI kit: chỉ dùng Reusables + primitive trong src/components/ui; thêm component bằng CLI,
  không tự viết, không cài gluestack/RN Paper/Tamagui.

Ràng buộc:
- KHÔNG làm UI attendee/staff (Thành/Vũ làm); chỉ component nền.
- KHÔNG log token/QR; không lưu secret.
- KHÔNG commit/push.
- Dùng impeccable mode Operate (native), ponytail, gitnexus impact.
- Báo lại khi typecheck/lint/test xanh và contract P0 rõ ràng.
```

### 5.2. Thành — Attendee experience

```text
Làm toàn bộ trải nghiệm attendee trong app mobile theo
docs/MOBILE_APP_TEAM_SPLIT_3.md §3.2, §7.2.

Màn hình:
- app/(attendee)/tickets/index.tsx: GET /api/tickets/my; loading/empty/error; event info.
- app/(attendee)/tickets/[ticketId].tsx: GET /api/tickets/:id/qr-token; QR +
  countdown expiresIn; refresh khi hết hạn; expo-screen-capture; trạng thái
  PAID/CHECKED_IN/CANCELLED/ORDER_NOT_CONFIRMED.
- app/(attendee)/live/index.tsx: session live của event đã check-in; empty state.
- app/(attendee)/live/[sessionId]/qa.tsx: GET/POST questions, PUT votes,
  realtime + fallback; 403 NOT_CHECKED_IN / SESSION_NOT_LIVE có copy rõ.
- app/(attendee)/live/[sessionId]/polls.tsx: GET polls, POST vote; poll đóng disable;
  hiện kết quả/tổng vote.
- app/(attendee)/live/[sessionId]/quiz.tsx: GET game; POST answer; leaderboard;
  status WAITING/QUESTION_ACTIVE/ROUND_REVEALED/FINISHED; displayMode FULL/LETTERS;
  không hiện correctOption trước reveal.
- app/(attendee)/profile.tsx: user, role, logout.

Ràng buộc:
- Chỉ sửa app/(attendee)/**, src/features/tickets/**, src/features/engagement/**,
  e2e/attendee-*.yaml, docs/evidence/mobile/attendee/**.
- Dùng src/api, src/auth, src/lib/realtime, components của Tuấn; không sửa src/lib/**.
- UI: dùng primitive trong src/components/ui (Reusables); không tự viết Button/Input/Card,
  không cài gluestack/RN Paper/Tamagui.
- Không mua vé/đăng ký; không organizer/host.
- UI: light, borderWidth 0, bottom shadow, no blur, ≥48dp, AA; QR chống chụp.
- Không log QR/token. KHÔNG commit/push.
- Dùng impeccable Operate, ponytail, gitnexus; test component + Maestro; evidence iOS/Android.
```

### 5.3. Vũ — Staff gate

```text
Làm toàn bộ cổng soát vé trên mobile theo docs/MOBILE_APP_TEAM_SPLIT_3.md §3.3, §7.3.

Màn hình:
- app/(staff)/events.tsx: GET /api/events; chọn event + cổng + deviceId;
  tải cache qua GET /api/tickets?eventId=&since=&limit=100 (lặp nextCursor);
  hiện số vé đã cache, thời gian cache, server time offset.
- app/(staff)/scanner.tsx: expo-camera CameraView, quyền camera, nhập tay,
  debounce 3s, lịch sử 10; online POST /api/checkins; offline verifyOfflineToken
  từ Tuấn; kết quả xanh/vàng/đỏ/xám; beep expo-audio + haptic expo-haptics + flash.
- app/(staff)/sync.tsx: queue count, sync, conflict/duplicate/error, retry,
  xoá item lỗi có confirm; banner offline.
- app/(staff)/profile.tsx: user, role, logout.
- app/(staff)/_layout.tsx: tabs Quét / Đồng bộ / Tài khoản; role STAFF/ORGANIZER.

Ràng buộc:
- Chỉ sửa app/(staff)/**, src/features/scanner/**, src/features/sync/**,
  e2e/staff-*.yaml, docs/evidence/mobile/staff/**.
- Dùng src/lib/offline của Tuấn; không tự viết SQLite/verify/sync thứ hai.
- UI: dùng primitive trong src/components/ui (Reusables); không tự viết UI kit,
  không cài gluestack/RN Paper/Tamagui.
- Không hiện xanh nếu không verify được chữ ký; hiện vàng “đã xếp hàng”.
- Không log QR/token; không lưu secret.
- UI: nút chính ≥48dp ở 1/3 dưới; camera ≥50% chiều cao; không card bao camera.
- KHÔNG commit/push.
- Dùng impeccable Operate, ponytail, gitnexus; test máy thật + Maestro; evidence iOS/Android.
```

---

## 6. Prompt cho feature nhỏ (copy-paste)

### 6.1. Màn hình QR vé (Thành)

```text
Làm màn hình /tickets/[ticketId] theo docs/MOBILE_APP_TEAM_SPLIT_3.md §7.2 A3.
- Chỉ sửa src/features/tickets/**, app/(attendee)/tickets/[ticketId].tsx.
- API: GET /api/tickets/:id/qr-token → { qrToken, expiresIn, status, checkedInAt }.
- QR render bằng react-native-qrcode-svg; countdown expiresIn; hết hạn gọi lại.
- Bật expo-screen-capture khi screen active; tắt khi rời.
- Trạng thái: loading, lỗi mạng (giữ token cũ đến hết hạn), CANCELLED,
  ORDER_NOT_CONFIRMED, CHECKED_IN.
- Không log token; không lưu token vào storage.
- Test component countdown + lỗi; evidence iOS/Android. Không commit.
```

### 6.2. Scanner offline (Vũ)

```text
Làm /staff/scanner theo docs/MOBILE_APP_TEAM_SPLIT_3.md §7.3 S2–S5.
- Chỉ sửa src/features/scanner/**, app/(staff)/scanner.tsx.
- Dùng expo-camera, expo-haptics, expo-audio; nhập tay fallback.
- Online: POST /api/checkins { qrToken, gate, deviceId }.
- Offline: gọi `evaluateOfflineScan(...)` của src/lib/offline (Tuấn); chỉ xanh khi
  chữ ký hợp lệ + vé trong cache + order CONFIRMED + chưa quét. Hàm đã tự dùng
  `serverNow()`, không truyền `Date.now()` thô.
- Không verify được → vàng “Đã xếp hàng”, `enqueueScan({ ticketId, eventId, ... })`.
  Queue phải lưu `eventId`; sync chỉ gửi vé của event đang chọn.
- Lỗi mạng/5xx không tiêu hao 3 lượt retry; chỉ lỗi vé/token xác định mới đếm.
- Map kết quả theo bảng 7 dòng; beep/rung/flash; debounce 3s; history 10.
- Test mapping + queue; test máy thật airplane mode. Không commit.
```

### 6.3. Q&A attendee (Thành)

```text
Làm /live/[sessionId]/qa theo docs/MOBILE_APP_TEAM_SPLIT_3.md §7.2 A5.
- GET /api/sessions/:sessionId/questions; POST câu hỏi; PUT vote.
- Realtime /ws/qa; fallback polling 5s; banner trạng thái.
- 403 NOT_CHECKED_IN / SESSION_NOT_LIVE: copy “Bạn cần check-in.../phiên chưa live”.
- Optimistic vote, rollback khi lỗi; không auto-scroll nếu đang đọc.
- Test component + Maestro; evidence iOS/Android. Không commit.
```

### 6.4. Poll/Quiz attendee (Thành)

```text
Làm /live/[sessionId]/polls và /quiz theo docs/MOBILE_APP_TEAM_SPLIT_3.md §7.2 A6–A7.
- Polls: GET polls; POST vote body { optionId } (cùng option = bỏ vote);
  poll đóng disable; hiện kết quả/tổng.
- Quiz: GET /api/sessions/:sessionId/game; POST /api/game/:gameId/answer
  body { questionId, selectedOption }; GET leaderboard; trạng thái
  WAITING/QUESTION_ACTIVE/ROUND_REVEALED/FINISHED; displayMode FULL/LETTERS;
  không hiện correctOption trước reveal.
- Lưu ý: POST answer trả `isCorrect` ngay; app **không** hiện đúng/sai trước
  ROUND_REVEALED, chỉ hiện “Đã gửi câu trả lời”.
- 400 ANSWER_WINDOW_CLOSED / ANSWER_TOO_LATE / 409 ALREADY_ANSWERED có copy rõ.
- Test state machine + Maestro; evidence. Không commit.
```

### 6.5. Backend P0 cho offline (Tuấn + backend owner) — **đã xong 2026-11-27**

```text
Làm additive backend cho mobile offline theo docs/MOBILE_APP_TEAM_SPLIT_3.md §4.

Phạm vi:
- GET /api/qr/public-key → { publicKey, kid }, cache-control dài, không lộ private key.
- POST /api/checkins/sync-offline: thêm qrToken? vào log; verify chữ ký, iat và TOTP
  theo scannedAt; log cũ không có qrToken vẫn chạy.
- (Optional) GET /api/checkins/cache?eventId=&since= trả field tối thiểu; nếu không,
  mobile dùng GET /api/tickets?eventId=&since= lặp cursor.
- Cập nhật OpenAPI + generated types; gateway route nếu thêm /api/qr/*.

Ràng buộc:
- Không phá web: endpoint cũ giữ nguyên response/status.
- Impact trước mỗi symbol; test tampered/expired/valid token; detect_changes trước commit.
- Không commit/push khi chưa được bảo.
```

---

## 7. Prompt audit/polish (không sửa code)

```text
/impeccable audit màn hình scanner và ticket QR trên iOS + Android.
Kiểm: contrast ngoài trời, target ≥48dp, font scale 200%, một tay, beep/rung,
screen capture, trạng thái offline. Chỉ báo finding Blocker/Major/Minor kèm ảnh;
không sửa file, không commit.
```

---

## 8. Checklist trước khi báo “xong”

- [ ] `bun run typecheck && bun run lint && bun run test` xanh.
- [ ] E2E Maestro flow của feature xanh.
- [ ] Không hex/BlurView/gradient/border trong feature; token đúng; dùng primitive Reusables.
- [ ] Không cài gluestack/RN Paper/Tamagui; không tự viết Button/Input/Dialog.
- [ ] Target ≥48dp; font scale 200%; VoiceOver/TalkBack 3 màn chính.
- [ ] Không log token/QR; JWT trong SecureStore.
- [ ] Offline: không xanh nếu chưa verify; queue không mất khi kill app.
- [ ] Ảnh iOS + Android trên device/emulator đại diện (không dùng mốc 390/768 của web) trong `docs/evidence/mobile/`.
- [ ] PR ghi: màn hình, endpoint, phần cắt, B1/B2 đã có chưa.
- [ ] **Chưa commit**, chưa push (trừ khi được bảo).

---

## 9. Git

| Việc | Quy ước |
|---|---|
| Nhánh | `feat/mobile-<scope>-<việc>`, `fix/mobile-<scope>-<lỗi>` |
| Commit | Conventional Commits: `feat(mobile-tickets): add QR countdown` |
| Scope | `mobile-foundation`, `mobile-tickets`, `mobile-engagement`, `mobile-scanner`, `mobile-sync` |
| PR | ≤ 400 dòng; reviewer luân phiên Tuấn↔Thành, Thành↔Vũ, Vũ↔Tuấn |
| Push | Chỉ khi được bảo, sau khi tạo nhánh |

---

## 10. Anti-pattern

- Dùng endpoint trong `MVP.md` (`/my-tickets`, `/checkin/verify`, `/purchase-sandbox`) →
  không tồn tại; xem bảng API §5.
- Lưu `qrSecret`/JWT/QR token vào AsyncStorage/SQLite/log.
- Hiện xanh offline khi chưa verify chữ ký.
- Tự viết WebSocket/SQLite/queue thứ hai ngoài `src/lib` của Tuấn.
- Cài gluestack/RN Paper/Tamagui hoặc tự viết Button/Input/Dialog thay vì dùng Reusables.
- Dùng `expo-av` khi SDK mới đã có `expo-audio`.
- Dùng `#94A3B8` cho text phụ → fail AA; dùng `#475569`.
- Copy screenshot simulator thay cho test camera thật.
- Commit/push khi chưa được bảo.
