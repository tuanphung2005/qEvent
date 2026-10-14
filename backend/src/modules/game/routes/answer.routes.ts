import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { getSessionLiveStatus, checkUserSessionAccess } from "../../realtime";
import { broadcastToGame } from "../services/broadcast.service";
import { calculateQuizScore, getGameLeaderboard } from "../services/scoring.service";
import { submitAnswerBody } from "../schemas";

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
      const { questionId, optionId, responseTimeMs } = body;
      const effectiveUserId = currentUser?.id || (body as any).userId;

      if (!effectiveUserId) {
        set.status = 401;
        return { error: "Vui lòng đăng nhập để tham gia trò chơi" };
      }

      const game = await prisma.quizGame.findUnique({
        where: { id: params.gameId },
        include: { session: true },
      });

      if (!game) {
        set.status = 404;
        return { error: "Game not found" };
      }

      // Check live status
      const { isLive } = await getSessionLiveStatus(game.sessionId);
      if (!isLive) {
        set.status = 403;
        return {
          error: "EVENT_NOT_LIVE",
          message: "Trò chơi chỉ mở trong thời gian sự kiện diễn ra",
        };
      }

      // Check attendance
      const access = await checkUserSessionAccess(game.sessionId, effectiveUserId);
      if (!access.isCheckedIn) {
        set.status = 403;
        return {
          error: "NOT_CHECKED_IN",
          message: "Bạn cần điểm danh tại cổng để tham gia trò chơi",
        };
      }

      // Check question and game state
      if (game.status !== "QUESTION_ACTIVE") {
        set.status = 400;
        return { error: "Câu hỏi hiện tại đã hết thời gian trả lời" };
      }

      const question = await prisma.quizQuestion.findUnique({
        where: { id: questionId },
        include: { options: true },
      });

      if (!question || question.gameId !== game.id) {
        set.status = 400;
        return { error: "Câu hỏi không hợp lệ" };
      }

      const selectedOption = question.options.find((o) => o.id === optionId);
      if (!selectedOption) {
        set.status = 400;
        return { error: "Lựa chọn không hợp lệ" };
      }

      // Prevent duplicate answers
      const existingAnswer = await prisma.quizAnswer.findUnique({
        where: {
          questionId_userId: {
            questionId,
            userId: effectiveUserId,
          },
        },
      });

      if (existingAnswer) {
        set.status = 409;
        return { error: "Bạn đã gửi câu trả lời cho câu hỏi này rồi" };
      }

      const isCorrect = selectedOption.isCorrect;
      const scoreAwarded = calculateQuizScore(
        isCorrect,
        responseTimeMs,
        question.timeLimitSec,
        question.points
      );

      const answer = await prisma.quizAnswer.create({
        data: {
          gameId: game.id,
          questionId,
          optionId,
          userId: effectiveUserId,
          isCorrect,
          responseTimeMs,
          scoreAwarded,
        },
      });

      const totalAnswersCount = await prisma.quizAnswer.count({
        where: { questionId },
      });

      broadcastToGame(game.id, {
        type: "ANSWER_COUNT_UPDATED",
        gameId: game.id,
        questionId,
        totalAnswersCount,
      });

      return {
        message: "Câu trả lời đã được ghi nhận",
        answerId: answer.id,
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
