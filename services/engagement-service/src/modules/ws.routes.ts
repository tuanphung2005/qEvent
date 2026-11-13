import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth } from "../lib/auth";
import { broadcaster } from "../lib/broadcast";
import { extractWsToken } from "../lib/ws-token";

type JwtVerifier = {
  verify(token?: string): Promise<unknown>;
};

type AuthenticatedData = {
  authenticated?: boolean;
  userId?: string;
  authPromise?: Promise<unknown>;
};

async function authenticate(
  ws: { data: unknown }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const data = ws.data as {
    request?: Request;
    jwtAuth?: JwtVerifier;
    authenticated?: boolean;
    userId?: string;
  };

  if (!data.request) return { ok: false, reason: "NO_REQUEST" };
  if (!data.jwtAuth) return { ok: false, reason: "NO_VERIFIER" };

  const token = extractWsToken(data.request);
  if (!token) return { ok: false, reason: "NO_TOKEN" };

  const payload = await data.jwtAuth.verify(token);
  if (!payload || typeof payload !== "object") return { ok: false, reason: "INVALID_TOKEN" };

  const claims = payload as { sub?: unknown; id?: unknown; userId?: unknown };
  const userId = claims.sub ?? claims.id ?? claims.userId;
  if (typeof userId !== "string") return { ok: false, reason: "NO_USER_ID" };

  data.authenticated = true;
  data.userId = userId;
  return { ok: true };
}

function beginAuthentication(
  ws: { data: unknown; close(code: number, reason: string): unknown }
): Promise<void> {
  const data = ws.data as AuthenticatedData;
  data.authPromise = authenticate(ws).then((auth) => {
    data.authenticated = auth.ok;
    if (!auth.ok) {
      ws.close(4401, auth.reason);
    }
  });
  return data.authPromise as Promise<void>;
}

async function waitForAuthentication(ws: { data: unknown }): Promise<boolean> {
  const data = ws.data as AuthenticatedData;
  if (data.authPromise) await data.authPromise;
  return Boolean(data.authenticated);
}

export function wsRoutes(deps: Deps, jwtSecret: string) {
  return new Elysia()
    .use(createJwtAuth(jwtSecret))
    .ws("/ws/qa", {
      body: t.Object({
        type: t.String(),
        sessionId: t.Optional(t.String()),
      }),
      async open(ws) {
        await beginAuthentication(ws);
      },
      async message(ws, message) {
        // The client may send JOIN before the async verification finishes.
        if (!(await waitForAuthentication(ws))) {
          return;
        }

        if (message.type === "JOIN_SESSION" && message.sessionId) {
          const unsubscribe = broadcaster.subscribeQa(message.sessionId, {
            send: (data: string) => ws.send(data),
          });
          (ws.data as any)._unsubscribeQa = unsubscribe;
          ws.send(JSON.stringify({ type: "JOINED_SESSION", sessionId: message.sessionId }));
        }
      },
      close(ws) {
        if (typeof (ws.data as any)._unsubscribeQa === "function") {
          (ws.data as any)._unsubscribeQa();
        }
      },
    })
    .ws("/ws/game", {
      body: t.Object({
        type: t.String(),
        gameId: t.Optional(t.String()),
      }),
      async open(ws) {
        await beginAuthentication(ws);
      },
      async message(ws, message) {
        if (!(await waitForAuthentication(ws))) {
          return;
        }

        if (message.type === "JOIN_GAME" && message.gameId) {
          const game = await deps.prisma.quizGame.findUnique({
            where: { id: message.gameId },
          });
          if (!game) {
            ws.send(JSON.stringify({ type: "ERROR", error: "GAME_NOT_FOUND" }));
            return;
          }

          const unsubscribe = broadcaster.subscribeGame(message.gameId, {
            send: (data: string) => ws.send(data),
          });
          (ws.data as any)._unsubscribeGame = unsubscribe;
          ws.send(
            JSON.stringify({
              type: "JOINED_GAME",
              gameId: message.gameId,
              status: game.status,
              currentQuestionIndex: game.currentQuestionIndex,
            })
          );
        } else if (message.type === "SUBMIT_ANSWER") {
          ws.send(
            JSON.stringify({
              type: "ERROR",
              code: "WS_SUBMIT_DEPRECATED",
              message: "Submit answers via authenticated REST POST /api/game/:gameId/answer",
            })
          );
        }
      },
      close(ws) {
        if (typeof (ws.data as any)._unsubscribeGame === "function") {
          (ws.data as any)._unsubscribeGame();
        }
      },
    });
}
