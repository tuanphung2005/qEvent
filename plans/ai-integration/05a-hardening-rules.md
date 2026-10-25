# Hướng 3a — Nguyên tắc, guard dùng chung, state machine

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** bắt đầu Sprint 0: route nào đang hở, guard `requireHost`, bảng chuyển trạng thái, CAS.

---

> **Vì sao nằm trong plan AI:** tính năng AI ghi câu hỏi vào `QuizGame` và hứa "host preview/sửa".
> Nếu `POST /:gameId/question`, `/start`, `/next` vẫn public thì mọi guard ở HƯỚNG 2 chỉ là hình thức.
> Đã grep toàn `backend/src`: **không có** `onBeforeHandle`, `.guard()`, hay middleware auth toàn cục.

## 3.0 Hiện trạng từng route

| Route | File:dòng | Hiện tại | Lỗ hổng | Mức |
|---|---|---|---|---|
| `POST /api/game/session/:sessionId` | `game-crud:62` | Khai báo `currentUser` nhưng **không dùng** | Ai cũng tạo game trong session bất kỳ | 🔴 |
| `GET /api/game/session/:sessionId` | `game-crud:34` | Public, chỉ đọc | Không lộ đáp án | 🟢 |
| `POST /api/game/:gameId/question` | `game-crud:83` | **Không** auth, **không** check status, cho ≥1 đáp án đúng, `orderNum = count` | Chèn câu vào game **đang chạy**; 2 đáp án đúng; trùng `orderNum` sau khi xoá | 🔴 |
| `GET /api/game/:gameId` | `game-crud:131` | Public; v2.1 đã sửa host preview | — | 🟢 |
| `PATCH /api/game/:gameId/question/:id` | mới (v2.1) | Host + `WAITING` | — | 🟢 |
| `POST /api/game/:gameId/start` | `lifecycle:33` | **Không** auth, **không** check status | Start lại game `FINISHED` → chạy lại từ câu 0, reset `questionStartedAt`, mất mốc thời gian của đáp án cũ | 🔴 |
| `POST /api/game/:gameId/next` | `lifecycle:87` | **Không** auth, **không** check status | Gọi khi `WAITING` → `nextIndex = 0` ⇒ start lậu, bỏ qua `/start` | 🔴 |
| `POST /api/game/:gameId/reveal` | `lifecycle:147` | **Không** auth, **không** check status | Gọi khi `FINISHED` → đổi về `ROUND_REVEALED` (**hồi sinh game đã kết thúc**) | 🔴 |
| `POST /api/game/:gameId/end` | `lifecycle:206` | **Không** auth; `update` game không tồn tại → `P2025` → **500** | Ai cũng kết thúc game; id sai gây 500 | 🔴 |
| `POST /api/game/:gameId/answer` | `answer:35` | Auth **nhưng** fallback `currentUser?.id \|\| body.userId`; nhận `responseTimeMs` từ client; **không** check câu hiện tại | Giả danh người khác; trả lời **câu tương lai** trước; gửi `responseTimeMs: 0` để ăn điểm tối đa | 🔴 |
| `GET /api/game/:gameId/leaderboard` | `answer:156` | Public | Chỉ tên + điểm, không email | 🟢 |
| `GET /api/game/:gameId/endscreen` | `answer:161` | Public | `userResult` chỉ khi có token | 🟢 |
| `WS /ws/game` `JOIN_GAME` | `game.ws:45` | Không auth; subscribe **trước** khi kiểm tra game tồn tại | Đọc state game bất kỳ (spectator hợp lệ, nhưng game rác vẫn được subscribe) | 🟡 |
| `WS /ws/game` `SUBMIT_ANSWER` | `game.ws:102` | `userId` lấy từ **message**; `responseTimeMs` từ message; không check câu hiện tại | Giả danh + gian lận điểm, y hệt REST | 🔴 |

## 3.1 Nguyên tắc

1. Mọi route **ghi** phải có `currentUser` + role. Không có ngoại lệ "route phụ".
2. `401` chưa đăng nhập · `403` sai role · `404` không tồn tại · `409` sai trạng thái/đụng độ.
3. Mọi chuyển trạng thái dùng **compare-and-set** (`updateMany` có `where.status`) — hai host bấm
   cùng lúc thì đúng một request thắng, request kia `409`, không ghi đè.
4. **Không tin số đo từ client** (`responseTimeMs`). Server tính từ `questionStartedAt`.
5. **Không tin `userId` gửi kèm** body/message. Luôn lấy từ JWT.
6. Chỉ trả lời **câu đang active** (`currentQuestionIndex`), không phải câu bất kỳ của game.

## 3.2 Guard dùng chung

`backend/src/modules/game/services/access.service.ts` — **NEW**:

```typescript
import type { QuizGameStatus } from "@prisma/client";
import { prisma } from "../../../plugins/prisma";
import { checkUserSessionAccess, HOST_ROLES } from "../../realtime";

export type GuardFail = {
  ok: false;
  status: 401 | 403 | 404 | 409;
  error: string;
  message?: string;
};

export type GameRef = {
  id: string;
  sessionId: string;
  status: QuizGameStatus;
  currentQuestionIndex: number;
};

/** 401 → 404 → 403 → 409. Thứ tự này cố định, đừng đảo. */
export async function requireHost(
  gameId: string,
  userId: string | null | undefined,
  opts: { statuses?: QuizGameStatus[] } = {}
): Promise<{ ok: true; game: GameRef } | GuardFail> {
  if (!userId) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const game = await prisma.quizGame.findUnique({
    where: { id: gameId },
    select: { id: true, sessionId: true, status: true, currentQuestionIndex: true },
  });
  if (!game) return { ok: false, status: 404, error: "GAME_NOT_FOUND" };

  // Hạn chế đã biết: role toàn cục, không gắn theo event (xem 05c §3.10)
  const access = await checkUserSessionAccess(game.sessionId, userId);
  if (!HOST_ROLES.includes(access.role)) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  if (opts.statuses && !opts.statuses.includes(game.status)) {
    return {
      ok: false,
      status: 409,
      error: "INVALID_GAME_STATE",
      message: `Game đang ${game.status}`,
    };
  }

  return { ok: true, game };
}

/** Như requireHost nhưng cho route tạo game (chưa có gameId). */
export async function requireSessionHost(
  sessionId: string,
  userId: string | null | undefined
): Promise<{ ok: true; sessionId: string } | GuardFail> {
  if (!userId) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { ok: false, status: 404, error: "SESSION_NOT_FOUND" };

  const access = await checkUserSessionAccess(sessionId, userId);
  if (!HOST_ROLES.includes(access.role)) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true, sessionId: session.id };
}

/** Compare-and-set: chỉ đổi nếu trạng thái (và index) vẫn đúng như đã đọc. */
export async function transition(
  gameId: string,
  where: { status: QuizGameStatus[]; currentQuestionIndex?: number },
  data: { status: QuizGameStatus; currentQuestionIndex?: number }
): Promise<boolean> {
  const res = await prisma.quizGame.updateMany({
    where: {
      id: gameId,
      status: { in: where.status },
      ...(where.currentQuestionIndex !== undefined && {
        currentQuestionIndex: where.currentQuestionIndex,
      }),
    },
    data,
  });
  return res.count === 1;
}

/** Prisma P2002 (unique) — dùng chung cho orderNum và answer trùng. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}
```

Mẫu dùng (lặp y hệt ở mọi route, không tự chế biến thể):

```typescript
const guard = await requireHost(params.gameId, currentUser?.id, { statuses: ["WAITING"] });
if (!guard.ok) {
  set.status = guard.status;
  return { error: guard.error, message: guard.message };
}
const game = guard.game; // đã có id/sessionId/status/currentQuestionIndex
```

## 3.3 State machine

```
WAITING ──start──▶ QUESTION_ACTIVE ──reveal──▶ ROUND_REVEALED ──next──▶ QUESTION_ACTIVE
   │                     │                          │
   └─────────end─────────┴──────────end─────────────┴──────────────▶ FINISHED
```

| Từ | Hành động | Route | Điều kiện phụ | Đích |
|---|---|---|---|---|
| `WAITING` | start | `POST /:id/start` | ≥1 câu hỏi | `QUESTION_ACTIVE`, index 0 |
| `WAITING` | end (huỷ game) | `POST /:id/end` | — | `FINISHED` |
| `WAITING` | next / reveal | — | — | `409 INVALID_GAME_STATE` |
| `QUESTION_ACTIVE` | reveal | `POST /:id/reveal` | — | `ROUND_REVEALED` |
| `QUESTION_ACTIVE` | next | — | — | `409` (phải reveal trước — đúng flow Kahoot) |
| `QUESTION_ACTIVE` | end | `POST /:id/end` | — | `FINISHED` (kết thúc sớm) |
| `ROUND_REVEALED` | next | `POST /:id/next` | còn câu | `QUESTION_ACTIVE`, index + 1 |
| `ROUND_REVEALED` | reveal | — | — | `409` (đã reveal rồi) |
| `ROUND_REVEALED` | end | `POST /:id/end` | — | `FINISHED` |
| `FINISHED` | * | — | — | `409` |

> `QuizGameStatus.ACTIVE` tồn tại trong enum nhưng **không được dùng ở đâu** (grep `"ACTIVE"`: 0 match).
> Để nguyên — xoá enum value bằng `db push` là thao tác có rủi ro, không đáng.

---

[← Hướng 2](04-quiz-generator.md) · [Mục lục](../AI_INTEGRATION.md) · [3b Routes →](05b-hardening-routes.md)
