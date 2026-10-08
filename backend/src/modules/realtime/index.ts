import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
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

/**
 * Determine if a session is currently within its live event window
 */
export async function getSessionLiveStatus(sessionId: string): Promise<{
  session: any;
  isLive: boolean;
  status: "UPCOMING" | "LIVE" | "ENDED";
}> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { event: true },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // If session is explicitly toggled live
  if (session.isLive) {
    return { session, isLive: true, status: "LIVE" };
  }

  const now = new Date();
  const startTime = new Date(session.startTime);
  const endTime = new Date(session.endTime);

  if (now < startTime) {
    return { session, isLive: false, status: "UPCOMING" };
  }
  if (now > endTime) {
    return { session, isLive: false, status: "ENDED" };
  }

  return { session, isLive: true, status: "LIVE" };
}

/**
 * Check if a user has checked in for the event corresponding to a session
 */
export async function checkUserSessionAccess(
  sessionId: string,
  userId?: string | null
): Promise<{
  isRegistered: boolean;
  isCheckedIn: boolean;
  role: string;
}> {
  if (!userId) {
    return { isRegistered: false, isCheckedIn: false, role: "GUEST" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return { isRegistered: false, isCheckedIn: false, role: "GUEST" };
  }

  // Staff, Organizer, Speaker have full interaction access
  if (user.role === "STAFF" || user.role === "ORGANIZER" || user.role === "SPEAKER") {
    return { isRegistered: true, isCheckedIn: true, role: user.role };
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { eventId: true },
  });

  if (!session) {
    return { isRegistered: false, isCheckedIn: false, role: user.role };
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      eventId: session.eventId,
      userId: user.id,
    },
  });

  if (!ticket) {
    return { isRegistered: false, isCheckedIn: false, role: user.role };
  }

  return {
    isRegistered: true,
    isCheckedIn: ticket.status === "CHECKED_IN",
    role: user.role,
  };
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
    // Unvote
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
    // Vote
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
  // REST: Fetch questions, polls, and live session status
  .get("/api/qa/session/:sessionId", async ({ params, query, currentUser, set }) => {
    try {
      const { session, isLive, status } = await getSessionLiveStatus(params.sessionId);
      const effectiveUserId = currentUser?.id || query.userId;
      const access = await checkUserSessionAccess(params.sessionId, effectiveUserId);

      const questions = await prisma.qAQuestion.findMany({
        where: { sessionId: params.sessionId },
        include: {
          user: { select: { id: true, fullName: true } },
          votes: { select: { userId: true } },
        },
        orderBy: [{ isPinned: "desc" }, { upvotes: "desc" }],
      });

      const polls = await prisma.poll.findMany({
        where: { sessionId: params.sessionId },
        include: {
          options: {
            include: {
              _count: { select: { votes: true } },
            },
          },
          votes: effectiveUserId ? { where: { userId: effectiveUserId } } : false,
        },
        orderBy: { createdAt: "desc" },
      });

      const formattedPolls = polls.map((p) => {
        const totalVotes = p.options.reduce((sum, opt) => sum + opt._count.votes, 0);
        return {
          id: p.id,
          question: p.question,
          isActive: p.isActive,
          createdAt: p.createdAt,
          totalVotes,
          userVotedOptionId: p.votes && p.votes.length > 0 ? p.votes[0].optionId : null,
          options: p.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            voteCount: opt._count.votes,
            percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
          })),
        };
      });

      return {
        sessionId: session.id,
        sessionTitle: session.title,
        eventId: session.eventId,
        isLive,
        sessionStatus: status,
        userAccess: {
          isRegistered: access.isRegistered,
          isCheckedIn: access.isCheckedIn,
          canInteract: isLive && access.isCheckedIn,
          role: access.role,
        },
        questions,
        polls: formattedPolls,
      };
    } catch (err: any) {
      set.status = 404;
      return { error: err.message || "Session not found" };
    }
  })
  // REST: Post Q&A question (Gated: Live Event & Checked-in)
  .post(
    "/api/qa/question",
    async ({ body, currentUser, set }) => {
      const { sessionId, userId: bodyUserId, content } = body;
      const effectiveUserId = currentUser?.id || bodyUserId;

      if (!effectiveUserId) {
        set.status = 401;
        return { error: "Vui lòng đăng nhập để gửi câu hỏi" };
      }

      // 1. Check if session/event is currently LIVE
      const { isLive } = await getSessionLiveStatus(sessionId);
      if (!isLive) {
        set.status = 403;
        return {
          error: "EVENT_NOT_LIVE",
          message: "Phiên hỏi đáp chỉ hoạt động trong thời gian sự kiện đang diễn ra",
        };
      }

      // 2. Check if attendee is CHECKED_IN
      const access = await checkUserSessionAccess(sessionId, effectiveUserId);
      if (!access.isCheckedIn) {
        set.status = 403;
        return {
          error: "NOT_CHECKED_IN",
          message: "Bạn cần điểm danh tại cổng để kích hoạt quyền đặt câu hỏi",
        };
      }

      const question = await prisma.qAQuestion.create({
        data: {
          sessionId,
          userId: effectiveUserId,
          content: content.trim(),
        },
        include: {
          user: { select: { id: true, fullName: true } },
          votes: { select: { userId: true } },
        },
      });

      // Broadcast to all active clients in session
      broadcastToSession(sessionId, {
        type: "QUESTION_ADDED",
        question,
      });
      // Compatibility with mobile app client event name
      broadcastToSession(sessionId, {
        type: "NEW_QUESTION",
        question,
      });

      return { question };
    },
    {
      body: t.Object({
        sessionId: t.String(),
        userId: t.Optional(t.String()),
        content: t.String(),
      }),
    }
  )
  // REST: Upvote Q&A question (Gated: Live Event & Checked-in)
  .post(
    "/api/qa/upvote/:questionId",
    async ({ params, body, currentUser, set }) => {
      const effectiveUserId = currentUser?.id || (body as any)?.userId;
      if (!effectiveUserId) {
        set.status = 401;
        return { error: "Vui lòng đăng nhập để bình chọn" };
      }

      const targetQuestion = await prisma.qAQuestion.findUnique({
        where: { id: params.questionId },
      });
      if (!targetQuestion) {
        set.status = 404;
        return { error: "Question not found" };
      }

      // Check live status
      const { isLive } = await getSessionLiveStatus(targetQuestion.sessionId);
      if (!isLive) {
        set.status = 403;
        return {
          error: "EVENT_NOT_LIVE",
          message: "Chỉ có thể bình chọn câu hỏi trong thời gian sự kiện diễn ra",
        };
      }

      // Check check-in status
      const access = await checkUserSessionAccess(targetQuestion.sessionId, effectiveUserId);
      if (!access.isCheckedIn) {
        set.status = 403;
        return {
          error: "NOT_CHECKED_IN",
          message: "Bạn cần điểm danh tại cổng để tham gia bình chọn câu hỏi",
        };
      }

      const { question, hasVoted } = await handleToggleVote(params.questionId, effectiveUserId);

      broadcastToSession(question.sessionId, {
        type: "VOTE_UPDATED",
        questionId: question.id,
        upvotes: question.upvotes,
        userId: effectiveUserId,
        hasVoted,
      });
      broadcastToSession(question.sessionId, {
        type: "QUESTION_UPVOTED",
        questionId: question.id,
        upvotes: question.upvotes,
      });

      return { question, hasVoted, upvotes: question.upvotes };
    },
    {
      body: t.Object({
        userId: t.Optional(t.String()),
      }),
    }
  )
  // REST: Presenter / Speaker Answers Q&A question
  .post(
    "/api/qa/question/:questionId/answer",
    async ({ params, body, currentUser, set }) => {
      const question = await prisma.qAQuestion.findUnique({
        where: { id: params.questionId },
      });

      if (!question) {
        set.status = 404;
        return { error: "Question not found" };
      }

      const { answerText } = body as any;
      const updated = await prisma.qAQuestion.update({
        where: { id: params.questionId },
        data: {
          isAnswered: true,
          answerText: answerText ? String(answerText).trim() : question.answerText,
        },
        include: {
          user: { select: { id: true, fullName: true } },
          votes: { select: { userId: true } },
        },
      });

      broadcastToSession(question.sessionId, {
        type: "QUESTION_ANSWERED",
        question: updated,
      });

      return {
        message: "Đã cập nhật câu trả lời của presenter",
        question: updated,
      };
    },
    {
      body: t.Object({
        answerText: t.Optional(t.String()),
      }),
    }
  )
  // REST: Presenter / Speaker Pins Q&A question on screen
  .post("/api/qa/question/:questionId/pin", async ({ params, set }) => {
    const question = await prisma.qAQuestion.findUnique({
      where: { id: params.questionId },
    });

    if (!question) {
      set.status = 404;
      return { error: "Question not found" };
    }

    const updated = await prisma.qAQuestion.update({
      where: { id: params.questionId },
      data: { isPinned: !question.isPinned },
      include: {
        user: { select: { id: true, fullName: true } },
        votes: { select: { userId: true } },
      },
    });

    broadcastToSession(question.sessionId, {
      type: "QUESTION_PINNED",
      questionId: updated.id,
      isPinned: updated.isPinned,
      question: updated,
    });

    return { question: updated, isPinned: updated.isPinned };
  })
  // REST: Get Polls (Interactive Questions) for Session
  .get("/api/qa/session/:sessionId/polls", async ({ params, query, currentUser }) => {
    const effectiveUserId = currentUser?.id || query.userId;
    const polls = await prisma.poll.findMany({
      where: { sessionId: params.sessionId },
      include: {
        options: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        votes: effectiveUserId ? { where: { userId: effectiveUserId } } : false,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedPolls = polls.map((p) => {
      const totalVotes = p.options.reduce((sum, opt) => sum + opt._count.votes, 0);
      return {
        id: p.id,
        question: p.question,
        isActive: p.isActive,
        createdAt: p.createdAt,
        totalVotes,
        userVotedOptionId: p.votes && p.votes.length > 0 ? p.votes[0].optionId : null,
        options: p.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt._count.votes,
          percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
        })),
      };
    });

    return { polls: formattedPolls };
  })
  // REST: Create Poll (Interactive Question) - Organizers / Speakers
  .post(
    "/api/qa/session/:sessionId/poll",
    async ({ params, body, set }) => {
      const { question, options } = body;
      if (!options || options.length < 2) {
        set.status = 400;
        return { error: "Câu hỏi tương tác cần ít nhất 2 phương án lựa chọn" };
      }

      const poll = await prisma.poll.create({
        data: {
          sessionId: params.sessionId,
          question: question.trim(),
          options: {
            create: options.map((opt: string) => ({ text: opt.trim() })),
          },
        },
        include: {
          options: {
            include: { _count: { select: { votes: true } } },
          },
        },
      });

      broadcastToSession(params.sessionId, {
        type: "POLL_CREATED",
        poll: {
          id: poll.id,
          question: poll.question,
          isActive: poll.isActive,
          options: poll.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            voteCount: 0,
            percentage: 0,
          })),
        },
      });

      set.status = 201;
      return { poll };
    },
    {
      body: t.Object({
        question: t.String(),
        options: t.Array(t.String()),
      }),
    }
  )
  // REST: Vote on Interactive Question / Poll (Gated: Live Event & Checked-in)
  .post(
    "/api/qa/poll/:pollId/vote",
    async ({ params, body, currentUser, set }) => {
      const { optionId, userId: bodyUserId } = body;
      const effectiveUserId = currentUser?.id || bodyUserId;

      if (!effectiveUserId) {
        set.status = 401;
        return { error: "Vui lòng đăng nhập để bình chọn" };
      }

      const poll = await prisma.poll.findUnique({
        where: { id: params.pollId },
        include: { session: true },
      });

      if (!poll) {
        set.status = 404;
        return { error: "Poll not found" };
      }

      if (!poll.isActive) {
        set.status = 400;
        return { error: "POLL_CLOSED", message: "Câu hỏi tương tác này đã đóng" };
      }

      // Check live status
      const { isLive } = await getSessionLiveStatus(poll.sessionId);
      if (!isLive) {
        set.status = 403;
        return {
          error: "EVENT_NOT_LIVE",
          message: "Câu hỏi tương tác chỉ mở trong thời gian sự kiện diễn ra",
        };
      }

      // Check check-in status
      const access = await checkUserSessionAccess(poll.sessionId, effectiveUserId);
      if (!access.isCheckedIn) {
        set.status = 403;
        return {
          error: "NOT_CHECKED_IN",
          message: "Bạn cần điểm danh tại cổng để tham gia trả lời câu hỏi tương tác",
        };
      }

      // Upsert vote (one vote per user per poll)
      await prisma.pollVote.upsert({
        where: {
          pollId_userId: {
            pollId: poll.id,
            userId: effectiveUserId,
          },
        },
        create: {
          pollId: poll.id,
          optionId,
          userId: effectiveUserId,
        },
        update: {
          optionId,
        },
      });

      // Recalculate tally
      const updatedPoll = await prisma.poll.findUnique({
        where: { id: poll.id },
        include: {
          options: {
            include: { _count: { select: { votes: true } } },
          },
        },
      });

      const totalVotes = updatedPoll?.options.reduce((sum, opt) => sum + opt._count.votes, 0) || 0;
      const tally = updatedPoll?.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        voteCount: opt._count.votes,
        percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
      }));

      broadcastToSession(poll.sessionId, {
        type: "POLL_VOTED",
        pollId: poll.id,
        totalVotes,
        tally,
      });

      return {
        pollId: poll.id,
        totalVotes,
        tally,
        userVotedOptionId: optionId,
      };
    },
    {
      body: t.Object({
        optionId: t.String(),
        userId: t.Optional(t.String()),
      }),
    }
  )
  // REST: Toggle Poll Active Status
  .patch("/api/qa/poll/:pollId/toggle", async ({ params, body, set }) => {
    const poll = await prisma.poll.findUnique({ where: { id: params.pollId } });
    if (!poll) {
      set.status = 404;
      return { error: "Poll not found" };
    }

    const newStatus = (body as any)?.isActive !== undefined ? Boolean((body as any).isActive) : !poll.isActive;
    const updated = await prisma.poll.update({
      where: { id: params.pollId },
      data: { isActive: newStatus },
    });

    broadcastToSession(poll.sessionId, {
      type: "POLL_TOGGLED",
      pollId: updated.id,
      isActive: updated.isActive,
    });

    return { poll: updated };
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
