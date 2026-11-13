# Fault-injection evidence

- Ngày đo: 2026-11-13
- Môi trường: Docker Compose (gateway `:8000`, 3 service, 3 PostgreSQL riêng)
- Seed: `event-service`, `admission-service`, `engagement-service` (idempotent)
- Máy dev: Windows, Docker Desktop, Bun 1.4.4
- Script: `scripts/order-fault-experiment.ts`, `scripts/lost-response-experiment.ts`, `scripts/fault-injection.ts`

## 1. Event Service sập trong lúc đặt vé

Lệnh:

```bash
bun scripts/order-fault-experiment.ts > docs/evidence/order-fault.json
```

Script tự dừng `event-service`, đặt 5 đơn, bật lại và chờ reconciler.

| Chỉ số | Kết quả |
|---|---:|
| Đơn gửi | 5 |
| Nhận `202 PENDING_RECONCILIATION` | 5/5 |
| p50 / p95 latency lúc Event sập | 1022.6ms / 1024.0ms |
| Event healthy trở lại | 2070ms |
| Đơn được xác nhận | 5/5 |
| p50 / p95 thời gian phục hồi | 4918ms / 4932ms |
| `reservedCount` tăng | +5 (đúng bằng số đơn) |
| `soldCount` tăng | +5 |
| Vé mỗi đơn | 1 |
| Vé trùng | 0 |

Kết luận: timeout chưa rõ kết quả trả `202` (không phải 503/500), đơn bền vững qua restart của Event, reconciler cấp vé đúng một lần, không lệch sức chứa.

Raw: [`order-fault.json`](./order-fault.json)

## 2. Event đã giữ chỗ nhưng response bị mất

Lệnh:

```bash
bun scripts/lost-response-experiment.ts > docs/evidence/lost-response.json
```

Script `docker pause event-service` trước khi bắn 8 đơn. Kernel vẫn nhận connection nên request nằm trong buffer; Admission timeout sau ~1s và trả `202`. Khi unpause, Event xử lý và commit reservation nhưng response đã bị bỏ. Reconciler replay cùng `operationId`.

| Chỉ số | Kết quả |
|---|---:|
| Đơn gửi | 8 |
| Nhận `202 PENDING_RECONCILIATION` | 8/8 |
| p50 / p95 latency lúc Event bị pause | 1078.2ms / 1078.2ms |
| Event healthy trở lại | 4ms |
| Đơn được xác nhận | 8/8 |
| p50 / p95 thời gian phục hồi | 2035ms / 2046ms |
| `reservedCount` tăng | +8 |
| `soldCount` tăng | +8 |
| Vé mỗi đơn | 1 |
| Vé trùng | 0 |

Kết luận: replay reservation theo `operationId` là idempotent; không giữ chỗ hai lần, không cấp vé hai lần dù response bị mất.

Raw: [`lost-response.json`](./lost-response.json)

## 3. Bổ sung: cô lập lỗi khi tắt Engagement / Admission

Lệnh và số liệu nằm trong `docs/TRONG_ENGAGEMENT_SERVICE_DEFENSE_GUIDE.md` (Câu 4). Tóm tắt:

| Kịch bản | `GET /api/tickets/my` | `POST /api/checkins` |
|---|---|---|
| Bình thường | 20/20 HTTP 200, p50 4.4ms / p95 9.5ms | 6/6 HTTP 400 (QR sai), p50 2.8ms / p95 4.4ms |
| Tắt Engagement | 20/20 HTTP 200, p50 3.4ms / p95 10.2ms | 6/6 HTTP 400, p50 2.1ms / p95 3.4ms |
| Tắt Admission | 20/20 HTTP 504 (timeout) / 503 (circuit OPEN), p50 1054ms / p95 2007.5ms | 6/6 HTTP 503, p95 0.6ms |

Raw: `fault-availability-baseline.json`, `fault-availability-engagement-down.json`, `fault-availability-admission-down.json`.

## Ghi chú

- Các số liệu là đo thật trên máy dev, không phải benchmark production.
- `order-fault.json` và `lost-response.json` là raw output của lần chạy tương ứng; seed và số đơn ghi trong từng file.
- Không dùng các script này trên môi trường có dữ liệu thật: chúng tạo user/order mới trong database demo.
