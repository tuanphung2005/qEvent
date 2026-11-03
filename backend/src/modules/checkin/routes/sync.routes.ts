import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { JWT_CONFIG, deriveCurrentUser } from "../../../lib/auth";
import { handleSync } from "../services/sync.service";
import { syncBody } from "../schemas";

export const syncRoutes = new Elysia({ prefix: "/api/checkin" })
  .use(jwt(JWT_CONFIG))
  .derive(deriveCurrentUser)
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
