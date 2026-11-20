import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isHostRole } from "../lib/auth";
import { AccessError, requireSessionAccess } from "../lib/br6";
import { fail } from "../lib/http";
import { broadcaster } from "../lib/broadcast";

export function qaRoutes(deps: Deps, jwtSecret: string) {
  return new Elysia({ tags: ["qa"] })
    .use(createJwtAuth(jwtSecret))
    .derive(deriveCurrentUser)
    .get(
      "/api/sessions/:sessionId/questions",
      async ({ params, currentUser }) => {
        const questions = await deps.prisma.qAQuestion.findMany({
          where: { sessionId: params.sessionId, deletedAt: null },
          include: {
            votes: { select: { userId: true } },
          },
          orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
        });

        // Hosts moderate the list, so they also see what can be restored.
        const deleted = isHostRole(currentUser?.role)
          ? await deps.prisma.qAQuestion.findMany({
              where: { sessionId: params.sessionId, deletedAt: { not: null } },
              orderBy: { deletedAt: "desc" },
            })
          : [];

        return {
          sessionId: params.sessionId,
          questions: questions.map((q) => ({
            id: q.id,
            sessionId: q.sessionId,
            userId: q.userId,
            content: q.content,
            upvotes: q.upvotes,
            createdAt: q.createdAt,
            votedUserIds: q.votes.map((v) => v.userId),
          })),
          ...(isHostRole(currentUser?.role)
            ? {
                deletedQuestions: deleted.map((q) => ({
                  id: q.id,
                  content: q.content,
                  deletedAt: q.deletedAt,
                })),
              }
            : {}),
        };
      },
      {
        params: t.Object({ sessionId: t.String({ minLength: 1 }) }),
      }
    )
    .post(
      "/api/sessions/:sessionId/questions",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }

        try {
          await requireSessionAccess(deps, currentUser.id, params.sessionId);
        } catch (error) {
          if (error instanceof AccessError) {
            return fail(set, error.status, error.code, error.message);
          }
          throw error;
        }

        const question = await deps.prisma.qAQuestion.create({
          data: {
            sessionId: params.sessionId,
            userId: currentUser.id,
            content: body.content.trim(),
            upvotes: 0,
          },
        });

        broadcaster.broadcastQa(params.sessionId, {
          type: "NEW_QUESTION",
          question,
        });

        set.status = 201;
        return { question };
      },
      {
        params: t.Object({ sessionId: t.String({ minLength: 1 }) }),
        body: t.Object({
          content: t.String({ minLength: 1, maxLength: 500 }),
        }),
      }
    )
    .put(
      "/api/questions/:questionId/votes",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }

        const question = await deps.prisma.qAQuestion.findUnique({
          where: { id: params.questionId },
        });
        if (!question || question.deletedAt) {
          return fail(set, 404, "QUESTION_NOT_FOUND", "Question was not found");
        }

        try {
          await requireSessionAccess(deps, currentUser.id, question.sessionId);
        } catch (error) {
          if (error instanceof AccessError) {
            return fail(set, error.status, error.code, error.message);
          }
          throw error;
        }

        const result = await deps.prisma.$transaction(async (tx) => {
          const existingVote = await tx.qAVote.findUnique({
            where: {
              questionId_userId: {
                questionId: question.id,
                userId: currentUser.id,
              },
            },
          });

          if (existingVote) {
            await tx.qAVote.delete({
              where: { id: existingVote.id },
            });
            const updated = await tx.qAQuestion.update({
              where: { id: question.id },
              data: { upvotes: { decrement: 1 } },
            });
            return { upvotes: Math.max(0, updated.upvotes), hasVoted: false };
          } else {
            await tx.qAVote.create({
              data: {
                questionId: question.id,
                userId: currentUser.id,
              },
            });
            const updated = await tx.qAQuestion.update({
              where: { id: question.id },
              data: { upvotes: { increment: 1 } },
            });
            return { upvotes: updated.upvotes, hasVoted: true };
          }
        });

        broadcaster.broadcastQa(question.sessionId, {
          type: "QUESTION_VOTED",
          questionId: question.id,
          upvotes: result.upvotes,
        });

        return {
          questionId: question.id,
          upvotes: result.upvotes,
          hasVoted: result.hasVoted,
        };
      },
      {
        params: t.Object({ questionId: t.String({ minLength: 1 }) }),
      }
    )
    .patch(
      "/api/questions/:questionId",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can edit questions");
        }

        const question = await deps.prisma.qAQuestion.findUnique({
          where: { id: params.questionId },
        });
        if (!question || question.deletedAt) {
          return fail(set, 404, "QUESTION_NOT_FOUND", "Question was not found");
        }

        const updated = await deps.prisma.qAQuestion.update({
          where: { id: question.id },
          data: { content: body.content.trim() },
        });
        broadcaster.broadcastQa(question.sessionId, {
          type: "QUESTION_UPDATED",
          question: updated,
        });

        return { question: updated };
      },
      {
        params: t.Object({ questionId: t.String({ minLength: 1 }) }),
        body: t.Object({ content: t.String({ minLength: 1, maxLength: 500 }) }),
      }
    )
    .delete(
      "/api/questions/:questionId",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can delete questions");
        }

        const question = await deps.prisma.qAQuestion.findUnique({
          where: { id: params.questionId },
        });
        if (!question || question.deletedAt) {
          return fail(set, 404, "QUESTION_NOT_FOUND", "Question was not found");
        }

        // Soft delete: votes and upvotes survive, so a restore is lossless.
        await deps.prisma.qAQuestion.update({
          where: { id: question.id },
          data: { deletedAt: new Date() },
        });
        broadcaster.broadcastQa(question.sessionId, {
          type: "QUESTION_DELETED",
          questionId: question.id,
        });

        set.status = 204;
      },
      { params: t.Object({ questionId: t.String({ minLength: 1 }) }) }
    )
    .post(
      "/api/questions/:questionId/restore",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can restore questions");
        }

        const question = await deps.prisma.qAQuestion.findUnique({
          where: { id: params.questionId },
        });
        if (!question || !question.deletedAt) {
          return fail(set, 404, "QUESTION_NOT_FOUND", "Deleted question was not found");
        }

        const restored = await deps.prisma.qAQuestion.update({
          where: { id: question.id },
          data: { deletedAt: null },
        });
        broadcaster.broadcastQa(question.sessionId, {
          type: "NEW_QUESTION",
          question: restored,
        });

        return { question: restored };
      },
      { params: t.Object({ questionId: t.String({ minLength: 1 }) }) }
    );
}
