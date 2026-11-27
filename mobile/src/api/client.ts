import createClient, { type Middleware } from 'openapi-fetch';

import { getToken } from '../auth/token-store';
import { API_BASE_URL } from './env';
import type { ApiPaths } from './types';

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await getToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
};

export const api = createClient<ApiPaths>({
  baseUrl: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

api.use(authMiddleware);

/** Server clock offset in ms, refreshed from the `Date` header (best effort). */
let serverOffsetMs = 0;

export function recordServerDate(response: Response): void {
  const header = response.headers.get('date');
  if (!header) return;
  const server = Date.parse(header);
  if (Number.isNaN(server)) return;
  serverOffsetMs = server - Date.now();
}

export function getServerOffsetMs(): number {
  return serverOffsetMs;
}

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

export function resetServerClock(): void {
  serverOffsetMs = 0;
}
