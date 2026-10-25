# Bối cảnh, kiến trúc & cấu hình

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** cần biết vì sao có plan này, file nào bị sửa, cần env gì. Không cần đọc lại khi đang code một hướng cụ thể.

---

## Tổng quan kiến trúc

```
Google Gemini API (Gemini Developer API — key từ AI Studio)
        │
        ▼
backend/src/services/ai.service.ts                  ← NEW: client lazy + generateJson() + error taxonomy
        │
        ├── modules/realtime/services/qa-cluster.service.ts   (Hướng 1)
        │       └── routes/qa.routes.ts          ➕ POST /api/qa/cluster/:sessionId
        │       └── ws/qa.ws.ts                  ⛔ KHÔNG CẦN SỬA (xem ghi chú)
        │
        └── modules/ai/                                        (Hướng 2)
                ├── services/quiz-draft.service.ts  ← prompt + JSON Schema + validate
                └── routes/generate-quiz.routes.ts  ➕ POST /api/ai/generate-quiz
                        └── $transaction → INSERT QuizQuestion + QuizOption (bảng hiện có)
```

### Nguyên tắc thiết kế (bắt buộc)

1. **AI không bao giờ ghi thẳng vào DB.** LLM trả draft → backend validate → mới ghi.
2. **Không tin output LLM.** Mọi ID, số điểm, thời gian đều được kiểm tra lại hoặc tính ở server.
3. **Ghi DB phải nguyên tử.** Một `$transaction`, không có trạng thái nửa vời.
4. **Thiếu API key không được làm sập server.** Client khởi tạo lazy, endpoint trả `503`.
5. **Mọi endpoint AI phải phân quyền** (không chỉ "đã đăng nhập").
6. **Tính năng AI là additive**: tắt key là hệ thống cũ vẫn chạy đủ.

---

## Cấu trúc file thay đổi

```text
backend/
├── src/
│   ├── services/
│   │   └── ai.service.ts                       ← NEW  client lazy, generateJson, error types
│   ├── modules/
│   │   ├── ai/                                 ← NEW
│   │   │   ├── index.ts                        ← mount module
│   │   │   ├── schemas.ts                      ← generateQuizBody
│   │   │   ├── services/quiz-draft.service.ts  ← prompt + schema + validateQuizDraft
│   │   │   └── routes/generate-quiz.routes.ts  ← POST /api/ai/generate-quiz
│   │   ├── realtime/
│   │   │   ├── services/qa-cluster.service.ts  ← NEW  prompt + validateClusters + single-flight + transaction
│   │   │   ├── services/session-access.service.ts  ← MODIFY (append `MODERATOR_ROLES`, `HOST_ROLES`)
│   │   │   └── routes/qa.routes.ts             ← MODIFY (append endpoint)
│   │   └── game/
│   │       ├── services/access.service.ts      ← NEW  requireHost, transition, isUniqueViolation
│   │       ├── routes/game-crud.routes.ts      ← MODIFY (host preview + PATCH + guard tạo/thêm câu)
│   │       ├── routes/game-lifecycle.routes.ts ← MODIFY (auth + state machine + CAS)
│   │       ├── routes/answer.routes.ts         ← MODIFY (bỏ `body.userId`, server-side time)
│   │       ├── ws/game.ws.ts                   ← MODIFY (xoá SUBMIT_ANSWER, sửa JOIN_GAME)
│   │       └── schemas.ts                      ← MODIFY (min/max, bỏ `userId` khỏi answer)
│   └── index.ts                                ← MODIFY (+1 import, +1 .use, guard JWT_SECRET)
├── prisma/
│   └── schema.prisma                           ← MODIFY: +3 optional field, +1 index, +1 unique
└── test/
    ├── ai.validators.test.ts                   ← NEW  pure, không DB, không network
    ├── ai.cluster.test.ts                      ← NEW  DB + fake generator (inject)
    ├── game.test.ts                            ← MODIFY (thêm token organizer cho start/reveal/end)
    └── game.security.test.ts                   ← NEW  30 case auth/state machine/gian lận
```

---

## Phụ thuộc & cấu hình

```bash
cd backend
bun add @google/genai@2.31.0      # pin exact: SDK cảnh báo breaking change ở 3.0.0
```

> **Vì sao pin exact:** README của `@google/genai` nêu rõ 3.0.0 sẽ đổi hành vi (AFC, Node >= 22).
> Pin exact để demo/bảo vệ không bị vỡ vì `bun update`.

`.env` (và `.env.example` nếu thêm):

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-flash-latest
# Tuỳ chọn (mặc định đã hợp lý):
# GEMINI_TIMEOUT_MS=45000
# GEMINI_MAX_OUTPUT_TOKENS=16384
```

> ⚠️ **Không đặt số liệu free-tier vào thiết kế.** Google không công bố RPD cố định trong docs nữa
> (trang rate-limits hiện trỏ về dashboard AI Studio). Hạn mức thực tế thay đổi theo project/thời điểm.
> Xem số của bạn tại `aistudio.google.com/rate-limit` **trước khi** lên lịch demo,
> và luôn coi `429` là luồng bình thường (SDK đã retry — cấu hình ở
> [`03-clustering.md`](03-clustering.md) mục `ai.service.ts`).
> `gemini-2.5-flash` vẫn tồn tại nhưng đã cũ; dùng alias `gemini-flash-latest` hoặc tự đổi qua env.

---

[Mục lục](../AI_INTEGRATION.md) · [Schema →](02-schema.md)
