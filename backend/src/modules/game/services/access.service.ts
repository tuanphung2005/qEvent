import type { QuizGameStatus } from "@prisma/client";
import { prisma } from "../../../plugins/prisma";
import { checkUserSessionAccess, HOST_ROLES } from "../../realtime";

export type GuardFail = {
  ok: false;
  status: 401 | 403 | 404 | 409;
  error: string;
  message?: string;
};

export type GameRef = {
  id: string;
  sessionId: string;
  status: QuizGameStatus;
  currentQuestionIndex: number;
};

/** 401 → 404 → 403 → 409. Thứ tự này cố định, đừng đảo. */
export async function requireHost(
  gameId: string,
  userId: string | null | undefined,
  opts: { statuses?: QuizGameStatus[] } = {}
): Promise<{ ok: true; game: GameRef } | GuardFail> {
  if (!userId) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const game = await prisma.quizGame.findUnique({
    where: { id: gameId },
    select: { id: true, sessionId: true, status: true, currentQuestionIndex: true },
  });
  if (!game) return { ok: false, status: 404, error: "GAME_NOT_FOUND" };

  // Hạn chế đã biết: role toàn cục, không gắn theo event (xem 05c §3.10)
  const access = await checkUserSessionAccess(game.sessionId, userId);
  if (!HOST_ROLES.includes(access.role)) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  if (opts.statuses && !opts.statuses.includes(game.status)) {
    return {
      ok: false,
      status: 409,
      error: "INVALID_GAME_STATE",
      message: `Game đang ${game.status}`,
    };
  }

  return { ok: true, game };
}

/** Như requireHost nhưng cho route tạo game (chưa có gameId). */
export async function requireSessionHost(
  sessionId: string,
  userId: string | null | undefined
): Promise<{ ok: true; sessionId: string } | GuardFail> {
  if (!userId) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { ok: false, status: 404, error: "SESSION_NOT_FOUND" };

  const access = await checkUserSessionAccess(sessionId, userId);
  if (!HOST_ROLES.includes(access.role)) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true, sessionId: session.id };
}

/** Compare-and-set: chỉ đổi nếu trạng thái (và index) vẫn đúng như đã đọc. */
export async function transition(
  gameId: string,
  where: { status: QuizGameStatus[]; currentQuestionIndex?: number },
  data: { status: QuizGameStatus; currentQuestionIndex?: number }
): Promise<boolean> {
  const res = await prisma.quizGame.updateMany({
    where: {
      id: gameId,
      status: { in: where.status },
      ...(where.currentQuestionIndex !== undefined && {
        currentQuestionIndex: where.currentQuestionIndex,
      }),
    },
    data,
  });
  return res.count === 1;
}

/** Prisma P2002 (unique) — dùng chung cho orderNum và answer trùng. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}
