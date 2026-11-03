import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { JWT_CONFIG, deriveCurrentUser } from "../../../lib/auth";
import { prisma } from "../../../plugins/prisma";
import { broadcastToSession } from "../services/broadcast.service";
import { getSessionLiveStatus, checkUserSessionAccess, MODERATOR_ROLES } from "../services/session-access.service";
import { formatPoll } from "../services/poll-format.service";
import { postQuestion, upvoteQuestion } from "../services/qa.service";
import { clusterSessionQuestions, CLUSTER_COOLDOWN_MS } from "../services/qa-cluster.service";
import { AI_ENABLED, aiErrorCode, aiErrorStatus } from "../../../services/ai.service";
import { postQuestionBody, upvoteBody, answerQuestionBody } from "../schemas";

export const qaRoutes = new Elysia()
  .use(jwt(JWT_CONFIG))
  .derive(deriveCurrentUser)
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

      const formattedPolls = polls.map(formatPoll);

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

      const result = await postQuestion({
        sessionId,
        userId: currentUser?.id || bodyUserId,
        content,
      });

      if (!result.ok) {
        set.status = result.status;
        return result.body;
      }

      return { question: result.question };
    },
    {
      body: postQuestionBody,
    }
  )
  // REST: Upvote Q&A question (Gated: Live Event & Checked-in)
  .post(
    "/api/qa/upvote/:questionId",
    async ({ params, body, currentUser, set }) => {
      const result = await upvoteQuestion({
        questionId: params.questionId,
        userId: currentUser?.id || (body as any)?.userId,
      });

      if (!result.ok) {
        set.status = result.status;
        return result.body;
      }

      return {
        question: result.question,
        hasVoted: result.hasVoted,
        upvotes: result.question.upvotes,
      };
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
      const msg = (err as Error).message;
      if (msg === "CLUSTER_COOLDOWN") {
        set.status = 429;
        return { error: "CLUSTER_COOLDOWN", message: "Vui lòng đợi vài giây rồi thử lại" };
      }
      set.status = aiErrorStatus(err);
      return { error: aiErrorCode(err), message: msg };
    }
  });
