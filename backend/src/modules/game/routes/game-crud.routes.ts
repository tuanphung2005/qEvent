import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { getSessionLiveStatus, checkUserSessionAccess } from "../../realtime";
import { getGameLeaderboard } from "../services/scoring.service";
import { createGameBody, addQuestionBody } from "../schemas";

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
      const { title, description } = body;
      const game = await prisma.quizGame.create({
        data: {
          sessionId: params.sessionId,
          title: title.trim(),
          description: description?.trim(),
          status: "WAITING",
        },
      });

      set.status = 201;
      return { game };
    },
    {
      body: createGameBody,
    }
  )
  // Add a Question to a Quiz Game
  .post(
    "/:gameId/question",
    async ({ params, body, set }) => {
      const { question, timeLimitSec, points, options } = body;

      if (!options || options.length !== 4) {
        set.status = 400;
        return { error: "Mỗi câu hỏi cần đúng 4 phương án lựa chọn (Đỏ, Xanh dương, Vàng, Xanh lá)" };
      }

      const hasCorrect = options.some((o: any) => o.isCorrect);
      if (!hasCorrect) {
        set.status = 400;
        return { error: "Phải có ít nhất 1 đáp án đúng" };
      }

      const existingCount = await prisma.quizQuestion.count({
        where: { gameId: params.gameId },
      });

      const colors = ["RED", "BLUE", "YELLOW", "GREEN"] as const;

      const createdQuestion = await prisma.quizQuestion.create({
        data: {
          gameId: params.gameId,
          orderNum: existingCount,
          question: question.trim(),
          timeLimitSec: timeLimitSec || 20,
          points: points || 1000,
          options: {
            create: options.map((opt: any, idx: number) => ({
              text: opt.text.trim(),
              color: colors[idx % 4],
              isCorrect: Boolean(opt.isCorrect),
            })),
          },
        },
        include: { options: true },
      });

      set.status = 201;
      return { question: createdQuestion };
    },
    {
      body: addQuestionBody,
    }
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

    // Sanitization: If status is not ROUND_REVEALED or FINISHED, hide `isCorrect` from options to prevent client inspection
    const sanitizedQuestions = game.questions.map((q, idx) => {
      const isPastOrRevealed =
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
          isCorrect: isPastOrRevealed ? opt.isCorrect : undefined,
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
