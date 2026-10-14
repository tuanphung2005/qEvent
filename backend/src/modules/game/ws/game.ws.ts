import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { checkUserSessionAccess } from "../../realtime";
import { gameSubscribers, broadcastToGame } from "../services/broadcast.service";
import { calculateQuizScore, getGameLeaderboard } from "../services/scoring.service";

export const gameWs = new Elysia()
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
  // WebSocket Route for Realtime Game Sync
  .ws("/ws/game", {
    body: t.Any(),
    open(ws) {
      (ws.data as any).currentGameId = null;
    },
    async message(ws, message: any) {
      try {
        const data = typeof message === "string" ? JSON.parse(message) : message;
        if (!data || !data.type) return;

        switch (data.type) {
          case "JOIN_GAME": {
            const { gameId, userId } = data;
            if ((ws.data as any).currentGameId) {
              gameSubscribers.get((ws.data as any).currentGameId)?.delete(ws);
            }
            (ws.data as any).currentGameId = gameId;

            if (!gameSubscribers.has(gameId)) {
              gameSubscribers.set(gameId, new Set());
            }
            gameSubscribers.get(gameId)!.add(ws);

            const game = await prisma.quizGame.findUnique({
              where: { id: gameId },
              include: {
                questions: {
                  orderBy: { orderNum: "asc" },
                  include: { options: true },
                },
              },
            });

            if (!game) break;

            const currentQ =
              game.currentQuestionIndex >= 0 && game.questions[game.currentQuestionIndex]
                ? game.questions[game.currentQuestionIndex]
                : null;

            ws.send(
              JSON.stringify({
                type: "GAME_STATE",
                gameId,
                status: game.status,
                currentQuestionIndex: game.currentQuestionIndex,
                totalQuestions: game.questions.length,
                currentQuestion: currentQ
                  ? {
                      id: currentQ.id,
                      question: currentQ.question,
                      timeLimitSec: currentQ.timeLimitSec,
                      points: currentQ.points,
                      questionStartedAt: currentQ.questionStartedAt,
                      options: currentQ.options.map((o) => ({
                        id: o.id,
                        text: o.text,
                        color: o.color,
                        isCorrect: game.status === "ROUND_REVEALED" ? o.isCorrect : undefined,
                      })),
                    }
                  : null,
                leaderboard: await getGameLeaderboard(gameId, 5),
              })
            );
            break;
          }

          case "SUBMIT_ANSWER": {
            const { gameId, questionId, optionId, userId, responseTimeMs } = data;
            if (!gameId || !questionId || !optionId || !userId) break;

            const game = await prisma.quizGame.findUnique({
              where: { id: gameId },
            });
            if (!game || game.status !== "QUESTION_ACTIVE") break;

            const access = await checkUserSessionAccess(game.sessionId, userId);
            if (!access.isCheckedIn) break;

            const q = await prisma.quizQuestion.findUnique({
              where: { id: questionId },
              include: { options: true },
            });
            if (!q) break;

            const chosen = q.options.find((o) => o.id === optionId);
            if (!chosen) break;

            const isCorrect = chosen.isCorrect;
            const score = calculateQuizScore(
              isCorrect,
              responseTimeMs || 5000,
              q.timeLimitSec,
              q.points
            );

            try {
              await prisma.quizAnswer.create({
                data: {
                  gameId,
                  questionId,
                  optionId,
                  userId,
                  isCorrect,
                  responseTimeMs: responseTimeMs || 5000,
                  scoreAwarded: score,
                },
              });

              const total = await prisma.quizAnswer.count({ where: { questionId } });
              broadcastToGame(gameId, {
                type: "ANSWER_COUNT_UPDATED",
                gameId,
                questionId,
                totalAnswersCount: total,
              });
            } catch {
              // Ignore duplicate answer attempt
            }
            break;
          }
        }
      } catch (err: any) {
        console.error("[Game WS Error]", err);
      }
    },
    close(ws) {
      const gId = (ws.data as any).currentGameId;
      if (gId) {
        gameSubscribers.get(gId)?.delete(ws);
      }
    },
  });
