import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { JWT_CONFIG, deriveCurrentUser } from "../../../lib/auth";
import { prisma } from "../../../plugins/prisma";
import { sessionSubscribers } from "../services/broadcast.service";
import { getSessionLiveStatus } from "../services/session-access.service";
import { tallyOptions } from "../services/poll-format.service";
import { postQuestion, upvoteQuestion, votePoll } from "../services/qa.service";

export const qaWs = new Elysia()
  .use(jwt(JWT_CONFIG))
  .derive(deriveCurrentUser)
  // WebSocket route for real-time live Q&A and interactive questions
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

            const { isLive, status } = await getSessionLiveStatus(sessionId).catch(() => ({
              isLive: false,
              status: "UPCOMING" as const,
            }));

            const questions = await prisma.qAQuestion.findMany({
              where: { sessionId },
              include: {
                user: { select: { id: true, fullName: true } },
                votes: { select: { userId: true } },
              },
              orderBy: [{ isPinned: "desc" }, { upvotes: "desc" }],
            });

            const polls = await prisma.poll.findMany({
              where: { sessionId },
              include: {
                options: {
                  include: { _count: { select: { votes: true } } },
                },
              },
              orderBy: { createdAt: "desc" },
            });

            ws.send(
              JSON.stringify({
                type: "INITIAL_QUESTIONS",
                sessionId,
                isLive,
                sessionStatus: status,
                questions,
                polls: polls.map((p) => {
                  const { totalVotes, tally } = tallyOptions(p.options);
                  return {
                    id: p.id,
                    question: p.question,
                    isActive: p.isActive,
                    totalVotes,
                    options: tally,
                  };
                }),
              })
            );
            break;
          }

          case "POST_QUESTION": {
            const { sessionId, userId: bodyUserId, content } = data;
            const userId = (ws.data as any).currentUser?.id || bodyUserId;
            if (!userId || !content?.trim()) break;

            const result = await postQuestion({ sessionId, userId, content });
            if (!result.ok) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  error: result.code,
                  message: result.body.message ?? result.body.error,
                })
              );
            }
            break;
          }

          case "UPVOTE": {
            const { questionId, userId: bodyUserId } = data;
            const userId = (ws.data as any).currentUser?.id || bodyUserId;
            if (!userId || !questionId) break;

            const result = await upvoteQuestion({ questionId, userId });
            if (!result.ok) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  error: result.code,
                  message: result.body.message ?? result.body.error,
                })
              );
            }
            break;
          }

          case "VOTE_POLL": {
            const { pollId, optionId, userId: bodyUserId } = data;
            const userId = (ws.data as any).currentUser?.id || bodyUserId;
            if (!pollId || !optionId || !userId) break;

            const result = await votePoll({ pollId, optionId, userId });
            if (!result.ok) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  error: result.code,
                  message: result.body.message ?? result.body.error,
                })
              );
            }
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
