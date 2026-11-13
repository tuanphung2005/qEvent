import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser, isHostRole } from "../lib/auth";
import { fail } from "../lib/http";

export function statsRoutes(deps: Deps, jwtSecret: string) {
  return new Elysia({ tags: ["stats"] })
    .use(createJwtAuth(jwtSecret))
    .derive(deriveCurrentUser)
    .get(
      "/api/sessions/:sessionId/stats",
      async ({ params, currentUser, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (!isHostRole(currentUser.role)) {
          return fail(set, 403, "FORBIDDEN", "Only staff or organizer can read session stats");
        }

        const [questions, polls, game] = await Promise.all([
          deps.prisma.qAQuestion.findMany({
            where: { sessionId: params.sessionId },
            include: { votes: { select: { userId: true } } },
          }),
          deps.prisma.poll.findMany({
            where: { sessionId: params.sessionId },
            include: { options: true },
          }),
          deps.prisma.quizGame.findUnique({
            where: { sessionId: params.sessionId },
            include: { questions: { select: { id: true } } },
          }),
        ]);

        const topQuestion = [...questions].sort((a, b) => b.upvotes - a.upvotes)[0] ?? null;
        const activePoll = polls.find((poll) => poll.isActive) ?? null;

        return {
          sessionId: params.sessionId,
          questions: {
            total: questions.length,
            topQuestion: topQuestion
              ? {
                  id: topQuestion.id,
                  content: topQuestion.content,
                  upvotes: topQuestion.upvotes,
                }
              : null,
          },
          activePoll: activePoll
            ? {
                id: activePoll.id,
                title: activePoll.title,
                isActive: activePoll.isActive,
                totalVotes: activePoll.options.reduce(
                  (sum, option) => sum + option.voteCount,
                  0
                ),
              }
            : null,
          game: game
            ? {
                status: game.status,
                currentQuestionIndex: game.currentQuestionIndex,
                totalQuestions: game.questions.length,
              }
            : null,
        };
      },
      { params: t.Object({ sessionId: t.String({ minLength: 1 }) }) }
    );
}
