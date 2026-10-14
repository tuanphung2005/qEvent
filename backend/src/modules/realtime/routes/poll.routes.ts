import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { broadcastToSession } from "../services/broadcast.service";
import { getSessionLiveStatus, checkUserSessionAccess } from "../services/session-access.service";
import { createPollBody, votePollBody } from "../schemas";

export const pollRoutes = new Elysia()
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
      body: createPollBody,
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
      body: votePollBody,
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
  });
