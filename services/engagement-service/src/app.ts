import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { openapiDocumentation } from "./openapi";
import { makeDeps, type Deps } from "./deps";
import { qaRoutes } from "./modules/qa.routes";
import { pollRoutes } from "./modules/poll.routes";
import { gameRoutes } from "./modules/game.routes";
import { wsRoutes } from "./modules/ws.routes";

export function createApp(overrides: Partial<Deps> = {}) {
  const deps = makeDeps(overrides);

  const app = new Elysia()
    .use(
      swagger({
        path: "/swagger",
        documentation: openapiDocumentation,
      })
    )
    .get("/health", async ({ set }) => {
      try {
        await deps.prisma.$queryRaw`SELECT 1`;
        return { status: "ok", service: "engagement-service", database: "ok" };
      } catch {
        set.status = 503;
        return { status: "degraded", service: "engagement-service", database: "unavailable" };
      }
    })
    .use(qaRoutes(deps, deps.jwtSecret))
    .use(pollRoutes(deps, deps.jwtSecret))
    .use(gameRoutes(deps, deps.jwtSecret))
    .use(wsRoutes(deps));

  return { app, deps };
}
