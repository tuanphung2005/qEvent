import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { broadcastToSession } from "../services/broadcast.service";
import { getSessionLiveStatus, checkUserSessionAccess, handleToggleVote, MODERATOR_ROLES } from "../services/session-access.service";
import { clusterSessionQuestions, CLUSTER_COOLDOWN_MS } from "../services/qa-cluster.service";
import { AI_ENABLED, aiErrorCode, aiErrorStatus } from "../../../services/ai.service";
import { postQuestionBody, upvoteBody, answerQuestionBody } from "../schemas";

export const qaRoutes = new Elysia()
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
      body: postQuestionBody,
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
      body: upvoteBody,
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
      body: answerQuestionBody,
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
  // Host: cluster questions by meaning with AI
  .post("/api/qa/cluster/:sessionId", async ({ params, query, currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    // Session phải tồn tại (nếu không, count = 0 sẽ trả 422 gây hiểu nhầm)
    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { id: true },
    });
    if (!session) {
      set.status = 404;
      return { error: "SESSION_NOT_FOUND" };
    }

    // Phân quyền: chỉ moderator của phiên (organizer/speaker/staff)
    const access = await checkUserSessionAccess(params.sessionId, currentUser.id);
    if (!MODERATOR_ROLES.includes(access.role)) {
      set.status = 403;
      return { error: "FORBIDDEN", message: "Chỉ người điều phối mới được gom nhóm câu hỏi" };
    }

    if (!AI_ENABLED) {
      set.status = 503;
      return { error: "AI_NOT_CONFIGURED", message: "Server chưa cấu hình GEMINI_API_KEY" };
    }

    // Cooldown bền vững (đọc từ DB → sống sót qua restart / nhiều instance)
    const latest = await prisma.qAQuestion.findFirst({
      where: { sessionId: params.sessionId, clusteredAt: { not: null } },
      orderBy: { clusteredAt: "desc" },
      select: { clusteredAt: true },
    });
    if (latest?.clusteredAt && Date.now() - latest.clusteredAt.getTime() < CLUSTER_COOLDOWN_MS) {
      set.status = 429;
      return { error: "CLUSTER_COOLDOWN", message: "Vui lòng đợi vài giây rồi thử lại" };
    }

    try {
      const limit = Number(query.limit) || 200;
      const result = await clusterSessionQuestions(params.sessionId, { limit });

      if (result.clusters.length === 0) {
        set.status = 422;
        return { error: "NO_QUESTIONS", message: "Chưa có câu hỏi nào để gom nhóm" };
      }

      broadcastToSession(params.sessionId, {
        type: "QUESTIONS_CLUSTERED",
        sessionId: params.sessionId,
        clusters: result.clusters.map(({ id, label, questionIds, representativeId, mergedUpvotes }) => ({
          id,
          label,
          questionIds,
          representativeId,
          mergedUpvotes,
        })),
      });

      return {
        clustered: result.clusters.length,
        considered: result.considered,
        truncated: result.truncated,
        clusters: result.clusters,
      };
    } catch (err) {
      set.status = aiErrorStatus(err);
      return { error: aiErrorCode(err), message: (err as Error).message };
    }
  });
