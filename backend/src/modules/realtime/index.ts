import { Elysia, t } from "elysia";
import { prisma } from "../../plugins/prisma";

// Map to store connected clients per sessionId
const sessionSubscribers = new Map<string, Set<any>>();

export function broadcastToSession(sessionId: string, message: any) {
  const subscribers = sessionSubscribers.get(sessionId);
  if (!subscribers) return;
  const payload = JSON.stringify(message);
  for (const ws of subscribers) {
    try {
      ws.send(payload);
    } catch {
      subscribers.delete(ws);
    }
  }
}

async function handleToggleVote(questionId: string, userId: string) {
  const existingVote = await prisma.qAQuestionVote.findUnique({
    where: {
      questionId_userId: {
        questionId,
        userId,
      },
    },
  });

  let question;
  let hasVoted = false;

  if (existingVote) {
    // Already voted -> Unvote (toggle off)
    await prisma.qAQuestionVote.delete({
      where: { id: existingVote.id },
    });
    question = await prisma.qAQuestion.update({
      where: { id: questionId },
      data: {
        upvotes: { decrement: 1 },
      },
      include: {
        user: { select: { id: true, fullName: true } },
        votes: { select: { userId: true } },
      },
    });
    hasVoted = false;
  } else {
    // Not voted yet -> Vote (toggle on)
    await prisma.qAQuestionVote.create({
      data: {
        questionId,
        userId,
      },
    });
    question = await prisma.qAQuestion.update({
      where: { id: questionId },
      data: {
        upvotes: { increment: 1 },
      },
      include: {
        user: { select: { id: true, fullName: true } },
        votes: { select: { userId: true } },
      },
    });
    hasVoted = true;
  }

  return { question, hasVoted };
}

export const realtimeModule = new Elysia()
  // REST routes for initial fetch or HTTP fallbacks
  .get("/api/qa/session/:sessionId", async ({ params }) => {
    const questions = await prisma.qAQuestion.findMany({
      where: { sessionId: params.sessionId },
      include: {
        user: { select: { id: true, fullName: true } },
        votes: { select: { userId: true } },
      },
      orderBy: { upvotes: "desc" },
    });
    return { questions };
  })
  .post(
    "/api/qa/question",
    async ({ body, set }) => {
      const { sessionId, userId, content } = body;
      const question = await prisma.qAQuestion.create({
        data: {
          sessionId,
          userId,
          content,
        },
        include: {
          user: { select: { id: true, fullName: true } },
          votes: { select: { userId: true } },
        },
      });

      broadcastToSession(sessionId, {
        type: "QUESTION_ADDED",
        question,
      });

      return { question };
    },
    {
      body: t.Object({
        sessionId: t.String(),
        userId: t.String(),
        content: t.String(),
      }),
    }
  )
  .post(
    "/api/qa/upvote/:questionId",
    async ({ params, body, set }) => {
      const { userId } = body;
      if (!userId) {
        set.status = 400;
        return { error: "userId is required for voting" };
      }

      const { question, hasVoted } = await handleToggleVote(params.questionId, userId);

      broadcastToSession(question.sessionId, {
        type: "VOTE_UPDATED",
        questionId: question.id,
        upvotes: question.upvotes,
        userId,
        hasVoted,
      });

      return { question, hasVoted, upvotes: question.upvotes };
    },
    {
      body: t.Object({
        userId: t.String(),
      }),
    }
  )
  // WebSocket route for real-time live Q&A
  .ws("/ws/qa", {
    body: t.Any(),
    open(ws) {
      (ws.data as any).currentSessionId = null;
    },
    async message(ws, message: any) {
      try {
        const data = typeof message === "string" ? JSON.parse(message) : message;
        if (!data || !data.type) return;

        switch (data.type) {
          case "JOIN_SESSION": {
            const { sessionId } = data;
            if ((ws.data as any).currentSessionId) {
              sessionSubscribers.get((ws.data as any).currentSessionId)?.delete(ws);
            }
            (ws.data as any).currentSessionId = sessionId;

            if (!sessionSubscribers.has(sessionId)) {
              sessionSubscribers.set(sessionId, new Set());
            }
            sessionSubscribers.get(sessionId)!.add(ws);

            // Send existing questions to newly connected client
            const questions = await prisma.qAQuestion.findMany({
              where: { sessionId },
              include: {
                user: { select: { id: true, fullName: true } },
                votes: { select: { userId: true } },
              },
              orderBy: { upvotes: "desc" },
            });

            ws.send(
              JSON.stringify({
                type: "INITIAL_QUESTIONS",
                sessionId,
                questions,
              })
            );
            break;
          }

          case "POST_QUESTION": {
            const { sessionId, userId, content } = data;
            const question = await prisma.qAQuestion.create({
              data: { sessionId, userId, content },
              include: {
                user: { select: { id: true, fullName: true } },
                votes: { select: { userId: true } },
              },
            });

            broadcastToSession(sessionId, {
              type: "QUESTION_ADDED",
              question,
            });
            break;
          }

          case "UPVOTE": {
            const { questionId, userId } = data;
            if (!userId) break;
            const { question, hasVoted } = await handleToggleVote(questionId, userId);

            broadcastToSession(question.sessionId, {
              type: "VOTE_UPDATED",
              questionId: question.id,
              upvotes: question.upvotes,
              userId,
              hasVoted,
            });
            break;
          }
        }
      } catch (err: any) {
        console.error("[Realtime WS Error]", err);
      }
    },
    close(ws) {
      const sessionId = (ws.data as any).currentSessionId;
      if (sessionId) {
        sessionSubscribers.get(sessionId)?.delete(ws);
      }
    },
  });
