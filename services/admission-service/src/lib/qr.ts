import crypto from "node:crypto";

export const QR_STEP_SECONDS = 30;
export const QR_MAX_AGE_SECONDS = 30;
export const QR_MAX_FUTURE_SKEW_SECONDS = 5;

export type QrPayload = {
  tid: string;
  eid: string;
  code: string;
  iat: number;
};

export type QrVerification =
  | { valid: true; payload: QrPayload }
  | { valid: false; error: "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" | "FUTURE" };

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const digest = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 1_000_000).toString().padStart(6, "0");
}

export function generateTotp(
  secret: string,
  timestampMs = Date.now(),
  stepSeconds = QR_STEP_SECONDS
): string {
  return hotp(secret, Math.floor(timestampMs / 1000 / stepSeconds));
}

export function verifyTotp(
  secret: string,
  code: string,
  timestampMs = Date.now(),
  stepSeconds = QR_STEP_SECONDS
): boolean {
  const current = generateTotp(secret, timestampMs, stepSeconds);
  if (current === code) return true;
  const previous = generateTotp(secret, timestampMs - stepSeconds * 1000, stepSeconds);
  return previous === code;
}

export function signQrToken(payload: QrPayload, privateKey: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createSign("RSA-SHA256").update(data).sign(privateKey, "base64url");
  return `${data}.${signature}`;
}

export function verifyQrToken(
  token: string,
  publicKey: string,
  timestampMs = Date.now()
): QrVerification {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, error: "MALFORMED" };

  const [data, signature] = parts;
  let signatureValid = false;
  try {
    signatureValid = crypto
      .createVerify("RSA-SHA256")
      .update(data)
      .verify(publicKey, signature, "base64url");
  } catch {
    return { valid: false, error: "BAD_SIGNATURE" };
  }
  if (!signatureValid) return { valid: false, error: "BAD_SIGNATURE" };

  let payload: QrPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
  } catch {
    return { valid: false, error: "MALFORMED" };
  }

  if (
    typeof payload.tid !== "string" ||
    typeof payload.eid !== "string" ||
    typeof payload.code !== "string" ||
    typeof payload.iat !== "number"
  ) {
    return { valid: false, error: "MALFORMED" };
  }

  const nowSec = Math.floor(timestampMs / 1000);
  if (payload.iat - nowSec > QR_MAX_FUTURE_SKEW_SECONDS) {
    return { valid: false, error: "FUTURE" };
  }
  if (nowSec - payload.iat > QR_MAX_AGE_SECONDS) {
    return { valid: false, error: "EXPIRED" };
  }

  return { valid: true, payload };
}

export function buildQrToken(
  ticket: { id: string; eventId: string; qrSecret: string },
  privateKey: string,
  timestampMs = Date.now()
): { qrToken: string; expiresIn: number } {
  const nowSec = Math.floor(timestampMs / 1000);
  const qrToken = signQrToken(
    {
      tid: ticket.id,
      eid: ticket.eventId,
      code: generateTotp(ticket.qrSecret, timestampMs),
      iat: nowSec,
    },
    privateKey
  );
  return { qrToken, expiresIn: QR_STEP_SECONDS - (nowSec % QR_STEP_SECONDS) };
}
