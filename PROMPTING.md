# Sổ Tay Kỹ Thuật Prompting Cho AI & Quy Trình Phát Triển (qEvent)

Tài liệu này chuẩn hóa quy trình ra lệnh (prompting) và phương pháp cộng tác giữa lập trình viên và các trợ lý AI (Antigravity, Claude, Cursor, Copilot) trong toàn bộ dự án **qEvent**.

Để đảm bảo hệ thống không bị nợ kỹ thuật, giữ vững tính an toàn mật mã học, tối ưu mã nguồn và đạt chất lượng giao diện cao nhất, mọi tác vụ phải tuân thủ nghiêm ngặt **3 trụ cột công cụ**:
1. **GitNexus**: Bản đồ tri thức mã nguồn, phân tích tác động (impact analysis) và kiểm soát bán kính rủi ro (blast radius).
2. **Ponytail**: Tư duy lập trình viên tối giản (Lazy Senior Dev), viết ít code nhất giải quyết trọn vẹn bài toán, nguyên tắc YAGNI.
3. **Impeccable**: Tiêu chuẩn thiết kế giao diện cấp giám đốc nghệ thuật (áp dụng cho mọi bề mặt Frontend/Mobile).

---

## 🏛️ Bảng Ma Trận 3 Trụ Cột

| Công cụ | Trọng tâm | Khi nào sử dụng | Quy tắc cốt lõi |
| :--- | :--- | :--- | :--- |
| **GitNexus** | An toàn kiến trúc | Mọi chỉnh sửa mã nguồn backend/logic, điều hướng, tái cấu trúc | **BẮT BUỘC** chạy `impact` trước khi sửa symbol; chạy `detect_changes` trước khi commit. |
| **Ponytail** | Tối giản mã nguồn | Toàn bộ tác vụ viết code, sửa bug, chọn thư viện | Tạo ra **diff nhỏ nhất** giải quyết triệt để vấn đề; loại bỏ code thừa, wrapper và abstraction không cần thiết. |
| **Impeccable** | Chuẩn mực UI/UX | Toàn bộ giao diện người dùng (Mobile Expo, Web, Dashboard) | Tuân thủ sàn thiết kế: `borderWidth: 0`, chỉ dùng shadow đổ đáy, không blur, phản hồi đa giác quan. |

---

## 1. 🧠 Hướng Dẫn Sử Dụng GitNexus (Code Intelligence)

GitNexus duy trì một đồ thị quan hệ biểu tượng (symbols), quy trình nghiệp vụ (processes) và luồng thực thi (execution flows) cho dự án **qEvent**.

### Quy Tắc Bắt Buộc
- **TUYỆT ĐỐI KHÔNG sửa function, class, hoặc method khi chưa chạy phân tích tác động:**
  ```javascript
  impact({ target: "tên_symbol", direction: "upstream" })
  ```
  Kiểm tra danh sách caller trực tiếp, các quy trình bị ảnh hưởng và mức độ rủi ro (risk level). Nếu cần kiểm tra sâu đến từng dòng lệnh (statement-level) và phụ thuộc dữ liệu:
  ```javascript
  impact({ target: "tên_symbol", direction: "upstream", mode: "pdg" })
  ```
- **PHẢI cảnh báo ngay cho người dùng** nếu kết quả phân tích tác động trả về rủi ro mức **HIGH** hoặc **CRITICAL** trước khi tiến hành viết code.
- **TUYỆT ĐỐI KHÔNG dùng tính năng find-and-replace để đổi tên symbol:**
  Luôn dùng công cụ `rename` của GitNexus để đảm bảo cập nhật đồng bộ toàn bộ call graph.
- **TUYỆT ĐỐI KHÔNG commit code khi chưa chạy `detect_changes()`:**
  Kiểm tra xem thay đổi có bị lan sang các symbol hay quy trình ngoài ý muốn hay không:
  ```javascript
  detect_changes({ repo: "qEvent", scope: "compare", base_ref: "main" })
  ```
- **Khám phá mã nguồn bằng `query` và `context` thay vì grep chuỗi thô:**
  - Tìm luồng nghiệp vụ: `query({ search_query: "luồng soát vé ticket checkin" })`
  - Xem context đầy đủ của symbol (ai gọi nó, nó gọi ai): `context({ name: "verifyTicket" })`
  - Truy vết luồng dữ liệu (data flow/taint): `pdg_query({ mode: "flows", target: "checkinHandler", variable: "token" })`
  - Kiểm tra điều kiện thực thi: `pdg_query({ mode: "controls", target: "verifyTicket" })`
- **Cập nhật lại index khi mã nguồn có thay đổi:**
  Chạy lệnh từ thư mục gốc:
  ```bash
  node .gitnexus/run.cjs analyze
  ```

---

## 2. ⚡ Kỷ Luật Ponytail (Chế Độ Senior Dev Tối Giản)

Kỹ năng Ponytail ép buộc agent tạo ra **thay đổi nhỏ nhất nhưng giải quyết trọn vẹn yêu cầu**, ngăn chặn triệt để tình trạng code phình to (bloat), tạo wrapper rườm rà hay kiến trúc quá đà (over-engineering).

### Các Cấp Độ Hoạt Động (`/ponytail [lite|full|ultra]`)
- **`lite`**: Làm đúng những gì được yêu cầu. Đề xuất phương án nhỏ hơn, gọn hơn trong 1 câu ngắn để người dùng tự chọn.
- **`full` (Mặc định)**: Thi hành kỷ luật tối giản nghiêm ngặt:
  1. Chọn giải pháp đầu tiên hoạt động hoàn hảo.
  2. Tận dụng tối đa hàm phụ trợ, service, pattern có sẵn trong dự án.
  3. Ưu tiên standard library của runtime (Bun) và các thư viện đã cài (`@elysiajs/jwt`, `prisma`, `bcryptjs`). Tuyệt đối không cài thêm thư viện chỉ cho vài dòng code.
  4. Không thêm abstraction, wrapper, kiểu chuyển đổi, config hay code dự phòng cho tương lai nếu người dùng không yêu cầu.
  5. Xóa code tốt hơn thêm code. Diff ngắn nhất và dễ đọc nhất là phương án chiến thắng.
  6. Sửa bug: Truy vết toàn bộ caller, xử lý tận gốc vấn đề một lần duy nhất tại nơi dùng chung.
- **`ultra`**: Phản biện yêu cầu ngay từ đầu. Chất vấn và từ chối các phần tính năng không cần thiết trước khi gõ dòng code nào.

### Quy Định Về Kiểm Thử & Chốt Phản Hồi
- Mã nguồn có logic rẽ nhánh, vòng lặp, bảo mật hoặc tiền tệ **phải có một unit test nhỏ** trong `backend/test/` hoặc câu lệnh assert tự kiểm tra.
- Nếu chấp nhận một lối tắt (shortcut), bắt buộc ghi chú theo cú pháp:
  ```typescript
  // shortcut: <giới hạn hiện tại>, <khi nào cần nâng cấp>
  ```
- **Quy tắc kết thúc câu trả lời**: Luôn kết thúc bằng 1–2 dòng tóm tắt rõ:
  1. Những gì đã chủ động bỏ qua hoặc chưa kiểm tra.
  2. Bất kỳ rủi ro, giới hạn hoặc trường hợp biên nào người dùng cần lưu ý.

---

## 3. 🎨 Tiêu Chuẩn Impeccable (Dành Riêng Cho Frontend & Giao Diện UI)

*Áp dụng khi phát triển ứng dụng di động Expo / React Native hoặc trang quản trị (Admin Dashboard).*

### Khởi Tạo Ngữ Cảnh UI
Trước khi sửa file giao diện, luôn nạp context thiết kế:
```bash
# Trên Windows
.agent/skills/impeccable/scripts/impeccable.cmd context
# Trên macOS / Linux
.agent/skills/impeccable/scripts/impeccable context
```
*(Nếu launcher không khả dụng, đọc trực tiếp 2 file: `PRODUCT.md` và `DESIGN.md`)*.

### Sàn Thiết Kế Bất Biến Của qEvent (Tuyệt Đối Không Vi Phạm)
1. **Chỉ Dùng Light Theme (Chủ đề sáng)**:
   - Màu nền (canvas): `#F8FAFC` hoặc `#FFFFFF`.
   - Bề mặt card: `#FFFFFF`.
   - Chữ chính: `#0F172A` / `#334155`. Màu chủ đạo (Brand): `#2563EB`.
2. **Không Dùng Viền (`borderWidth: 0`)**:
   - Nghiêm cấm mọi đường viền (border/outline/hairline) trên cards, nút bấm, ô nhập liệu (inputs), tabs, và badges.
   - Phân cấp thị giác hoàn toàn bằng độ tương phản bề mặt và bóng đổ.
3. **Chỉ Dùng Bóng Đổ Đáy (Bottom Drop Shadow)**:
   - Android: `elevation: 2` đến `elevation: 8`.
   - iOS: `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.08`, `shadowRadius: 8`.
4. **Cấm Hiệu Ứng Làm Mờ (No Blur / No Glassmorphism)**:
   - Nghiêm cấm sử dụng `BlurView` hoặc bộ lọc blur.
   - Sử dụng lớp phủ phẳng bán trong suốt: `rgba(15, 23, 42, 0.45)`.
5. **Phản Hồi Đa Giác Quan Tức Thì (Soát Vé)**:
   - **Vé hợp lệ (Xanh `#10B981`)**: 1 âm chuông "ting" (`expo-av`) + 1 nhịp rung nhẹ (`expo-haptics`).
   - **Vé đã quét trước đó (Vàng `#F59E0B`)**: 2 nhịp rung cảnh báo + hiển thị rõ "VÉ ĐÃ QUÉT TRƯỚC ĐÓ".
   - **Vé giả mạo / Lỗi (Đỏ `#EF4444`)**: Âm báo lỗi + màn hình đỏ.
6. **Bảo Mật Chống Chụp / Quay Màn Hình**:
   - Màn hình hiển thị Dynamic QR bắt buộc phải kích hoạt `expo-screen-capture`.

### Các Lệnh Impeccable Phổ Biến
- `/impeccable shape [tính_năng]`: Lên kế hoạch UX, bố cục và tương tác đa giác quan trước khi code.
- `/impeccable audit [đối_tượng]`: Rà soát khả năng tiếp cận (a11y), độ tương phản dưới ánh sáng mạnh ngoài trời.
- `/impeccable polish [đối_tượng]`: Tinh chỉnh nhịp điệu thị giác, haptics và khoảng cách vi mô (micro-spacing).
- `/impeccable distill [đối_tượng]`: Loại bỏ chi tiết thừa, giảm tải nhận thức cho nhân viên trực cổng.
- `/impeccable harden [đối_tượng]`: Gia cố trạng thái mạng chập chờn, chế độ offline và xử lý ngoại lệ.

---

## 4. 🌿 Quy Trình Tạo Nhánh Mới Cho Tính Năng & Sửa Lỗi (Git Branching)

Để giữ nhánh `main` luôn ở trạng thái sẵn sàng triển khai (production-ready), mọi công việc phát triển **bắt buộc phải thực hiện trên nhánh riêng biệt**.

### Chuẩn Đặt Tên Nhánh
- **Tính năng mới**: `feat/<tên-ngắn-gọn>` (ví dụ: `feat/bulk-transfer`, `feat/ticket-analytics`)
- **Sửa lỗi**: `fix/<tên-lỗi>` (ví dụ: `fix/qr-timestamp-sync`, `fix/db-pool-exhaustion`)
- **Tái cấu trúc**: `refactor/<tên-mô-đun>` (ví dụ: `refactor/checkin-cache`)

### Trình Tự Thực Thi Chuẩn
1. **Đồng bộ nhánh chính**:
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Khởi tạo và chuyển sang nhánh mới**:
   ```bash
   git checkout -b feat/<tên-tính-năng>
   ```
3. **Phát triển với bộ ba công cụ**:
   - Chạy GitNexus `impact` trước khi sửa symbol nào.
   - Viết code tối giản theo Ponytail, chạy `bun test`.
   - Nếu làm UI: áp dụng tiêu chuẩn Impeccable.
4. **Đối chiếu sai khác trước khi commit**:
   ```javascript
   detect_changes({ repo: "qEvent", scope: "compare", base_ref: "main" })
   ```
5. **Commit và đẩy lên remote**:
   ```bash
   git add .
   git commit -m "feat(tickets): thêm API chuyển nhượng vé hàng loạt"
   git push -u origin feat/<tên-tính-năng>
   ```

---

## 📋 Mẫu Câu Nhắc (Prompt Templates) Tiếng Việt Copy-Paste

### Mẫu 1: Sửa Lỗi & Tái Cấu Trúc Backend An Toàn (GitNexus + Ponytail)
```text
Nhiệm vụ: Khắc phục sự cố [Mô tả lỗi trong backend, ví dụ: xung đột đồng bộ vé ngoại tuyến offline-sync].

Quy trình bắt buộc:
1. Sử dụng GitNexus để xác định phạm vi ảnh hưởng:
   - Chạy `impact({ repo: "qEvent", target: "<tên_hàm_hoặc_class>", direction: "upstream" })`.
   - Báo cáo bán kính ảnh hưởng. CẢNH BÁO NGAY nếu rủi ro đạt mức HIGH hoặc CRITICAL trước khi sửa code.
2. Áp dụng kỷ luật Ponytail (Full):
   - Tạo ra diff nhỏ nhất giải quyết triệt để nguyên nhân gốc rễ.
   - Tận dụng mã nguồn có sẵn, không thêm wrapper hay thư viện bên ngoài.
   - Cập nhật hoặc bổ sung test case tương ứng trong `backend/test/`.
3. Kết thúc câu trả lời bằng 1-2 dòng nêu rõ những gì đã bỏ qua và rủi ro/trường hợp biên cần lưu ý.
```

### Mẫu 2: Phát Triển Endpoint / Tính Năng Backend Mới (Tạo Nhánh + GitNexus + Ponytail)
```text
Nhiệm vụ: Xây dựng endpoint/tính năng mới: [Mô tả chi tiết, ví dụ: POST /api/tickets/bulk-transfer].

Quy trình bắt buộc:
0. Khởi tạo nhánh mới: Kiểm tra nhánh `main`, cập nhật mới nhất và tạo nhánh `feat/<tên-tính-năng>`.
1. Dùng GitNexus `query` và `context` để tham chiếu cấu trúc module tickets và auth hiện có.
2. Tuân thủ Ponytail:
   - Tái sử dụng prisma plugin, cơ chế xác thực JWT và kiểu dữ liệu có sẵn.
   - Viết route và controller ngắn gọn, đúng trọng tâm, không tạo abstraction dự phòng.
   - Viết kèm Bun unit test kiểm tra luồng thành công và các lỗi cơ bản.
3. Chạy GitNexus `detect_changes({ repo: "qEvent", scope: "compare", base_ref: "main" })` trước khi hoàn tất để đảm bảo không tác động ngoài ý muốn đến luồng nghiệp vụ khác.
4. Hướng dẫn commit theo chuẩn Conventional Commits và tạo pull request.
```

### Mẫu 3: Thiết Kế / Cải Thiện Màn Hình Giao Diện Mobile (Impeccable + Ponytail)
```text
Nhiệm vụ: Xây dựng / Cải tiến màn hình [Tên màn hình, ví dụ: Chi tiết vé khách tham dự với Dynamic QR].

Quy trình bắt buộc:
1. Đọc ngữ cảnh UI từ `PRODUCT.md` và `DESIGN.md`.
2. Áp dụng chế độ OPERATE (nhanh gọn, độ tương phản cao, tối ưu cho thao tác tại cổng vào).
3. Tuân thủ tuyệt đối sàn thiết kế qEvent:
   - Light theme duy nhất (Nền `#F8FAFC`, bề mặt card `#FFFFFF`, chữ `#0F172A`).
   - `borderWidth: 0` trên toàn bộ component (không viền, không hairline).
   - Chỉ dùng bottom drop shadow để tạo khối nổi.
   - Không dùng BlurView hay hiệu ứng kính mờ (glassmorphism).
   - Bật chống chụp màn hình `expo-screen-capture` và hiển thị vòng đếm ngược 30 giây.
4. Kỷ luật Ponytail: Cấu trúc component tinh gọn, không cài đặt thư viện UI cồng kềnh ngoài luồng.
```

### Mẫu 4: Đánh Giá Toàn Diện Giao Diện & Trợ Năng (Impeccable Audit)
```text
Nhiệm vụ: Thực hiện audit giao diện cho [Tên màn hình, ví dụ: Màn hình quét vé nhân viên (Staff Scanner)].

Quy trình bắt buộc:
1. Chạy Impeccable Audit kiểm tra:
   - Khả năng đọc dưới ánh sáng mặt trời / chống lóa tại cổng sự kiện.
   - Kích thước vùng bấm (tối thiểu 48x48dp cho nhân viên thao tác một tay).
   - Sự tuân thủ nguyên tắc `borderWidth: 0` và bóng đổ đáy.
   - Độ trễ của phản hồi đa giác quan (âm thanh + rung haptics + nhấp nháy màu màn hình).
2. Liệt kê các điểm cần sửa theo thứ tự ưu tiên (Blocker -> Major -> Minor).
3. Cung cấp đoạn code thay đổi nhỏ gọn nhất để khắc phục ngay các lỗi Blocker và Major.
```

### Mẫu 5: Kiểm Tra Rủi Ro Trước Khi Commit (GitNexus)
```text
Nhiệm vụ: Rà soát toàn bộ thay đổi trước khi tạo git commit.

Quy trình bắt buộc:
1. Chạy `detect_changes({ repo: "qEvent", scope: "compare", base_ref: "main" })`.
2. Báo cáo:
   - Danh sách symbol và execution flow bị ảnh hưởng.
   - Phát hiện caller ngoài phạm vi hoặc tác dụng phụ không mong muốn.
3. Xác nhận toàn bộ bộ test trong `backend/test/` đã chạy thành công mà không có hồi quy (regression).
```
