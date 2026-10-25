# Hướng 3b — Code từng route (tham chiếu)

> **Thuộc:** [AI Integration Plan v2.2](../AI_INTEGRATION.md)
> **Đọc khi:** đang viết handler cụ thể. Cần đọc 05a trước để hiểu `requireHost` và `transition`.

---

## 3.4 Code từng route

### 3.4.1 `POST /session/:sessionId` — tạo game

```typescript
  .post(
    "/session/:sessionId",
    async ({ params, body, currentUser, set }) => {
      const guard = await requireSessionHost(params.sessionId, currentUser?.id);
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error, message: guard.message };
      }

      const { title, description } = body;
      const game = await prisma.quizGame.create({
        data: {
          sessionId: guard.sessionId,
          title: title.trim(),
          description: description?.trim(),
          status: "WAITING",
        },
      });

      set.status = 201;
      return { game };
    },
    { body: createGameBody }
  )
```

### 3.4.2 `POST /:gameId/question` — thêm câu

Đây là bản **đầy đủ** thay thế handler `:83-129` (đã gồm guard của [`04-quiz-generator.md`](04-quiz-generator.md) §3):

```typescript
  .post(
    "/:gameId/question",
    async ({ params, body, currentUser, set }) => {
      const guard = await requireHost(params.gameId, currentUser?.id, { statuses: ["WAITING"] });
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error, message: guard.message };
      }

      const { question, timeLimitSec, points, options } = body;

      // Schema đã ép 4 phần tử; đây là chốt thứ hai cho client cũ/gọi trực tiếp.
      if (options.length !== 4) {
        set.status = 400;
        return { error: "INVALID_OPTIONS", message: "Cần đúng 4 phương án" };
      }
      if (options.filter((o) => o.isCorrect).length !== 1) {
        set.status = 400;
        return { error: "INVALID_OPTIONS", message: "Phải có đúng 1 đáp án đúng" };
      }
      const texts = options.map((o) => o.text.trim().toLowerCase());
      if (new Set(texts).size !== 4) {
        set.status = 400;
        return { error: "INVALID_OPTIONS", message: "4 đáp án phải khác nhau" };
      }

      // max + 1, không dùng count (count sai ngay khi có câu bị xoá)
      const agg = await prisma.quizQuestion.aggregate({
        where: { gameId: guard.game.id },
        _max: { orderNum: true },
      });
      const orderNum = (agg._max.orderNum ?? -1) + 1;

      const colors = ["RED", "BLUE", "YELLOW", "GREEN"] as const;

      try {
        const createdQuestion = await prisma.quizQuestion.create({
          data: {
            gameId: guard.game.id,
            orderNum,
            question: question.trim(),
            timeLimitSec: timeLimitSec ?? 20,
            points: points ?? 1000,
            options: {
              create: options.map((opt, idx) => ({
                text: opt.text.trim(),
                color: colors[idx % 4],
                isCorrect: opt.isCorrect,
              })),
            },
          },
          include: { options: true },
        });

        set.status = 201;
        return { question: createdQuestion };
      } catch (err) {
        // 2 request đồng thời lấy cùng orderNum → unique (gameId, orderNum) chặn
        if (isUniqueViolation(err)) {
          set.status = 409;
          return { error: "ORDER_CONFLICT", message: "Câu hỏi vừa được thêm, thử lại" };
        }
        throw err;
      }
    },
    { body: addQuestionBody }
  )
```

### 3.4.3 `PATCH /:gameId/question/:questionId`

Giữ như bản ở [`04-quiz-generator.md`](04-quiz-generator.md) mục 2, nhưng thay khối lấy game + role
bằng `requireHost` (bớt 12 dòng trùng):

```typescript
      const guard = await requireHost(params.gameId, currentUser?.id, { statuses: ["WAITING"] });
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error, message: guard.message };
      }

      const existing = await prisma.quizQuestion.findFirst({
        where: { id: params.questionId, gameId: guard.game.id },
        select: { id: true },
      });
      if (!existing) {
        set.status = 404;
        return { error: "QUESTION_NOT_FOUND" };
      }
      // ... (validate 4 options / 1 đúng / khác nhau + transaction deleteMany+create như 04 mục 2)
```

### 3.4.4 `POST /:gameId/start`

```typescript
  .post("/:gameId/start", async ({ params, currentUser, set }) => {
    const guard = await requireHost(params.gameId, currentUser?.id, { statuses: ["WAITING"] });
    if (!guard.ok) {
      set.status = guard.status;
      return { error: guard.error, message: guard.message };
    }

    const game = await prisma.quizGame.findUnique({
      where: { id: guard.game.id },
      include: {
        questions: { orderBy: { orderNum: "asc" }, include: { options: true } },
      },
    });
    if (!game || game.questions.length === 0) {
      set.status = 422;
      return { error: "NO_QUESTIONS", message: "Trò chơi chưa có câu hỏi nào để bắt đầu" };
    }

    const now = new Date();
    const firstQ = game.questions[0]!;

    // 1 transaction: đổi trạng thái (CAS) + đóng dấu giờ câu 0. Không có cửa sổ nửa vời.
    const started = await prisma.$transaction(async (tx) => {
      const res = await tx.quizGame.updateMany({
        where: { id: game.id, status: "WAITING" },
        data: { status: "QUESTION_ACTIVE", currentQuestionIndex: 0 },
      });
      if (res.count !== 1) return false;

      await tx.quizQuestion.update({
        where: { id: firstQ.id },
        data: { questionStartedAt: now },
      });
      return true;
    });

    if (!started) {
      set.status = 409;
      return { error: "GAME_STATE_CHANGED", message: "Game vừa được start bởi request khác" };
    }

    const updatedGame = await prisma.quizGame.findUniqueOrThrow({ where: { id: game.id } });

    const broadcastPayload = {
      type: "QUESTION_ACTIVE",
      gameId: game.id,
      questionIndex: 0,
      totalQuestions: game.questions.length,
      question: {
        id: firstQ.id,
        question: firstQ.question,
        timeLimitSec: firstQ.timeLimitSec,
        points: firstQ.points,
        questionStartedAt: now.toISOString(),
        options: firstQ.options.map((o) => ({ id: o.id, text: o.text, color: o.color })),
      },
    };

    broadcastToGame(game.id, broadcastPayload);
    return { game: updatedGame, currentQuestion: broadcastPayload.question };
  })
```

### 3.4.5 `POST /:gameId/next`

```typescript
  .post("/:gameId/next", async ({ params, currentUser, set }) => {
    const guard = await requireHost(params.gameId, currentUser?.id, {
      statuses: ["ROUND_REVEALED"],
    });
    if (!guard.ok) {
      set.status = guard.status;
      return { error: guard.error, message: guard.message };
    }

    const game = await prisma.quizGame.findUnique({
      where: { id: guard.game.id },
      include: {
        questions: { orderBy: { orderNum: "asc" }, include: { options: true } },
      },
    });
    if (!game) {
      set.status = 404;
      return { error: "GAME_NOT_FOUND" };
    }

    const nextIndex = game.currentQuestionIndex + 1;
    if (nextIndex >= game.questions.length) {
      set.status = 409;
      return {
        error: "NO_MORE_QUESTIONS",
        message: "Đã hết câu hỏi. Gọi /end để kết thúc.",
      };
    }

    const now = new Date();
    const nextQ = game.questions[nextIndex]!;

    const moved = await prisma.$transaction(async (tx) => {
      const res = await tx.quizGame.updateMany({
        where: {
          id: game.id,
          status: "ROUND_REVEALED",
          currentQuestionIndex: game.currentQuestionIndex, // CAS cả index
        },
        data: { status: "QUESTION_ACTIVE", currentQuestionIndex: nextIndex },
      });
      if (res.count !== 1) return false;

      await tx.quizQuestion.update({
        where: { id: nextQ.id },
        data: { questionStartedAt: now },
      });
      return true;
    });

    if (!moved) {
      set.status = 409;
      return { error: "GAME_STATE_CHANGED", message: "Game vừa đổi trạng thái bởi request khác" };
    }

    const updatedGame = await prisma.quizGame.findUniqueOrThrow({ where: { id: game.id } });

    const broadcastPayload = {
      type: "QUESTION_ACTIVE",
      gameId: game.id,
      questionIndex: nextIndex,
      totalQuestions: game.questions.length,
      question: {
        id: nextQ.id,
        question: nextQ.question,
        timeLimitSec: nextQ.timeLimitSec,
        points: nextQ.points,
        questionStartedAt: now.toISOString(),
        options: nextQ.options.map((o) => ({ id: o.id, text: o.text, color: o.color })),
      },
    };

    broadcastToGame(game.id, broadcastPayload);
    return { game: updatedGame, currentQuestion: broadcastPayload.question };
  })
```

### 3.4.6 `POST /:gameId/reveal`

```typescript
  .post("/:gameId/reveal", async ({ params, currentUser, set }) => {
    const guard = await requireHost(params.gameId, currentUser?.id, {
      statuses: ["QUESTION_ACTIVE"],
    });
    if (!guard.ok) {
      set.status = guard.status;
      return { error: guard.error, message: guard.message };
    }

    const game = await prisma.quizGame.findUnique({
      where: { id: guard.game.id },
      include: {
        questions: {
          orderBy: { orderNum: "asc" },
          include: { options: true, answers: true },
        },
      },
    });
    const currentQ = game?.questions[game.currentQuestionIndex];
    if (!game || !currentQ) {
      set.status = 409;
      return { error: "NO_ACTIVE_QUESTION" };
    }

    const revealed = await transition(
      game.id,
      { status: ["QUESTION_ACTIVE"], currentQuestionIndex: game.currentQuestionIndex },
      { status: "ROUND_REVEALED" }
    );
    if (!revealed) {
      set.status = 409;
      return { error: "GAME_STATE_CHANGED", message: "Game vừa đổi trạng thái bởi request khác" };
    }

    const updatedGame = await prisma.quizGame.findUniqueOrThrow({ where: { id: game.id } });

    const answerCounts: Record<string, number> = {};
    for (const opt of currentQ.options) answerCounts[opt.id] = 0;
    for (const ans of currentQ.answers) {
      if (answerCounts[ans.optionId] !== undefined) answerCounts[ans.optionId]!++;
    }

    const correctOption = currentQ.options.find((o) => o.isCorrect);
    const leaderboard = await getGameLeaderboard(game.id, 10);

    const broadcastPayload = {
      type: "ROUND_REVEALED",
      gameId: game.id,
      questionIndex: game.currentQuestionIndex,
      correctOptionId: correctOption?.id,
      correctOptionText: correctOption?.text,
      answerStats: currentQ.options.map((o) => ({
        optionId: o.id,
        text: o.text,
        color: o.color,
        isCorrect: o.isCorrect,
        count: answerCounts[o.id] ?? 0,
      })),
      leaderboard,
    };

    broadcastToGame(game.id, broadcastPayload);
    return { game: updatedGame, reveal: broadcastPayload };
  })
```

### 3.4.7 `POST /:gameId/end`

```typescript
  .post("/:gameId/end", async ({ params, currentUser, set }) => {
    const guard = await requireHost(params.gameId, currentUser?.id, {
      statuses: ["WAITING", "QUESTION_ACTIVE", "ROUND_REVEALED"],
    });
    if (!guard.ok) {
      set.status = guard.status;
      return { error: guard.error, message: guard.message };
    }

    const ended = await transition(
      guard.game.id,
      { status: ["WAITING", "QUESTION_ACTIVE", "ROUND_REVEALED"] },
      { status: "FINISHED" }
    );
    if (!ended) {
      set.status = 409;
      return { error: "GAME_STATE_CHANGED", message: "Game đã kết thúc bởi request khác" };
    }

    const updatedGame = await prisma.quizGame.findUniqueOrThrow({ where: { id: guard.game.id } });
    const finalLeaderboard = await getGameLeaderboard(guard.game.id, 50);

    const broadcastPayload = {
      type: "GAME_FINISHED",
      gameId: guard.game.id,
      podium: finalLeaderboard.slice(0, 3),
      leaderboard: finalLeaderboard,
    };

    broadcastToGame(guard.game.id, broadcastPayload);
    return { game: updatedGame, results: broadcastPayload };
  })
```

### 3.4.8 `POST /:gameId/answer` — chống gian lận

Ba thay đổi so với bản cũ:

1. Bỏ `currentUser?.id || body.userId` → **chỉ** `currentUser.id`.
2. `responseTimeMs` do **server** tính từ `questionStartedAt`, bỏ qua giá trị client.
3. Chỉ nhận đáp án cho **câu đang active**, và từ chối nếu đã quá `timeLimitSec + 2s`.

```typescript
const ANSWER_GRACE_MS = 2_000; // dung sai mạng; client không điều khiển được

  .post(
    "/:gameId/answer",
    async ({ params, body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "UNAUTHORIZED", message: "Vui lòng đăng nhập để tham gia trò chơi" };
      }

      const { questionId, optionId } = body;

      const game = await prisma.quizGame.findUnique({
        where: { id: params.gameId },
        include: { session: true },
      });
      if (!game) {
        set.status = 404;
        return { error: "GAME_NOT_FOUND" };
      }

      const { isLive } = await getSessionLiveStatus(game.sessionId);
      if (!isLive) {
        set.status = 403;
        return { error: "EVENT_NOT_LIVE", message: "Trò chơi chỉ mở trong thời gian sự kiện diễn ra" };
      }

      const access = await checkUserSessionAccess(game.sessionId, currentUser.id);
      if (!access.isCheckedIn) {
        set.status = 403;
        return { error: "NOT_CHECKED_IN", message: "Bạn cần điểm danh tại cổng để tham gia trò chơi" };
      }

      if (game.status !== "QUESTION_ACTIVE") {
        set.status = 400;
        return { error: "ANSWER_WINDOW_CLOSED", message: "Câu hỏi hiện tại đã hết thời gian trả lời" };
      }

      // Câu đang active = phần tử thứ currentQuestionIndex trong thứ tự orderNum
      const [currentQ] = await prisma.quizQuestion.findMany({
        where: { gameId: game.id },
        orderBy: { orderNum: "asc" },
        skip: Math.max(game.currentQuestionIndex, 0),
        take: 1,
        include: { options: true },
      });

      if (!currentQ || currentQ.id !== questionId) {
        set.status = 400;
        return { error: "NOT_CURRENT_QUESTION", message: "Chỉ trả lời được câu đang hiển thị" };
      }
      if (!currentQ.questionStartedAt) {
        set.status = 409;
        return { error: "QUESTION_NOT_STARTED" };
      }

      const limitMs = currentQ.timeLimitSec * 1000;
      const elapsedMs = Date.now() - currentQ.questionStartedAt.getTime();
      if (elapsedMs > limitMs + ANSWER_GRACE_MS) {
        set.status = 400;
        return { error: "ANSWER_TOO_LATE", message: "Đã quá thời gian trả lời" };
      }

      // Server quyết định thời gian; client không gửi được số này nữa
      const responseTimeMs = Math.min(Math.max(elapsedMs, 0), limitMs);

      const selectedOption = currentQ.options.find((o) => o.id === optionId);
      if (!selectedOption) {
        set.status = 400;
        return { error: "INVALID_OPTION" };
      }

      const isCorrect = selectedOption.isCorrect;
      const scoreAwarded = calculateQuizScore(
        isCorrect,
        responseTimeMs,
        currentQ.timeLimitSec,
        currentQ.points
      );

      try {
        const answer = await prisma.quizAnswer.create({
          data: {
            gameId: game.id,
            questionId: currentQ.id,
            optionId,
            userId: currentUser.id, // luôn từ JWT
            isCorrect,
            responseTimeMs,
            scoreAwarded,
          },
        });

        const totalAnswersCount = await prisma.quizAnswer.count({
          where: { questionId: currentQ.id },
        });
        broadcastToGame(game.id, {
          type: "ANSWER_COUNT_UPDATED",
          gameId: game.id,
          questionId: currentQ.id,
          totalAnswersCount,
        });

        return {
          message: "Câu trả lời đã được ghi nhận",
          answerId: answer.id,
          responseTimeMs,
          submitted: true,
        };
      } catch (err) {
        if (isUniqueViolation(err)) {
          set.status = 409;
          return { error: "ALREADY_ANSWERED", message: "Bạn đã gửi câu trả lời cho câu hỏi này rồi" };
        }
        throw err;
      }
    },
    { body: submitAnswerBody }
  )
```

> Bỏ luôn `findUnique(questionId_userId)` pre-check: `create` + catch `P2002` là một query thay vì hai,
> và không có khe race giữa check và insert.

### 3.4.9 `WS /ws/game`

Hai sửa đổi:

**a) `SUBMIT_ANSWER`: xoá hẳn.** Nó là bản sao của REST nhưng **không** check câu hiện tại, **không**
check thời gian, và lấy `userId` từ message. Giữ hai đường ghi là giữ hai lỗ hổng. Client dùng
`POST /:gameId/answer` (đã có sẵn, đã được bảo vệ). Frontend hiện không có trong repo → không phá gì.

> Xoá nhánh này kéo theo 2 import không còn dùng trong `game.ws.ts`: `calculateQuizScore` và
> `checkUserSessionAccess`. `getGameLeaderboard` **vẫn dùng** cho `GAME_STATE`.

**b) `JOIN_GAME`: kiểm tra game trước khi subscribe**, không dùng `data.userId`:

```typescript
          case "JOIN_GAME": {
            const { gameId } = data;

            const game = await prisma.quizGame.findUnique({
              where: { id: gameId },
              include: {
                questions: { orderBy: { orderNum: "asc" }, include: { options: true } },
              },
            });

            if (!game) {
              ws.send(JSON.stringify({ type: "GAME_NOT_FOUND", gameId }));
              break;
            }

            if ((ws.data as any).currentGameId) {
              gameSubscribers.get((ws.data as any).currentGameId)?.delete(ws);
            }
            (ws.data as any).currentGameId = gameId;
            if (!gameSubscribers.has(gameId)) gameSubscribers.set(gameId, new Set());
            gameSubscribers.get(gameId)!.add(ws);

            // ... gửi GAME_STATE như cũ (giữ nguyên mask isCorrect khi chưa reveal)
            break;
          }
```

> `JOIN_GAME` **không** bắt buộc đăng nhập: người xem trên projector cũng join được. Nó chỉ đọc, và
> `isCorrect` vẫn bị mask trừ khi `ROUND_REVEALED`. Nếu sau này cần chặn spectator → thêm
> `checkUserSessionAccess`, nhưng đó là yêu cầu sản phẩm, không phải lỗ hổng.

---

[← 3a Nguyên tắc](05a-hardening-rules.md) · [Mục lục](../AI_INTEGRATION.md) · [3c Vận hành →](05c-hardening-ops.md)
