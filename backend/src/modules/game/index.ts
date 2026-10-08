import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../plugins/prisma";
import { getSessionLiveStatus, checkUserSessionAccess } from "../realtime";

// Map to store connected clients per gameId
const gameSubscribers = new Map<string, Set<any>>();

export function broadcastToGame(gameId: string, message: any) {
  const subscribers = gameSubscribers.get(gameId);
  if (!subscribers) return;
  const payload = JSON.stringify(message);
  for (const ws of subscribers) {
    try {
      ws.send(payload);
    } catch {
      gameSubscribers.delete(ws);
    }
  }
}

/**
 * Calculate Kahoot-style score based on correctness and speed
 */
export function calculateQuizScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitSec: number,
  basePoints = 1000
): number {
  if (!isCorrect) return 0;
  const timeLimitMs = timeLimitSec * 1000;
  const clampedTime = Math.min(Math.max(responseTimeMs, 0), timeLimitMs);

  // Speed factor: 1.0 (instant) down to 0.5 (at time limit)
  const scoreFactor = 1 - (clampedTime / (2 * timeLimitMs));
  return Math.round(basePoints * scoreFactor);
}

/**
 * Compute Leaderboard for a Game
 */
export async function getGameLeaderboard(gameId: string, limit = 10) {
  const answers = await prisma.quizAnswer.findMany({
    where: { gameId },
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  const scoreMap = new Map<string, { userId: string; fullName: string; totalScore: number; correctCount: number }>();

  for (const ans of answers) {
    const existing = scoreMap.get(ans.userId) || {
      userId: ans.userId,
      fullName: ans.user.fullName,
      totalScore: 0,
      correctCount: 0,
    };

    existing.totalScore += ans.scoreAwarded;
    if (ans.isCorrect) existing.correctCount += 1;
    scoreMap.set(ans.userId, existing);
  }

  const sorted = Array.from(scoreMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return sorted;
}

export const gameModule = new Elysia({ prefix: "/api/game" })
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
      body: t.Object({
        title: t.String(),
        description: t.Optional(t.String()),
      }),
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
      body: t.Object({
        question: t.String(),
        timeLimitSec: t.Optional(t.Number()),
        points: t.Optional(t.Number()),
        options: t.Array(
          t.Object({
            text: t.String(),
            isCorrect: t.Boolean(),
          })
        ),
      }),
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
      body: t.Object({
        questionId: t.String(),
        optionId: t.String(),
        responseTimeMs: t.Number(),
        userId: t.Optional(t.String()),
      }),
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
