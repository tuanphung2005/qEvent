import jsrsasign from 'jsrsasign';

import { serverNow } from '@/api/client';

import type { CachedTicket } from './cache';

export const QR_MAX_AGE_SECONDS = 30;
export const QR_MAX_FUTURE_SKEW_SECONDS = 5;

export type QrPayload = { tid: string; eid: string; code: string; iat: number };

export type QrVerifyResult =
  { valid: true; payload: QrPayload } | { valid: false; reason: QrRejectReason };

export type QrRejectReason = 'MALFORMED' | 'BAD_SIGNATURE' | 'NO_PUBLIC_KEY' | 'EXPIRED' | 'FUTURE';

function base64UrlToBytes(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const standard = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of standard) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('Invalid base64url character');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function base64UrlToString(input: string): string {
  const bytes = base64UrlToBytes(input);
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * The backend emits a two-part token, not a JWT: base64url(payloadJSON) + '.' +
 * base64url(RSA-SHA256 signature over that payload string).
 */
export function verifyOfflineToken(
  token: string,
  publicKeyPem: string | null,
  nowMs = Date.now()
): QrVerifyResult {
  if (!publicKeyPem) return { valid: false, reason: 'NO_PUBLIC_KEY' };

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'MALFORMED' };
  }
  const [data, signature] = parts;

  let signatureValid = false;
  try {
    const verifier = new jsrsasign.KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    verifier.init(publicKeyPem);
    verifier.updateString(data);
    signatureValid = verifier.verify(bytesToHex(base64UrlToBytes(signature)));
  } catch {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }
  if (!signatureValid) return { valid: false, reason: 'BAD_SIGNATURE' };

  let payload: QrPayload;
  try {
    payload = JSON.parse(base64UrlToString(data)) as QrPayload;
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (
    typeof payload.tid !== 'string' ||
    typeof payload.eid !== 'string' ||
    typeof payload.code !== 'string' ||
    typeof payload.iat !== 'number'
  ) {
    return { valid: false, reason: 'MALFORMED' };
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (payload.iat - nowSeconds > QR_MAX_FUTURE_SKEW_SECONDS) {
    return { valid: false, reason: 'FUTURE' };
  }
  if (nowSeconds - payload.iat > QR_MAX_AGE_SECONDS) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return { valid: true, payload };
}

export type OfflineDecision =
  { kind: 'green'; payload: QrPayload; ticket: CachedTicket } | { kind: 'queued'; reason: string };

/**
 * Green means the signature is valid, the cached ticket matches, and the ticket
 * is still usable. Anything we cannot prove locally is queued (yellow), never
 * shown as accepted. Defaults to the server-corrected clock so a drifted device
 * does not reject every fresh QR.
 */
export function evaluateOfflineScan(input: {
  token: string;
  publicKeyPem: string | null;
  ticket: CachedTicket | null;
  alreadyQueued: boolean;
  nowMs?: number;
}): OfflineDecision {
  const verified = verifyOfflineToken(input.token, input.publicKeyPem, input.nowMs ?? serverNow());

  if (!verified.valid) {
    if (verified.reason === 'NO_PUBLIC_KEY') {
      return { kind: 'queued', reason: 'Chưa có public key để xác thực chữ ký' };
    }
    return { kind: 'queued', reason: `Mã QR không hợp lệ (${verified.reason})` };
  }

  if (!input.ticket) {
    return { kind: 'queued', reason: 'Vé không có trong cache của thiết bị' };
  }
  if (input.ticket.eventId !== verified.payload.eid) {
    return { kind: 'queued', reason: 'Vé thuộc sự kiện khác' };
  }
  if (input.ticket.orderStatus !== 'CONFIRMED') {
    return { kind: 'queued', reason: 'Đơn hàng chưa được xác nhận' };
  }
  if (input.ticket.status !== 'PAID') {
    return { kind: 'queued', reason: `Trạng thái vé là ${input.ticket.status}` };
  }
  if (input.alreadyQueued) {
    return { kind: 'queued', reason: 'Vé đã có trong hàng đợi trên thiết bị này' };
  }

  return { kind: 'green', payload: verified.payload, ticket: input.ticket };
}
