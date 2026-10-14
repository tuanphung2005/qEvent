import { prisma } from "../../../plugins/prisma";

/**
 * Calculate Kahoot-style score based on correctness and speed
 */
export function calculateQuizScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitSec: number,
  basePoints = 1000
): number {
  if (!isCorrect) return 0;
  const timeLimitMs = timeLimitSec * 1000;
  const clampedTime = Math.min(Math.max(responseTimeMs, 0), timeLimitMs);

  // Speed factor: 1.0 (instant) down to 0.5 (at time limit)
  const scoreFactor = 1 - (clampedTime / (2 * timeLimitMs));
  return Math.round(basePoints * scoreFactor);
}

/**
 * Compute Leaderboard for a Game
 */
export async function getGameLeaderboard(gameId: string, limit = 10) {
  const answers = await prisma.quizAnswer.findMany({
    where: { gameId },
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  const scoreMap = new Map<string, { userId: string; fullName: string; totalScore: number; correctCount: number }>();

  for (const ans of answers) {
    const existing = scoreMap.get(ans.userId) || {
      userId: ans.userId,
      fullName: ans.user.fullName,
      totalScore: 0,
      correctCount: 0,
    };

    existing.totalScore += ans.scoreAwarded;
    if (ans.isCorrect) existing.correctCount += 1;
    scoreMap.set(ans.userId, existing);
  }

  const sorted = Array.from(scoreMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return sorted;
}
