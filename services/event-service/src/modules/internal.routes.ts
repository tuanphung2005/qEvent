import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { requireServiceToken } from "../lib/auth";
import { getInternalEvent, getInternalSession } from "../services/event.service";
import { createReservation, releaseReservation } from "../services/reservation.service";

const reservationBody = t.Object({
  operationId: t.String({ minLength: 1 }),
  eventId: t.String({ minLength: 1 }),
  ticketTypeId: t.String({ minLength: 1 }),
  quantity: t.Integer({ minimum: 1 }),
});

const operationParams = t.Object({ operationId: t.String({ minLength: 1 }) });
const idParams = t.Object({ id: t.String({ minLength: 1 }) });

export function internalRoutes(deps: Deps) {
  return new Elysia({ tags: ["internal"] })
    .post(
      "/internal/reservations",
      async ({ body, headers, set }) => {
        const denied = requireServiceToken(headers, set, deps.internalToken);
        if (denied) return denied;
        const result = await createReservation(deps, body);
        set.status = result.status;
        return result.body;
      },
      { body: reservationBody }
    )
    .delete(
      "/internal/reservations/:operationId",
      async ({ headers, params, set }) => {
        const denied = requireServiceToken(headers, set, deps.internalToken);
        if (denied) return denied;
        const result = await releaseReservation(deps, params.operationId);
        set.status = result.status;
        return result.body;
      },
      { params: operationParams }
    )
    .get(
      "/internal/events/:id",
      async ({ headers, params, set }) => {
        const denied = requireServiceToken(headers, set, deps.internalToken);
        if (denied) return denied;
        const result = await getInternalEvent(deps, params.id);
        set.status = result.status;
        return result.body;
      },
      { params: idParams }
    )
    .get(
      "/internal/sessions/:id",
      async ({ headers, params, set }) => {
        const denied = requireServiceToken(headers, set, deps.internalToken);
        if (denied) return denied;
        const result = await getInternalSession(deps, params.id);
        set.status = result.status;
        return result.body;
      },
      { params: idParams }
    );
}
