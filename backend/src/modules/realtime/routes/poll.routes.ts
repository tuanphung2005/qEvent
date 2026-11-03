import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { JWT_CONFIG, deriveCurrentUser } from "../../../lib/auth";
import { prisma } from "../../../plugins/prisma";
import { broadcastToSession } from "../services/broadcast.service";
import { formatPoll } from "../services/poll-format.service";
import { votePoll } from "../services/qa.service";
import { createPollBody, votePollBody } from "../schemas";

export const pollRoutes = new Elysia()
  .use(jwt(JWT_CONFIG))
  .derive(deriveCurrentUser)
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

    return { polls: polls.map(formatPoll) };
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

      const result = await votePoll({
        pollId: params.pollId,
        optionId,
        userId: currentUser?.id || bodyUserId,
      });

      if (!result.ok) {
        set.status = result.status;
        return result.body;
      }

      return {
        pollId: result.pollId,
        totalVotes: result.totalVotes,
        tally: result.tally,
        userVotedOptionId: result.userVotedOptionId,
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
