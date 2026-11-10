import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser } from "../lib/auth";
import { checkIn, syncOffline } from "../services/checkin.service";

export function checkinRoutes(deps: Deps, secret: string) {
  return new Elysia({ prefix: "/api", tags: ["checkins"] })
    .use(createJwtAuth(secret))
    .derive(deriveCurrentUser)
    .post(
      "/checkins",
      async ({ body, currentUser, set }) => {
        const result = await checkIn(deps, currentUser, {
          qrToken: body.qrToken,
          deviceId: body.deviceId,
          gate: body.gate,
        });
        set.status = result.status as typeof set.status;
        return result.body;
      },
      {
        body: t.Object({
          qrToken: t.String({ minLength: 1 }),
          deviceId: t.Optional(t.String()),
          gate: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/checkins/sync-offline",
      async ({ body, currentUser, set }) => {
        const result = await syncOffline(deps, currentUser, body.logs);
        set.status = result.status as typeof set.status;
        return result.body;
      },
      {
        body: t.Object({
          logs: t.Array(
            t.Object({
              ticketId: t.String({ minLength: 1 }),
              scannedAt: t.String({ minLength: 1 }),
              deviceId: t.Optional(t.String()),
            }),
            { minItems: 1 }
          ),
        }),
      }
    );
}
