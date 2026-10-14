import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { handleSync } from "../services/sync.service";
import { syncBody } from "../schemas";

export const syncRoutes = new Elysia({ prefix: "/api/checkin" })
  .use(
    jwt({
      name: "jwtAuth",
      secret: process.env.JWT_SECRET || "qevent_super_secret_jwt_key_2026_production_grade",
    })
  )
  .derive(async ({ headers, jwtAuth }) => {
    const authHeader = headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return { currentUser: null };
    }
    const token = authHeader.slice(7);
    const payload = await jwtAuth.verify(token);
    if (!payload || typeof payload !== "object" || !("id" in payload)) {
      return { currentUser: null };
    }
    return {
      currentUser: {
        id: payload.id as string,
        email: payload.email as string,
        role: payload.role as string,
      },
    };
  })
  // Offline Sync & Conflict Resolution (supports both /sync and /sync-offline)
  .post(
    "/sync",
    async ({ body, currentUser, set }) => {
      return handleSync(body, currentUser, set);
    },
    {
      body: syncBody,
    }
  )
  .post(
    "/sync-offline",
    async ({ body, currentUser, set }) => {
      return handleSync(body, currentUser, set);
    },
    {
      body: syncBody,
    }
  );
