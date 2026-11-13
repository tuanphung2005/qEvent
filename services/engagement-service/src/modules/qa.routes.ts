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
      async ({ params }) => {
        const questions = await deps.prisma.qAQuestion.findMany({
          where: { sessionId: params.sessionId },
          include: {
            votes: { select: { userId: true } },
          },
          orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
        });

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
        if (!question) {
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
        if (!question) {
          return fail(set, 404, "QUESTION_NOT_FOUND", "Question was not found");
        }

        await deps.prisma.qAQuestion.delete({ where: { id: question.id } });
        broadcaster.broadcastQa(question.sessionId, {
          type: "QUESTION_DELETED",
          questionId: question.id,
        });

        set.status = 204;
      },
      { params: t.Object({ questionId: t.String({ minLength: 1 }) }) }
    );
}
