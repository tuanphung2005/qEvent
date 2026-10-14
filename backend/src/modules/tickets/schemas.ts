import { t } from "elysia";

export const invitationBody = t.Object({
  email: t.String(),
  role: t.Optional(t.String()),
  code: t.Optional(t.String()),
});

export const claimInviteBody = t.Object({
  code: t.String(),
});

export const ticketPurchaseBody = t.Object({
  eventId: t.Optional(t.String()),
  ticketTypeId: t.Optional(t.String()),
  quantity: t.Optional(t.Number()),
});
