import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isHostRole } from "../lib/auth";
import { fail } from "../lib/http";
import { broadcaster } from "../lib/broadcast";

export function pollRoutes(deps: Deps, jwtSecret: string) {
  return new Elysia({ tags: ["polls"] })
    .use(createJwtAuth(jwtSecret))
    .derive(deriveCurrentUser)
    .get(
      "/api/sessions/:sessionId/polls",
      async ({ params, currentUser }) => {
        const polls = await deps.prisma.poll.findMany({
          where: { sessionId: params.sessionId },
          include: {
            options: {
              include: {
                votes: currentUser ? { where: { userId: currentUser.id } } : false,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return {
          sessionId: params.sessionId,
          polls: polls.map((p) => {
            let userVotedOptionId: string | null = null;
            const options = p.options.map((opt) => {
              if (opt.votes && opt.votes.length > 0) {
                userVotedOptionId = opt.id;
              }
              return {
                id: opt.id,
                pollId: opt.pollId,
                content: opt.content,
                voteCount: opt.voteCount,
              };
            });

            return {
              id: p.id,
              sessionId: p.sessionId,
              title: p.title,
              isActive: p.isActive,
              createdAt: p.createdAt,
              options,
              userVotedOptionId,
            };
          }),
        };
      },
      {
        params: t.Object({ sessionId: t.String({ minLength: 1 }) }),
      }
    )
    .post(
      "/api/sessions/:sessionId/polls",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can create polls");
        }

        const options = body.options.map((o) => o.trim()).filter((o) => o.length > 0);
        if (options.length < 2) {
          return fail(set, 400, "INVALID_OPTIONS", "Poll must have at least 2 options");
        }

        const poll = await deps.prisma.poll.create({
          data: {
            sessionId: params.sessionId,
            title: body.title.trim(),
            options: {
              create: options.map((content) => ({ content, voteCount: 0 })),
            },
          },
          include: {
            options: true,
          },
        });

        broadcaster.broadcastQa(params.sessionId, {
          type: "POLL_CREATED",
          poll,
        });

        set.status = 201;
        return { poll };
      },
      {
        params: t.Object({ sessionId: t.String({ minLength: 1 }) }),
        body: t.Object({
          title: t.String({ minLength: 1, maxLength: 200 }),
          options: t.Array(t.String(), { minItems: 2, maxItems: 10 }),
        }),
      }
    )
    .post(
      "/api/polls/:pollId/vote",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }

        const poll = await deps.prisma.poll.findUnique({
          where: { id: params.pollId },
          include: { options: true },
        });
        if (!poll) {
          return fail(set, 404, "POLL_NOT_FOUND", "Poll was not found");
        }
        if (!poll.isActive) {
          return fail(set, 400, "POLL_INACTIVE", "Poll is closed for voting");
        }

        const targetOption = poll.options.find((o) => o.id === body.optionId);
        if (!targetOption) {
          return fail(set, 400, "INVALID_OPTION", "Option does not belong to this poll");
        }

        const eventId = body.eventId ?? poll.sessionId;
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
          // Check if user already voted for any option in this poll
          const existingVote = await tx.pollVote.findFirst({
            where: {
              userId: currentUser.id,
              option: { pollId: poll.id },
            },
          });

          if (existingVote) {
            if (existingVote.optionId === body.optionId) {
              // Same option -> unvote
              await tx.pollVote.delete({ where: { id: existingVote.id } });
              await tx.pollOption.update({
                where: { id: body.optionId },
                data: { voteCount: { decrement: 1 } },
              });
              return { voted: false, optionId: body.optionId };
            } else {
              // Switch option
              await tx.pollVote.delete({ where: { id: existingVote.id } });
              await tx.pollOption.update({
                where: { id: existingVote.optionId },
                data: { voteCount: { decrement: 1 } },
              });

              await tx.pollVote.create({
                data: {
                  optionId: body.optionId,
                  userId: currentUser.id,
                },
              });
              await tx.pollOption.update({
                where: { id: body.optionId },
                data: { voteCount: { increment: 1 } },
              });
              return { voted: true, optionId: body.optionId };
            }
          } else {
            // First time vote
            await tx.pollVote.create({
              data: {
                optionId: body.optionId,
                userId: currentUser.id,
              },
            });
            await tx.pollOption.update({
              where: { id: body.optionId },
              data: { voteCount: { increment: 1 } },
            });
            return { voted: true, optionId: body.optionId };
          }
        });

        broadcaster.broadcastQa(poll.sessionId, {
          type: "POLL_VOTED",
          pollId: poll.id,
          optionId: body.optionId,
          voted: result.voted,
        });

        return {
          pollId: poll.id,
          optionId: result.optionId,
          voted: result.voted,
        };
      },
      {
        params: t.Object({ pollId: t.String({ minLength: 1 }) }),
        body: t.Object({
          optionId: t.String({ minLength: 1 }),
          eventId: t.Optional(t.String()),
        }),
      }
    );
}
