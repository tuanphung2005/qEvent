# Thay đổi Database Schema

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** chạy `db push` hoặc đụng `schema.prisma`. Bắt buộc đọc trước khi làm 03/04/05.

---

**a) HƯỚNG 1** — 3 field optional (không breaking, `db push` an toàn) + 1 index:

```prisma
model QAQuestion {
  // ... các field hiện có giữ nguyên ...
  clusterId    String?    // UUID nhóm, do server sinh (KHÔNG dùng representativeId)
  clusterLabel String?    // Nhãn <= 80 ký tự
  clusteredAt  DateTime?  // Thời điểm gom nhóm gần nhất (dùng cho cooldown + UI "kết quả cũ")

  @@index([sessionId, clusteredAt])
}
```

**b) HƯỚNG 3** — 1 unique constraint (chặn trùng `orderNum` ở tầng DB):

```prisma
model QuizQuestion {
  // ... các field hiện có giữ nguyên ...
  @@unique([gameId, orderNum])
}
```

> **Thứ tự bắt buộc:** chạy query kiểm tra trùng trong [`05c-hardening-ops.md`](05c-hardening-ops.md) §3.5 **trước** khi `db push`, nếu không push sẽ
> fail giữa đường. Unique index này là hàng rào cuối cho `orderNum = max + 1` (Sprint 0).

Chạy:

```bash
cd backend && bun x prisma db push && bun x prisma generate
```

> **Ghi chú thiết kế:** `clusterId` **không** phải FK. Nếu sau này cần lịch sử nhiều lần gom nhóm,
> chuyển sang model `QACluster` (id, sessionId, label, createdAt) + FK — đây là phần mở rộng,
> không cần cho MVP. Với MVP, `clusteredAt` đủ để biết kết quả cũ/mới.

---

[← Bối cảnh](01-context.md) · [Mục lục](../AI_INTEGRATION.md) · [Hướng 1 →](03-clustering.md)
