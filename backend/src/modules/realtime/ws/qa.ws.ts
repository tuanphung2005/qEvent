import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { sessionSubscribers, broadcastToSession } from "../services/broadcast.service";
import { getSessionLiveStatus, checkUserSessionAccess, handleToggleVote } from "../services/session-access.service";

export const qaWs = new Elysia()
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
                  const total = p.options.reduce((sum, o) => sum + o._count.votes, 0);
                  return {
                    id: p.id,
                    question: p.question,
                    isActive: p.isActive,
                    totalVotes: total,
                    options: p.options.map((o) => ({
                      id: o.id,
                      text: o.text,
                      voteCount: o._count.votes,
                      percentage: total > 0 ? Math.round((o._count.votes / total) * 100) : 0,
                    })),
                  };
                }),
              })
            );
            break;
          }

          case "POST_QUESTION": {
            const { sessionId, userId, content } = data;
            if (!userId || !content?.trim()) break;

            const { isLive } = await getSessionLiveStatus(sessionId);
            if (!isLive) {
              ws.send(JSON.stringify({ type: "ERROR", error: "EVENT_NOT_LIVE", message: "Sự kiện chưa bắt đầu" }));
              break;
            }

            const access = await checkUserSessionAccess(sessionId, userId);
            if (!access.isCheckedIn) {
              ws.send(JSON.stringify({ type: "ERROR", error: "NOT_CHECKED_IN", message: "Cần điểm danh tại cổng" }));
              break;
            }

            const question = await prisma.qAQuestion.create({
              data: { sessionId, userId, content: content.trim() },
              include: {
                user: { select: { id: true, fullName: true } },
                votes: { select: { userId: true } },
              },
            });

            broadcastToSession(sessionId, {
              type: "QUESTION_ADDED",
              question,
            });
            broadcastToSession(sessionId, {
              type: "NEW_QUESTION",
              question,
            });
            break;
          }

          case "UPVOTE": {
            const { questionId, userId } = data;
            if (!userId || !questionId) break;

            const q = await prisma.qAQuestion.findUnique({ where: { id: questionId } });
            if (!q) break;

            const { isLive } = await getSessionLiveStatus(q.sessionId);
            if (!isLive) {
              ws.send(JSON.stringify({ type: "ERROR", error: "EVENT_NOT_LIVE", message: "Sự kiện chưa bắt đầu" }));
              break;
            }

            const access = await checkUserSessionAccess(q.sessionId, userId);
            if (!access.isCheckedIn) {
              ws.send(JSON.stringify({ type: "ERROR", error: "NOT_CHECKED_IN", message: "Cần điểm danh tại cổng" }));
              break;
            }

            const { question, hasVoted } = await handleToggleVote(questionId, userId);

            broadcastToSession(question.sessionId, {
              type: "VOTE_UPDATED",
              questionId: question.id,
              upvotes: question.upvotes,
              userId,
              hasVoted,
            });
            broadcastToSession(question.sessionId, {
              type: "QUESTION_UPVOTED",
              questionId: question.id,
              upvotes: question.upvotes,
            });
            break;
          }

          case "VOTE_POLL": {
            const { pollId, optionId, userId } = data;
            if (!pollId || !optionId || !userId) break;

            const poll = await prisma.poll.findUnique({ where: { id: pollId } });
            if (!poll || !poll.isActive) break;

            const { isLive } = await getSessionLiveStatus(poll.sessionId);
            if (!isLive) break;

            const access = await checkUserSessionAccess(poll.sessionId, userId);
            if (!access.isCheckedIn) break;

            await prisma.pollVote.upsert({
              where: {
                pollId_userId: { pollId, userId },
              },
              create: { pollId, optionId, userId },
              update: { optionId },
            });

            const updatedPoll = await prisma.poll.findUnique({
              where: { id: poll.id },
              include: {
                options: { include: { _count: { select: { votes: true } } } },
              },
            });

            const total = updatedPoll?.options.reduce((sum, o) => sum + o._count.votes, 0) || 0;
            const tally = updatedPoll?.options.map((o) => ({
              id: o.id,
              text: o.text,
              voteCount: o._count.votes,
              percentage: total > 0 ? Math.round((o._count.votes / total) * 100) : 0,
            }));

            broadcastToSession(poll.sessionId, {
              type: "POLL_VOTED",
              pollId: poll.id,
              totalVotes: total,
              tally,
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
