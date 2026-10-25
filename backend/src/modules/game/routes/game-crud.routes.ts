import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { getSessionLiveStatus, checkUserSessionAccess, HOST_ROLES } from "../../realtime";
import { getGameLeaderboard } from "../services/scoring.service";
import { createGameBody, addQuestionBody } from "../schemas";
import { requireHost, requireSessionHost, isUniqueViolation } from "../services/access.service";

export const gameCrudRoutes = new Elysia()
  .use(
    jwt({
      name: "jwtAuth",
      secret: process.env.JWT_SECRET || "qevent_super_secret_jwt_key_2026_production_grade",
    })
  )
  .derive(async ({ headers, jwtAuth }) => {
    const authHeader = headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return { currentUser: null };
    }
    const token = authHeader.slice(7);
    const payload = await jwtAuth.verify(token);
    if (!payload || typeof payload !== "object" || !("id" in payload)) {
      return { currentUser: null };
    }
    return {
      currentUser: {
        id: payload.id as string,
        email: payload.email as string,
        role: payload.role as string,
      },
    };
  })
  // List games for a session
  .get("/session/:sessionId", async ({ params, currentUser }) => {
    const { session, isLive } = await getSessionLiveStatus(params.sessionId);
    const access = await checkUserSessionAccess(params.sessionId, currentUser?.id);

    const games = await prisma.quizGame.findMany({
      where: { sessionId: params.sessionId },
      include: {
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      sessionId: session.id,
      sessionTitle: session.title,
      isLive,
      canPlay: isLive && access.isCheckedIn,
      games: games.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        status: g.status,
        questionCount: g._count.questions,
        currentQuestionIndex: g.currentQuestionIndex,
      })),
    };
  })
  // Create a new Quiz Game (Host / Organizer)
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
  // Add a Question to a Quiz Game
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

      const colors = ["RED", "BLUE", "YELLOW", "GREEN"] as const;

      try {
        const createdQuestion = await prisma.$transaction(async (tx) => {
          // Khoá hàng game + CAS: nếu /start vừa commit thì không ghi câu vào ván đã chạy.
          const claim = await tx.quizGame.updateMany({
            where: { id: guard.game.id, status: "WAITING" },
            data: { status: "WAITING" },
          });
          if (claim.count !== 1) return null;

          // max + 1, không dùng count (count sai ngay khi có câu bị xoá)
          const agg = await tx.quizQuestion.aggregate({
            where: { gameId: guard.game.id },
            _max: { orderNum: true },
          });

          return tx.quizQuestion.create({
            data: {
              gameId: guard.game.id,
              orderNum: (agg._max.orderNum ?? -1) + 1,
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
        });

        if (!createdQuestion) {
          set.status = 409;
          return { error: "GAME_STATE_CHANGED", message: "Game vừa bắt đầu — không thêm câu hỏi" };
        }

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
  // Host: edit a question before the game starts
  .patch(
    "/:gameId/question/:questionId",
    async ({ params, body, currentUser, set }) => {
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

      if (body.options.length !== 4) {
        set.status = 400;
        return { error: "INVALID_OPTIONS", message: "Mỗi câu hỏi cần đúng 4 phương án" };
      }
      if (body.options.filter((o) => o.isCorrect).length !== 1) {
        set.status = 400;
        return { error: "INVALID_OPTIONS", message: "Phải có đúng 1 đáp án đúng" };
      }
      const texts = body.options.map((o) => o.text.trim().toLowerCase());
      if (new Set(texts).size !== 4) {
        set.status = 400;
        return { error: "INVALID_OPTIONS", message: "4 đáp án phải khác nhau" };
      }

      const colors = ["RED", "BLUE", "YELLOW", "GREEN"] as const;

      const updated = await prisma.$transaction(async (tx) => {
        // Khoá hàng game + CAS: không sửa câu khi ván đã bắt đầu.
        const claim = await tx.quizGame.updateMany({
          where: { id: guard.game.id, status: "WAITING" },
          data: { status: "WAITING" },
        });
        if (claim.count !== 1) return { refused: "GAME_STATE_CHANGED" as const };

        // Xoá option sẽ cascade xoá QuizAnswer → chặn nếu đã có câu trả lời.
        const answers = await tx.quizAnswer.count({ where: { questionId: params.questionId } });
        if (answers > 0) return { refused: "QUESTION_HAS_ANSWERS" as const };

        await tx.quizOption.deleteMany({ where: { questionId: params.questionId } });
        const question = await tx.quizQuestion.update({
          where: { id: params.questionId },
          data: {
            question: body.question.trim(),
            ...(body.timeLimitSec !== undefined && { timeLimitSec: body.timeLimitSec }),
            ...(body.points !== undefined && { points: body.points }),
            options: {
              create: body.options.map((opt, idx) => ({
                text: opt.text.trim(),
                color: colors[idx % 4],
                isCorrect: opt.isCorrect,
              })),
            },
          },
          include: { options: true },
        });
        return { question };
      });

      if ("refused" in updated) {
        set.status = 409;
        return {
          error: updated.refused,
          message:
            updated.refused === "QUESTION_HAS_ANSWERS"
              ? "Câu hỏi đã có người trả lời — không sửa được"
              : "Game vừa bắt đầu — không sửa được câu hỏi",
        };
      }

      return { question: updated.question };
    },
    { body: addQuestionBody }
  )
  // Get game details & current active question state
  .get("/:gameId", async ({ params, currentUser, set }) => {
    const game = await prisma.quizGame.findUnique({
      where: { id: params.gameId },
      include: {
        session: true,
        questions: {
          orderBy: { orderNum: "asc" },
          include: {
            options: true,
          },
        },
      },
    });

    if (!game) {
      set.status = 404;
      return { error: "Game not found" };
    }

    const { isLive } = await getSessionLiveStatus(game.sessionId);
    const access = await checkUserSessionAccess(game.sessionId, currentUser?.id);
    const isHost = HOST_ROLES.includes(access.role); // ORGANIZER | SPEAKER (STAFF không có)

    const sanitizedQuestions = game.questions.map((q, idx) => {
      const revealedForPlayer =
        game.status === "FINISHED" ||
        (game.status === "ROUND_REVEALED" && idx === game.currentQuestionIndex) ||
        idx < game.currentQuestionIndex;

      return {
        id: q.id,
        orderNum: q.orderNum,
        question: q.question,
        timeLimitSec: q.timeLimitSec,
        points: q.points,
        questionStartedAt: q.questionStartedAt,
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          color: opt.color,
          // host luôn thấy; người chơi chỉ thấy khi đã tới lúc reveal
          isCorrect: isHost || revealedForPlayer ? opt.isCorrect : undefined,
        })),
      };
    });

    // Check if user already answered current question
    let userAnswer = null;
    if (currentUser?.id && game.currentQuestionIndex >= 0 && game.questions[game.currentQuestionIndex]) {
      const currentQ = game.questions[game.currentQuestionIndex];
      userAnswer = await prisma.quizAnswer.findUnique({
        where: {
          questionId_userId: {
            questionId: currentQ.id,
            userId: currentUser.id,
          },
        },
      });
    }

    const currentQuestion =
      game.currentQuestionIndex >= 0 && sanitizedQuestions[game.currentQuestionIndex]
        ? sanitizedQuestions[game.currentQuestionIndex]
        : null;

    const leaderboard = await getGameLeaderboard(game.id, 10);
    const podium = leaderboard.slice(0, 3);

    return {
      id: game.id,
      sessionId: game.sessionId,
      title: game.title,
      description: game.description,
      status: game.status,
      currentQuestionIndex: game.currentQuestionIndex,
      totalQuestions: game.questions.length,
      currentQuestion,
      // Chỉ host cần danh sách đầy đủ để preview/sửa; player giữ nguyên response cũ.
      ...(isHost ? { questions: sanitizedQuestions } : {}),
      isLive,
      userAccess: {
        isCheckedIn: access.isCheckedIn,
        canPlay: isLive && access.isCheckedIn,
      },
      hasAnsweredCurrent: Boolean(userAnswer),
      userAnswer: userAnswer
        ? {
            optionId: userAnswer.optionId,
            isCorrect: game.status === "ROUND_REVEALED" || game.status === "FINISHED" ? userAnswer.isCorrect : undefined,
            scoreAwarded: game.status === "ROUND_REVEALED" || game.status === "FINISHED" ? userAnswer.scoreAwarded : undefined,
          }
        : null,
      leaderboard,
      podium,
    };
  });
