import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { getSessionLiveStatus, checkUserSessionAccess } from "../../realtime";
import { broadcastToGame } from "../services/broadcast.service";
import { calculateQuizScore, getGameLeaderboard } from "../services/scoring.service";
import { isUniqueViolation } from "../services/access.service";
import { submitAnswerBody } from "../schemas";

const ANSWER_GRACE_MS = 2_000; // dung sai mạng; client không điều khiển được

export const answerRoutes = new Elysia()
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
  // Attendee: Submit Answer (Gated: Live Event & Checked-in)
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
        return {
          error: "EVENT_NOT_LIVE",
          message: "Trò chơi chỉ mở trong thời gian sự kiện diễn ra",
        };
      }

      const access = await checkUserSessionAccess(game.sessionId, currentUser.id);
      if (!access.isCheckedIn) {
        set.status = 403;
        return {
          error: "NOT_CHECKED_IN",
          message: "Bạn cần điểm danh tại cổng để tham gia trò chơi",
        };
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

      // CAS: chỉ ghi nếu ván vẫn QUESTION_ACTIVE và đúng index câu hỏi.
      let written: any;
      try {
        written = await prisma.$transaction(async (tx) => {
          const res = await tx.quizGame.updateMany({
            where: {
              id: game.id,
              status: "QUESTION_ACTIVE",
              currentQuestionIndex: game.currentQuestionIndex,
            },
            data: { updatedAt: new Date() },
          });
          if (res.count !== 1) return null;

          return tx.quizAnswer.create({
            data: {
              gameId: game.id,
              questionId: currentQ.id,
              optionId,
              userId: currentUser.id,
              isCorrect,
              responseTimeMs,
              scoreAwarded,
            },
          });
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          set.status = 409;
          return { error: "ALREADY_ANSWERED", message: "Bạn đã gửi câu trả lời cho câu hỏi này rồi" };
        }
        throw err;
      }

      if (!written) {
        set.status = 400;
        return { error: "ANSWER_WINDOW_CLOSED", message: "Ván vừa đổi trạng thái — không ghi được câu trả lời" };
      }

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
        answerId: written.id,
        responseTimeMs,
        submitted: true,
      };
    },
    {
      body: submitAnswerBody,
    }
  )
  // Get Leaderboard
  .get("/:gameId/leaderboard", async ({ params }) => {
    const leaderboard = await getGameLeaderboard(params.gameId, 50);
    return { leaderboard };
  })
  // Endscreen: Complete Leaderboard & Podium Data when game finishes
  .get("/:gameId/endscreen", async ({ params, currentUser, set }) => {
    const game = await prisma.quizGame.findUnique({
      where: { id: params.gameId },
      include: {
        session: true,
        questions: {
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

    const fullLeaderboard = await getGameLeaderboard(game.id, 50);
    const podium = fullLeaderboard.slice(0, 3);

    let userResult = null;
    if (currentUser?.id) {
      const userRankIndex = fullLeaderboard.findIndex((p) => p.userId === currentUser.id);
      const userAnswers = await prisma.quizAnswer.findMany({
        where: { gameId: game.id, userId: currentUser.id },
      });

      const totalUserScore = userAnswers.reduce((sum, a) => sum + a.scoreAwarded, 0);
      const correctCount = userAnswers.filter((a) => a.isCorrect).length;
      const avgResponseTimeMs =
        userAnswers.length > 0
          ? Math.round(userAnswers.reduce((sum, a) => sum + a.responseTimeMs, 0) / userAnswers.length)
          : 0;

      userResult = {
        userId: currentUser.id,
        userEmail: currentUser.email,
        rank: userRankIndex >= 0 ? userRankIndex + 1 : null,
        totalScore: totalUserScore,
        correctCount,
        totalQuestions: game.questions.length,
        accuracyPercentage:
          game.questions.length > 0 ? Math.round((correctCount / game.questions.length) * 100) : 0,
        avgResponseTimeMs,
      };
    }

    const totalParticipants = fullLeaderboard.length;
    const avgScore =
      totalParticipants > 0
        ? Math.round(fullLeaderboard.reduce((sum, p) => sum + p.totalScore, 0) / totalParticipants)
        : 0;
    const highestScore = fullLeaderboard.length > 0 ? fullLeaderboard[0].totalScore : 0;

    return {
      gameId: game.id,
      title: game.title,
      description: game.description,
      status: game.status,
      isFinished: game.status === "FINISHED",
      totalQuestions: game.questions.length,
      podium,
      leaderboard: fullLeaderboard,
      userResult,
      stats: {
        totalParticipants,
        averageScore: avgScore,
        highestScore,
      },
    };
  });
