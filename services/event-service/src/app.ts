import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { openapiDocumentation } from "./openapi";
import { makeDeps, type Deps } from "./deps";
import { eventRoutes } from "./modules/event.routes";
import { internalRoutes } from "./modules/internal.routes";

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
        return { status: "ok", service: "event-service", database: "ok" };
      } catch {
        set.status = 503;
        return { status: "degraded", service: "event-service", database: "unavailable" };
      }
    })
    .use(eventRoutes(deps))
    .use(internalRoutes(deps));

  return { app, deps };
}
