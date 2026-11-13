import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isHostRole } from "../lib/auth";
import { AccessError, requireSessionAccess } from "../lib/br6";
import { fail } from "../lib/http";
import { broadcaster } from "../lib/broadcast";

const ANSWER_GRACE_MS = 2000;

export function calculateQuizScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitSec: number,
  basePoints = 1000
): number {
  if (!isCorrect) return 0;
  const timeLimitMs = timeLimitSec * 1000;
  const clampedTime = Math.min(Math.max(responseTimeMs, 0), timeLimitMs);
  const scoreFactor = 1 - clampedTime / (2 * timeLimitMs);
  return Math.round(basePoints * scoreFactor);
}

export function gameRoutes(deps: Deps, jwtSecret: string) {
  return new Elysia({ tags: ["game"] })
    .use(createJwtAuth(jwtSecret))
    .derive(deriveCurrentUser)

    // GET /api/sessions/:sessionId/game
    .get(
      "/api/sessions/:sessionId/game",
      async ({ params, set }) => {
        const game = await deps.prisma.quizGame.findUnique({
          where: { sessionId: params.sessionId },
          include: {
            questions: {
              orderBy: { orderNum: "asc" },
            },
          },
        });

        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "No quiz game found for this session");
        }

        return {
          game: {
            id: game.id,
            sessionId: game.sessionId,
            status: game.status,
            currentQuestionIndex: game.currentQuestionIndex,
            totalQuestions: game.questions.length,
          },
        };
      },
      {
        params: t.Object({ sessionId: t.String({ minLength: 1 }) }),
      }
    )

    // POST /api/sessions/:sessionId/game
    .post(
      "/api/sessions/:sessionId/game",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can create a quiz game");
        }

        const existing = await deps.prisma.quizGame.findUnique({
          where: { sessionId: params.sessionId },
        });
        if (existing) {
          return { game: existing };
        }

        const game = await deps.prisma.quizGame.create({
          data: {
            sessionId: params.sessionId,
            status: "WAITING",
            currentQuestionIndex: 0,
          },
        });

        set.status = 201;
        return { game };
      },
      {
        params: t.Object({ sessionId: t.String({ minLength: 1 }) }),
      }
    )

    // POST /api/game/:gameId/question
    .post(
      "/api/game/:gameId/question",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can add questions");
        }

        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }
        if (game.status !== "WAITING") {
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            `Cannot add questions when game is ${game.status}`
          );
        }

        const options = body.options.map((o) => o.trim());
        if (options.length < 2 || options.length > 6) {
          return fail(set, 400, "INVALID_OPTIONS", "Question must have between 2 and 6 options");
        }
        if (body.correctOption < 0 || body.correctOption >= options.length) {
          return fail(
            set,
            400,
            "INVALID_CORRECT_OPTION",
            `correctOption must be an index between 0 and ${options.length - 1}`
          );
        }
        const timeLimitSec = body.timeLimitSec ?? 30;
        if (timeLimitSec <= 0 || timeLimitSec > 300) {
          return fail(
            set,
            400,
            "INVALID_TIME_LIMIT",
            "timeLimitSec must be between 1 and 300 seconds"
          );
        }

        const question = await deps.prisma.$transaction(async (tx) => {
          const freshGame = await tx.quizGame.findUnique({
            where: { id: params.gameId },
          });
          if (!freshGame || freshGame.status !== "WAITING") {
            return null;
          }

          const agg = await tx.quizQuestion.aggregate({
            where: { gameId: params.gameId },
            _max: { orderNum: true },
          });
          const nextOrderNum = (agg._max.orderNum ?? -1) + 1;

          return tx.quizQuestion.create({
            data: {
              gameId: params.gameId,
              orderNum: nextOrderNum,
              content: body.content.trim(),
              options,
              correctOption: body.correctOption,
              timeLimitSec,
            },
          });
        });

        if (!question) {
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            "Game status changed while adding question"
          );
        }

        set.status = 201;
        return { question };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
        body: t.Object({
          content: t.String({ minLength: 1, maxLength: 500 }),
          options: t.Array(t.String(), { minItems: 2, maxItems: 6 }),
          correctOption: t.Integer({ minimum: 0, maximum: 5 }),
          timeLimitSec: t.Optional(t.Integer({ minimum: 1, maximum: 300 })),
        }),
      }
    )

    // GET /api/game/:gameId
    .get(
      "/api/game/:gameId",
      async ({ params, currentUser, set }) => {
        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
          include: {
            questions: {
              orderBy: { orderNum: "asc" },
            },
          },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }

        const isHost = isHostRole(currentUser?.role);

        if (isHost) {
          return {
            game: {
              id: game.id,
              sessionId: game.sessionId,
              status: game.status,
              currentQuestionIndex: game.currentQuestionIndex,
              questions: game.questions.map((q) => ({
                id: q.id,
                orderNum: q.orderNum,
                content: q.content,
                options: q.options,
                correctOption: q.correctOption,
                timeLimitSec: q.timeLimitSec,
                questionStartedAt: q.questionStartedAt,
              })),
            },
          };
        }

        // Attendee view
        if (game.status === "WAITING") {
          return {
            game: {
              id: game.id,
              sessionId: game.sessionId,
              status: game.status,
              currentQuestionIndex: game.currentQuestionIndex,
              totalQuestions: game.questions.length,
            },
          };
        }

        if (game.status === "FINISHED") {
          return {
            game: {
              id: game.id,
              sessionId: game.sessionId,
              status: game.status,
              currentQuestionIndex: game.currentQuestionIndex,
              questions: game.questions.map((q) => ({
                id: q.id,
                orderNum: q.orderNum,
                content: q.content,
                options: q.options,
                correctOption: q.correctOption,
              })),
            },
          };
        }

        const activeQ = game.questions[game.currentQuestionIndex];
        return {
          game: {
            id: game.id,
            sessionId: game.sessionId,
            status: game.status,
            currentQuestionIndex: game.currentQuestionIndex,
            totalQuestions: game.questions.length,
            currentQuestion: activeQ
              ? {
                  id: activeQ.id,
                  orderNum: activeQ.orderNum,
                  content: activeQ.content,
                  options: activeQ.options,
                  timeLimitSec: activeQ.timeLimitSec,
                  questionStartedAt: activeQ.questionStartedAt,
                  ...(game.status === "ROUND_REVEALED"
                    ? { correctOption: activeQ.correctOption }
                    : {}),
                }
              : null,
          },
        };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
      }
    )

    // POST /api/game/:gameId/start
    .post(
      "/api/game/:gameId/start",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can start the game");
        }

        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
          include: {
            questions: { orderBy: { orderNum: "asc" } },
          },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }
        if (game.status !== "WAITING") {
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            `Cannot start a game with status ${game.status}`
          );
        }
        if (game.questions.length === 0) {
          return fail(set, 400, "NO_QUESTIONS", "Game must have at least one question to start");
        }

        const now = deps.now();
        const firstQ = game.questions[0];

        const started = await deps.prisma.$transaction(async (tx) => {
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
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            "Game was already started by another request"
          );
        }

        const updatedGame = await deps.prisma.quizGame.findUniqueOrThrow({
          where: { id: game.id },
        });

        const currentQuestion = {
          id: firstQ.id,
          orderNum: 0,
          content: firstQ.content,
          options: firstQ.options,
          timeLimitSec: firstQ.timeLimitSec,
          questionStartedAt: now.toISOString(),
        };

        broadcaster.broadcastGame(game.id, {
          type: "QUESTION_ACTIVE",
          gameId: game.id,
          questionIndex: 0,
          totalQuestions: game.questions.length,
          question: currentQuestion,
        });

        return {
          game: updatedGame,
          currentQuestion,
        };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
      }
    )

    // POST /api/game/:gameId/reveal
    .post(
      "/api/game/:gameId/reveal",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can reveal answers");
        }

        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
          include: { questions: { orderBy: { orderNum: "asc" } } },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }
        if (game.status !== "QUESTION_ACTIVE") {
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            `Cannot reveal answer when game is ${game.status}`
          );
        }

        const res = await deps.prisma.quizGame.updateMany({
          where: { id: game.id, status: "QUESTION_ACTIVE" },
          data: { status: "ROUND_REVEALED" },
        });
        if (res.count !== 1) {
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            "Game status changed while attempting reveal"
          );
        }

        const currentQ = game.questions[game.currentQuestionIndex];
        const correctOption = currentQ ? currentQ.correctOption : 0;

        broadcaster.broadcastGame(game.id, {
          type: "ROUND_REVEALED",
          gameId: game.id,
          questionIndex: game.currentQuestionIndex,
          correctOption,
        });

        return {
          game: { ...game, status: "ROUND_REVEALED" },
          correctOption,
        };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
      }
    )

    // POST /api/game/:gameId/next
    .post(
      "/api/game/:gameId/next",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can advance questions");
        }

        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
          include: { questions: { orderBy: { orderNum: "asc" } } },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }
        if (game.status !== "ROUND_REVEALED") {
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            `Must reveal round before advancing. Current status: ${game.status}`
          );
        }

        const nextIndex = game.currentQuestionIndex + 1;
        if (nextIndex >= game.questions.length) {
          return fail(
            set,
            409,
            "NO_MORE_QUESTIONS",
            "No more questions available. Call /end to finish the game."
          );
        }

        const nextQ = game.questions[nextIndex];
        const now = deps.now();

        const updated = await deps.prisma.$transaction(async (tx) => {
          const res = await tx.quizGame.updateMany({
            where: {
              id: game.id,
              status: "ROUND_REVEALED",
              currentQuestionIndex: game.currentQuestionIndex,
            },
            data: {
              status: "QUESTION_ACTIVE",
              currentQuestionIndex: nextIndex,
            },
          });
          if (res.count !== 1) return false;

          await tx.quizQuestion.update({
            where: { id: nextQ.id },
            data: { questionStartedAt: now },
          });
          return true;
        });

        if (!updated) {
          return fail(
            set,
            409,
            "INVALID_GAME_STATE",
            "Game state changed during advance"
          );
        }

        const currentQuestion = {
          id: nextQ.id,
          orderNum: nextIndex,
          content: nextQ.content,
          options: nextQ.options,
          timeLimitSec: nextQ.timeLimitSec,
          questionStartedAt: now.toISOString(),
        };

        broadcaster.broadcastGame(game.id, {
          type: "QUESTION_ACTIVE",
          gameId: game.id,
          questionIndex: nextIndex,
          totalQuestions: game.questions.length,
          question: currentQuestion,
        });

        return {
          game: {
            ...game,
            status: "QUESTION_ACTIVE",
            currentQuestionIndex: nextIndex,
          },
          currentQuestion,
        };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
      }
    )

    // POST /api/game/:gameId/end
    .post(
      "/api/game/:gameId/end",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can end the game");
        }

        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }
        if (game.status === "FINISHED") {
          return fail(set, 409, "INVALID_GAME_STATE", "Game is already finished");
        }

        const res = await deps.prisma.quizGame.updateMany({
          where: {
            id: game.id,
            status: { in: ["WAITING", "QUESTION_ACTIVE", "ROUND_REVEALED"] },
          },
          data: { status: "FINISHED" },
        });

        if (res.count !== 1) {
          return fail(set, 409, "INVALID_GAME_STATE", "Could not end game in current state");
        }

        broadcaster.broadcastGame(game.id, {
          type: "GAME_FINISHED",
          gameId: game.id,
        });

        return {
          game: { ...game, status: "FINISHED" },
        };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
      }
    )

    // POST /api/game/:gameId/answer
    .post(
      "/api/game/:gameId/answer",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }

        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }

        // BR-6: eventId is resolved from Event Service, never trusted from the body.
        try {
          await requireSessionAccess(deps, currentUser.id, game.sessionId);
        } catch (error) {
          if (error instanceof AccessError) {
            return fail(set, error.status, error.code, error.message);
          }
          throw error;
        }

        if (game.status !== "QUESTION_ACTIVE") {
          return fail(
            set,
            400,
            "ANSWER_WINDOW_CLOSED",
            "Current question is not accepting answers"
          );
        }

        const currentQ = await deps.prisma.quizQuestion.findFirst({
          where: {
            gameId: game.id,
            orderNum: game.currentQuestionIndex,
          },
        });

        if (!currentQ || currentQ.id !== body.questionId) {
          return fail(
            set,
            400,
            "NOT_CURRENT_QUESTION",
            "Answers are only accepted for the currently active question"
          );
        }

        if (!currentQ.questionStartedAt) {
          return fail(set, 409, "QUESTION_NOT_STARTED", "Question start time is missing");
        }

        const nowMs = deps.now().getTime();
        const startedMs = currentQ.questionStartedAt.getTime();
        const elapsedMs = nowMs - startedMs;
        const limitMs = currentQ.timeLimitSec * 1000;

        if (elapsedMs > limitMs + ANSWER_GRACE_MS) {
          return fail(set, 400, "ANSWER_TOO_LATE", "Time limit exceeded");
        }

        // Server authoritative response time (ignore client timing claims)
        const responseTimeMs = Math.min(Math.max(elapsedMs, 0), limitMs);

        // Check if already answered
        const existingAnswer = await deps.prisma.quizAnswer.findUnique({
          where: {
            questionId_userId: {
              questionId: currentQ.id,
              userId: currentUser.id,
            },
          },
        });
        if (existingAnswer) {
          return fail(
            set,
            409,
            "ALREADY_ANSWERED",
            "You have already submitted an answer for this question"
          );
        }

        if (body.selectedOption < 0 || body.selectedOption >= currentQ.options.length) {
          return fail(set, 400, "INVALID_OPTION", "Selected option index is out of bounds");
        }

        const isCorrect = body.selectedOption === currentQ.correctOption;
        const score = calculateQuizScore(isCorrect, responseTimeMs, currentQ.timeLimitSec);

        await deps.prisma.quizAnswer.create({
          data: {
            questionId: currentQ.id,
            userId: currentUser.id,
            selectedOption: body.selectedOption,
            responseTimeMs,
            score,
            answeredAt: deps.now(),
          },
        });

        return {
          isCorrect,
          score,
          responseTimeMs,
        };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
        body: t.Object({
          questionId: t.String({ minLength: 1 }),
          selectedOption: t.Integer({ minimum: 0, maximum: 5 }),
          // Accepted only so legacy clients do not crash; both fields are ignored.
          userId: t.Optional(t.String()),
          responseTimeMs: t.Optional(t.Integer()),
        }),
      }
    )

    // GET /api/game/:gameId/leaderboard
    .get(
      "/api/game/:gameId/leaderboard",
      async ({ params, set }) => {
        const game = await deps.prisma.quizGame.findUnique({
          where: { id: params.gameId },
        });
        if (!game) {
          return fail(set, 404, "GAME_NOT_FOUND", "Quiz game was not found");
        }

        const answers = await deps.prisma.quizAnswer.findMany({
          where: {
            question: { gameId: params.gameId },
          },
        });

        const scoreMap = new Map<
          string,
          { userId: string; totalScore: number; correctCount: number }
        >();

        for (const ans of answers) {
          const entry = scoreMap.get(ans.userId) ?? {
            userId: ans.userId,
            totalScore: 0,
            correctCount: 0,
          };
          entry.totalScore += ans.score;
          if (ans.score > 0) entry.correctCount += 1;
          scoreMap.set(ans.userId, entry);
        }

        const leaderboard = Array.from(scoreMap.values())
          .sort((a, b) => b.totalScore - a.totalScore)
          .map((item, idx) => ({
            rank: idx + 1,
            ...item,
          }));

        return {
          gameId: params.gameId,
          leaderboard,
        };
      },
      {
        params: t.Object({ gameId: t.String({ minLength: 1 }) }),
      }
    );
}
