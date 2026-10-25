import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { broadcastToGame } from "../services/broadcast.service";
import { getGameLeaderboard } from "../services/scoring.service";
import { requireHost, transition } from "../services/access.service";

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
  // Host: Next question
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
  // Host: Reveal Round (Answer + Leaderboard)
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
          include: { options: true },
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

    // Đọc answer SAU khi CAS: tránh đếm thiếu người vừa trả lời trong lúc reveal.
    const answers = await prisma.quizAnswer.findMany({
      where: { questionId: currentQ.id },
      select: { optionId: true },
    });

    const answerCounts: Record<string, number> = {};
    for (const opt of currentQ.options) answerCounts[opt.id] = 0;
    for (const ans of answers) {
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
  // Host: End Game and show final winners
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
  });
