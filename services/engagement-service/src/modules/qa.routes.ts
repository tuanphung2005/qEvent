import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser } from "../lib/auth";
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

        const eventId = body.eventId ?? params.sessionId;
        const verification = await deps.admissionClient.verifyAccess(currentUser.id, eventId);
        if (!verification.hasAccess) {
          return fail(
            set,
            403,
            "NOT_CHECKED_IN",
            "Attendee has not checked in to this event"
          );
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
          eventId: t.Optional(t.String()),
        }),
      }
    )
    .put(
      "/api/questions/:questionId/votes",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }

        const question = await deps.prisma.qAQuestion.findUnique({
          where: { id: params.questionId },
        });
        if (!question) {
          return fail(set, 404, "QUESTION_NOT_FOUND", "Question was not found");
        }

        const eventId = (body as { eventId?: string })?.eventId ?? question.sessionId;
        const verification = await deps.admissionClient.verifyAccess(currentUser.id, eventId);
        if (!verification.hasAccess) {
          return fail(
            set,
            403,
            "NOT_CHECKED_IN",
            "Attendee has not checked in to this event"
          );
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
        body: t.Optional(t.Object({ eventId: t.Optional(t.String()) })),
      }
    );
}
