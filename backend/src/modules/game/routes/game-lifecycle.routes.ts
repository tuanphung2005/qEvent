import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { broadcastToGame } from "../services/broadcast.service";
import { getGameLeaderboard } from "../services/scoring.service";

export const gameLifecycleRoutes = new Elysia()
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
  // Host: Start the game (starts question 0)
  .post("/:gameId/start", async ({ params, set }) => {
    const game = await prisma.quizGame.findUnique({
      where: { id: params.gameId },
      include: {
        questions: {
          orderBy: { orderNum: "asc" },
          include: { options: true },
        },
      },
    });

    if (!game || game.questions.length === 0) {
      set.status = 400;
      return { error: "Trò chơi chưa có câu hỏi nào để bắt đầu" };
    }

    const now = new Date();
    await prisma.quizQuestion.update({
      where: { id: game.questions[0].id },
      data: { questionStartedAt: now },
    });

    const updatedGame = await prisma.quizGame.update({
      where: { id: params.gameId },
      data: {
        status: "QUESTION_ACTIVE",
        currentQuestionIndex: 0,
      },
    });

    const firstQ = game.questions[0];
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
        options: firstQ.options.map((o) => ({
          id: o.id,
          text: o.text,
          color: o.color,
        })),
      },
    };

    broadcastToGame(game.id, broadcastPayload);
    return { game: updatedGame, currentQuestion: broadcastPayload.question };
  })
  // Host: Next question
  .post("/:gameId/next", async ({ params, set }) => {
    const game = await prisma.quizGame.findUnique({
      where: { id: params.gameId },
      include: {
        questions: {
          orderBy: { orderNum: "asc" },
          include: { options: true },
        },
      },
    });

    if (!game) {
      set.status = 404;
      return { error: "Game not found" };
    }

    const nextIndex = game.currentQuestionIndex + 1;
    if (nextIndex >= game.questions.length) {
      set.status = 400;
      return { error: "Đã hết câu hỏi. Vui lòng kết thúc trò chơi." };
    }

    const now = new Date();
    const nextQ = game.questions[nextIndex];
    await prisma.quizQuestion.update({
      where: { id: nextQ.id },
      data: { questionStartedAt: now },
    });

    const updatedGame = await prisma.quizGame.update({
      where: { id: params.gameId },
      data: {
        status: "QUESTION_ACTIVE",
        currentQuestionIndex: nextIndex,
      },
    });

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
        options: nextQ.options.map((o) => ({
          id: o.id,
          text: o.text,
          color: o.color,
        })),
      },
    };

    broadcastToGame(game.id, broadcastPayload);
    return { game: updatedGame, currentQuestion: broadcastPayload.question };
  })
  // Host: Reveal Round (Answer + Leaderboard)
  .post("/:gameId/reveal", async ({ params, set }) => {
    const game = await prisma.quizGame.findUnique({
      where: { id: params.gameId },
      include: {
        questions: {
          orderBy: { orderNum: "asc" },
          include: {
            options: true,
            answers: true,
          },
        },
      },
    });

    if (!game || game.currentQuestionIndex < 0) {
      set.status = 400;
      return { error: "Chưa có câu hỏi nào đang chạy" };
    }

    const currentQ = game.questions[game.currentQuestionIndex];
    const updatedGame = await prisma.quizGame.update({
      where: { id: params.gameId },
      data: { status: "ROUND_REVEALED" },
    });

    // Compute answer breakdown per option
    const answerCounts: Record<string, number> = {};
    for (const opt of currentQ.options) {
      answerCounts[opt.id] = 0;
    }
    for (const ans of currentQ.answers) {
      if (answerCounts[ans.optionId] !== undefined) {
        answerCounts[ans.optionId]++;
      }
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
        count: answerCounts[o.id] || 0,
      })),
      leaderboard,
    };

    broadcastToGame(game.id, broadcastPayload);
    return { game: updatedGame, reveal: broadcastPayload };
  })
  // Host: End Game and show final winners
  .post("/:gameId/end", async ({ params, set }) => {
    const updatedGame = await prisma.quizGame.update({
      where: { id: params.gameId },
      data: { status: "FINISHED" },
    });

    const finalLeaderboard = await getGameLeaderboard(params.gameId, 50);

    const broadcastPayload = {
      type: "GAME_FINISHED",
      gameId: params.gameId,
      podium: finalLeaderboard.slice(0, 3),
      leaderboard: finalLeaderboard,
    };

    broadcastToGame(params.gameId, broadcastPayload);
    return { game: updatedGame, results: broadcastPayload };
  });
