import { Elysia } from "elysia";
import { gameCrudRoutes } from "./routes/game-crud.routes";
import { gameLifecycleRoutes } from "./routes/game-lifecycle.routes";
import { answerRoutes } from "./routes/answer.routes";
import { gameWs } from "./ws/game.ws";

export const gameModule = new Elysia({ prefix: "/api/game" })
  .use(gameCrudRoutes)
  .use(gameLifecycleRoutes)
  .use(answerRoutes)
  .use(gameWs);

export * from "./services/broadcast.service";
export * from "./services/scoring.service";
export * from "./schemas";
