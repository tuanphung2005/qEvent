import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { broadcaster } from "../lib/broadcast";

export function wsRoutes(deps: Deps) {
  return new Elysia()
    .ws("/ws/qa", {
      body: t.Object({
        type: t.String(),
        sessionId: t.Optional(t.String()),
      }),
      open(ws) {
        // connection opened
      },
      message(ws, message) {
        if (message.type === "JOIN_SESSION" && message.sessionId) {
          const unsubscribe = broadcaster.subscribeQa(message.sessionId, {
            send: (data: string) => ws.send(data),
          });
          (ws as any)._unsubscribeQa = unsubscribe;
          ws.send(JSON.stringify({ type: "JOINED_SESSION", sessionId: message.sessionId }));
        }
      },
      close(ws) {
        if (typeof (ws as any)._unsubscribeQa === "function") {
          (ws as any)._unsubscribeQa();
        }
      },
    })
    .ws("/ws/game", {
      body: t.Object({
        type: t.String(),
        gameId: t.Optional(t.String()),
      }),
      open(ws) {
        // connection opened
      },
      async message(ws, message) {
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
          (ws as any)._unsubscribeGame = unsubscribe;
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
        if (typeof (ws as any)._unsubscribeGame === "function") {
          (ws as any)._unsubscribeGame();
        }
      },
    });
}
