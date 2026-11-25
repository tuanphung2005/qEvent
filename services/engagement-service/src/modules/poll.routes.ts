import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isHostRole } from "../lib/auth";
import { AccessError, requireSessionAccess } from "../lib/br6";
import { fail } from "../lib/http";
import { requireHostSession } from "../lib/host-access";
import { broadcaster } from "../lib/broadcast";

export function pollRoutes(deps: Deps, jwtSecret: string) {
  return new Elysia({ tags: ["polls"] })
    .use(createJwtAuth(jwtSecret))
    .derive(deriveCurrentUser)
    .get(
      "/api/sessions/:sessionId/polls",
      async ({ params, currentUser, set }) => {
        const denied = await requireHostSession(deps, currentUser, set, params.sessionId);
        if (denied) return denied;

        const polls = await deps.prisma.poll.findMany({
          where: { sessionId: params.sessionId, deletedAt: null },
          include: {
            options: {
              include: {
                votes: currentUser ? { where: { userId: currentUser.id } } : false,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        // Hosts moderate polls, so they also see what can be restored.
        const deleted = isHostRole(currentUser?.role)
          ? await deps.prisma.poll.findMany({
              where: { sessionId: params.sessionId, deletedAt: { not: null } },
              orderBy: { deletedAt: "desc" },
            })
          : [];

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
          ...(isHostRole(currentUser?.role)
            ? {
                deletedPolls: deleted.map((p) => ({
                  id: p.id,
                  title: p.title,
                  deletedAt: p.deletedAt,
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
      "/api/sessions/:sessionId/polls",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can create polls");
        }

        const denied = await requireHostSession(deps, currentUser, set, params.sessionId);
        if (denied) return denied;

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
        if (!poll || poll.deletedAt) {
          return fail(set, 404, "POLL_NOT_FOUND", "Poll was not found");
        }
        if (!poll.isActive) {
          return fail(set, 400, "POLL_INACTIVE", "Poll is closed for voting");
        }

        const targetOption = poll.options.find((o) => o.id === body.optionId);
        if (!targetOption) {
          return fail(set, 400, "INVALID_OPTION", "Option does not belong to this poll");
        }

        try {
          await requireSessionAccess(deps, currentUser.id, poll.sessionId);
        } catch (error) {
          if (error instanceof AccessError) {
            return fail(set, error.status, error.code, error.message);
          }
          throw error;
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
        }),
      }
    )
    .patch(
      "/api/polls/:pollId",
      async ({ params, body, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can update polls");
        }

        const poll = await deps.prisma.poll.findUnique({
          where: { id: params.pollId },
          include: { options: true },
        });
        if (!poll || poll.deletedAt) {
          return fail(set, 404, "POLL_NOT_FOUND", "Poll was not found");
        }

        const denied = await requireHostSession(deps, currentUser, set, poll.sessionId);
        if (denied) return denied;

        if (body.title === undefined && body.isActive === undefined && body.options === undefined) {
          return fail(set, 400, "NO_CHANGES", "Nothing to update");
        }

        const options = body.options
          ? body.options.map((option) => option.trim()).filter((option) => option.length > 0)
          : null;
        if (options && options.length < 2) {
          return fail(set, 400, "INVALID_OPTIONS", "Poll must have at least 2 options");
        }
        if (options && poll.options.length > 0) {
          // Votes are attached to option ids; replacing the option set clears them.
          await deps.prisma.$transaction(async (tx) => {
            await tx.pollVote.deleteMany({ where: { option: { pollId: poll.id } } });
            await tx.pollOption.deleteMany({ where: { pollId: poll.id } });
            for (const content of options) {
              await tx.pollOption.create({ data: { pollId: poll.id, content } });
            }
          });
        }

        const updated = await deps.prisma.poll.update({
          where: { id: poll.id },
          data: {
            title: body.title?.trim(),
            isActive: body.isActive,
          },
          include: { options: true },
        });

        broadcaster.broadcastQa(poll.sessionId, {
          type: "POLL_UPDATED",
          pollId: updated.id,
          isActive: updated.isActive,
        });

        return { poll: updated };
      },
      {
        params: t.Object({ pollId: t.String({ minLength: 1 }) }),
        body: t.Object({
          title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
          isActive: t.Optional(t.Boolean()),
          options: t.Optional(t.Array(t.String(), { minItems: 2, maxItems: 10 })),
        }),
      }
    )
    .delete(
      "/api/polls/:pollId",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can delete polls");
        }

        const poll = await deps.prisma.poll.findUnique({
          where: { id: params.pollId },
        });
        if (!poll || poll.deletedAt) {
          return fail(set, 404, "POLL_NOT_FOUND", "Poll was not found");
        }

        const denied = await requireHostSession(deps, currentUser, set, poll.sessionId);
        if (denied) return denied;

        // Soft delete: options and votes survive, so a restore is lossless.
        await deps.prisma.poll.update({
          where: { id: poll.id },
          data: { deletedAt: new Date() },
        });
        broadcaster.broadcastQa(poll.sessionId, {
          type: "POLL_DELETED",
          pollId: poll.id,
        });

        set.status = 204;
      },
      {
        params: t.Object({ pollId: t.String({ minLength: 1 }) }),
      }
    )
    .post(
      "/api/polls/:pollId/restore",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can restore polls");
        }

        const poll = await deps.prisma.poll.findUnique({
          where: { id: params.pollId },
        });
        if (!poll || !poll.deletedAt) {
          return fail(set, 404, "POLL_NOT_FOUND", "Deleted poll was not found");
        }

        const denied = await requireHostSession(deps, currentUser, set, poll.sessionId);
        if (denied) return denied;

        const restored = await deps.prisma.poll.update({
          where: { id: poll.id },
          data: { deletedAt: null },
          include: { options: true },
        });
        broadcaster.broadcastQa(poll.sessionId, {
          type: "POLL_CREATED",
          poll: restored,
        });

        return { poll: restored };
      },
      {
        params: t.Object({ pollId: t.String({ minLength: 1 }) }),
      }
    );
}
