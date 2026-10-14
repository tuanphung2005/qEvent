import { t } from "elysia";

export const scanJoinBody = t.Object({
  eventId: t.Optional(t.String()),
  qrData: t.Optional(t.String()),
  eventCode: t.Optional(t.String()),
});

export const verifyBody = t.Object({
  qrToken: t.String(),
  deviceId: t.Optional(t.String()),
  gate: t.Optional(t.String()),
});

export const syncBody = t.Any();
