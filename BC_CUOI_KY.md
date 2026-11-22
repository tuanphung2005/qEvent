**Không có prompt injection.** Đây là đề bài bài tập lớn bình thường: không có chỉ dẫn nhắm vào AI hay yêu cầu thay đổi hành vi của tôi. Dòng "Được dùng công cụ AI để lập trình hoặc làm slide nhưng phải khai báo trong báo cáo" chỉ là quy định dành cho sinh viên.

Dưới đây là bản Markdown:

# YÊU CẦU BÀI TẬP LỚN

## 1. Đề bài

Chọn một bài toán nghiệp vụ thực tế; phân tích, thiết kế và xây dựng hệ thống theo kiến trúc microservices gồm nhiều service độc lập, có API Gateway và được đóng gói bằng container. Nộp báo cáo, mã nguồn chạy được và bảo vệ trực tiếp (demo và vấn đáp).

- Nhóm tối đa 5 sinh viên. Nhóm tự chọn và đăng ký đề tài, hai nhóm không làm trùng đề tài.
- Ngôn ngữ và cơ sở dữ liệu do nhóm tự chọn (khuyến khích Node.js/Express như các buổi thực hành).

## 2. Yêu cầu bắt buộc

| # | Yêu cầu |
|---|---|
| 1 | **Nghiệp vụ:** nêu rõ bài toán, người dùng và ít nhất 5 quy tắc nghiệp vụ. |
| 2 | **Phân rã service:** số service nghiệp vụ tối thiểu theo quy mô nhóm (không tính API Gateway): nhóm 1–2 người: 2; nhóm 3–4 người: 3; nhóm 5 người: 4. Chia theo nghiệp vụ; mỗi service có mã nguồn và dữ liệu riêng; giải thích vì sao chia như vậy. |
| 3 | **API REST và OpenAPI:** mỗi service ≥ 4 endpoint đúng quy ước REST (method, status code), có ≥ 1 endpoint thể hiện quy tắc nghiệp vụ (trả 4xx có ý nghĩa); mỗi service có tệp OpenAPI. |
| 4 | **API Gateway:** điểm vào duy nhất, chỉ định tuyến và áp chính sách; không chứa luật nghiệp vụ. |
| 5 | **Giao tiếp liên service tin cậy:** mọi lời gọi có timeout và quy tắc thử lại; phân biệt lỗi nghiệp vụ (4xx) với lỗi hạ tầng (503/504); địa chỉ service lấy từ biến môi trường; mỗi service có `GET /health`. |
| 6 | **Luồng nhiều bước:** ít nhất một luồng nghiệp vụ trải qua ≥ 2 service, có xử lý lỗi giữa chừng (hoàn tác theo thứ tự ngược, hoặc trạng thái PENDING khi không biết kết quả). |
| 7 | **Container:** Dockerfile cho từng service và `docker-compose.yml`; chạy cả hệ thống bằng một lệnh (`docker compose up`). |
| 8 | **Kiểm thử và thử nghiệm lỗi:** Postman collection ≥ 10 request (gồm thành công và lỗi nghiệp vụ); thử và ghi lại ≥ 2 tình huống lỗi (tắt hoặc làm chậm một service) kèm số liệu trước và sau khi xử lý. |

## 3. Điểm cộng (tối đa +1,0)

- Hàng đợi thông điệp (ví dụ RabbitMQ) cho một luồng phụ, có consumer idempotent và hàng đợi lỗi (DLQ): **+0,5**
- Xác thực JWT tại API Gateway: **+0,25**
- Circuit Breaker hoặc Bulkhead: **+0,25**
- CI chạy test tự động hoặc log/giám sát tập trung: **+0,25**

## 4. Sản phẩm nộp

- **Báo cáo** (PDF, tối thiểu 30 trang): giới thiệu bài toán cần xử lý và nghiệp vụ liên quan, thiết kế kiến trúc (sơ đồ 1 trang; bảng service – dữ liệu – trách nhiệm; vì sao chia; công nghệ sử dụng), thiết kế API, độ tin cậy và xử lý lỗi (down hoặc chậm dịch vụ), triển khai và kiểm thử, đánh giá, hạn chế.
- **Mã nguồn** trên Git, tệp OpenAPI, Postman collection.
- **Slide bảo vệ** (tối đa 10 slide).

## 5. Đánh giá

Bài tập lớn chiếm **70% điểm học phần**: Báo cáo 40% và Bảo vệ 30%. Mỗi phần chấm theo thang 10.

**Báo cáo**

| Tiêu chí | Điểm |
|---|---|
| Phân tích nghiệp vụ và yêu cầu | 1,5 |
| Thiết kế kiến trúc (chia service, dữ liệu, sơ đồ, giải thích) | 2,5 |
| Thiết kế API và OpenAPI | 2,0 |
| Độ tin cậy và xử lý lỗi, có số liệu | 2,0 |
| Triển khai và kiểm thử | 1,0 |
| Hình thức, trình bày báo cáo | 1,0 |
| **Tổng** | **10** |

**Bảo vệ**

| Tiêu chí | Điểm |
|---|---|
| Demo hệ thống chạy: một lệnh, luồng chính đúng | 3,0 |
| Demo kịch bản lỗi: tắt một service, hệ thống phản ứng đúng | 2,0 |
| Vấn đáp: giải thích thiết kế, mã, đánh đổi (chấm riêng từng thành viên) | 3,0 |
| Kỹ năng trình bày | 1,0 |
| Mã nguồn và kho Git | 1,0 |
| **Tổng** | **10** |

**Điểm cá nhân:** các phần ngoài vấn đáp chấm theo nhóm; giảng viên điều chỉnh điểm từng thành viên theo phân công. Thành viên không giải thích được phần mình chịu trách nhiệm bị trừ điểm.

## 6. Quy định

- Không sao chép bài của nhóm khác hoặc nguồn bên ngoài mà không ghi nguồn.
- Được dùng công cụ AI để lập trình hoặc làm slide nhưng phải khai báo trong báo cáo; mọi thành viên phải giải thích được cách làm và từng phần mã của nhóm.
- Hệ thống phải chạy được trên máy của nhóm khi bảo vệ; demo trực tiếp là bắt buộc.
