import { generateTOTP, signDynamicQRPayload } from "../../../config/keys";

export function buildQrToken(ticket: { id: string; eventId: string; totpSecret: string }): {
  qrToken: string;
  expiresIn: number;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = 30 - (nowSec % 30);
  const code = generateTOTP(ticket.totpSecret);
  const qrToken = signDynamicQRPayload({
    tid: ticket.id,
    eid: ticket.eventId,
    code,
    iat: nowSec,
  });
  return { qrToken, expiresIn };
}

export function enrichTicketWithQr<T extends { id: string; eventId: string; totpSecret: string }>(
  ticket: T
): T & { qrToken: string; expiresIn: number } {
  return { ...ticket, ...buildQrToken(ticket) };
}
