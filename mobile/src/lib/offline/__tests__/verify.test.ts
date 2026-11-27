import crypto from 'node:crypto';

import type { CachedTicket } from '@/lib/offline/cache';
import { evaluateOfflineScan, verifyOfflineToken, type QrPayload } from '@/lib/offline/verify';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function sign(payload: QrPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createSign('RSA-SHA256').update(data).sign(privateKey, 'base64url');
  return `${data}.${signature}`;
}

const ticket: CachedTicket = {
  ticketId: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
  eventName: 'Tech Summit',
  ticketTypeName: 'Standard',
  status: 'PAID',
  orderStatus: 'CONFIRMED',
  attendeeName: 'Nguyen Van A',
  checkedInAt: null,
  updatedAt: '2026-11-09T08:00:00.000Z',
};

function payloadAt(secondsAgo: number, overrides: Partial<QrPayload> = {}): QrPayload {
  return {
    tid: ticket.ticketId,
    eid: ticket.eventId,
    code: '123456',
    iat: Math.floor(Date.now() / 1000) - secondsAgo,
    ...overrides,
  };
}

describe('verifyOfflineToken', () => {
  it('accepts a freshly signed payload', () => {
    const result = verifyOfflineToken(sign(payloadAt(5)), publicKey);
    expect(result.valid).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const token = sign(payloadAt(5));
    const tampered = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(verifyOfflineToken(tampered, publicKey)).toEqual({
      valid: false,
      reason: 'BAD_SIGNATURE',
    });
  });

  it('rejects expired, future and malformed tokens', () => {
    expect(verifyOfflineToken(sign(payloadAt(31)), publicKey)).toEqual({
      valid: false,
      reason: 'EXPIRED',
    });
    expect(verifyOfflineToken(sign(payloadAt(-30)), publicKey)).toEqual({
      valid: false,
      reason: 'FUTURE',
    });
    expect(verifyOfflineToken('not-a-token', publicKey)).toEqual({
      valid: false,
      reason: 'MALFORMED',
    });
    expect(verifyOfflineToken(sign(payloadAt(1)), null)).toEqual({
      valid: false,
      reason: 'NO_PUBLIC_KEY',
    });
  });
});

describe('evaluateOfflineScan', () => {
  const now = Date.now;

  it('returns green only when the cached ticket and signature agree', () => {
    const decision = evaluateOfflineScan({
      token: sign(payloadAt(2)),
      publicKeyPem: publicKey,
      ticket,
      alreadyQueued: false,
      nowMs: now(),
    });
    expect(decision.kind).toBe('green');
  });

  it('queues instead of accepting when the cache disagrees', () => {
    const checkedIn = evaluateOfflineScan({
      token: sign(payloadAt(2)),
      publicKeyPem: publicKey,
      ticket: { ...ticket, status: 'CHECKED_IN' },
      alreadyQueued: false,
    });
    expect(checkedIn.kind).toBe('queued');

    const wrongEvent = evaluateOfflineScan({
      token: sign(payloadAt(2)),
      publicKeyPem: publicKey,
      ticket: { ...ticket, eventId: 'another-event' },
      alreadyQueued: false,
    });
    expect(wrongEvent.kind).toBe('queued');

    const duplicate = evaluateOfflineScan({
      token: sign(payloadAt(2)),
      publicKeyPem: publicKey,
      ticket,
      alreadyQueued: true,
    });
    expect(duplicate.kind).toBe('queued');

    const noKey = evaluateOfflineScan({
      token: sign(payloadAt(2)),
      publicKeyPem: null,
      ticket,
      alreadyQueued: false,
    });
    expect(noKey.kind).toBe('queued');
  });
});
