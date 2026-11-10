import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { openapiDocumentation } from "./openapi";
import { makeDeps, type Deps } from "./deps";
import { authRoutes } from "./modules/auth.routes";
import { orderRoutes } from "./modules/order.routes";
import { ticketRoutes } from "./modules/ticket.routes";
import { checkinRoutes } from "./modules/checkin.routes";
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
        return { status: "ok", service: "admission-service", database: "ok" };
      } catch {
        set.status = 503;
        return { status: "degraded", service: "admission-service", database: "unavailable" };
      }
    })
    .use(authRoutes(deps, deps.jwtSecret))
    .use(orderRoutes(deps, deps.jwtSecret))
    .use(ticketRoutes(deps, deps.jwtSecret))
    .use(checkinRoutes(deps, deps.jwtSecret))
    .use(internalRoutes(deps));

  return { app, deps };
}
