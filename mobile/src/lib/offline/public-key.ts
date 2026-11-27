import { api, recordServerDate } from '@/api/client';
import { unwrap } from '@/api/errors';

import { getMeta, setMeta, META_KEYS } from './cache';
import type { OfflineDb } from './db';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PublicKey = { publicKey: string; kid: string };

/**
 * Staff devices need the RSA public key before they leave Wi-Fi. Cached for a
 * day; a backend key rotation shortens this window.
 */
export async function refreshPublicKey(
  db: OfflineDb,
  options: { force?: boolean; nowMs?: number } = {}
): Promise<PublicKey | null> {
  const cached = await getCachedPublicKey(db);
  const fetchedAt = Number(await getMeta(db, META_KEYS.publicKeyFetchedAt));
  const fresh =
    Number.isFinite(fetchedAt) && (options.nowMs ?? Date.now()) - fetchedAt < MAX_AGE_MS;

  if (cached && fresh && !options.force) return cached;

  try {
    const result = await api.GET('/api/qr/public-key');
    recordServerDate(result.response);
    const data = unwrap(result, 'Không tải được public key để xác thực QR offline.');

    await setMeta(db, META_KEYS.publicKey, data.publicKey);
    await setMeta(db, META_KEYS.publicKeyId, data.kid);
    await setMeta(db, META_KEYS.publicKeyFetchedAt, String(Date.now()));

    return { publicKey: data.publicKey, kid: data.kid };
  } catch {
    return cached;
  }
}

export async function getCachedPublicKey(db: OfflineDb): Promise<PublicKey | null> {
  const publicKey = await getMeta(db, META_KEYS.publicKey);
  if (!publicKey) return null;
  const kid = (await getMeta(db, META_KEYS.publicKeyId)) ?? 'unknown';
  return { publicKey, kid };
}
