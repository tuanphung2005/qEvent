const TOKEN_KEY = "qevent.token";

/** Fired by the API client when the gateway answers 401. */
export const TOKEN_EXPIRED_EVENT = "qevent:token-expired";

let memoryToken: string | null = null;

/** Memory first, sessionStorage second: the tab close ends the shift. */
export function readToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    // Storage disabled (private mode): the in-memory token is enough.
  }
  return memoryToken;
}

export function writeToken(token: string): void {
  memoryToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage disabled: keep the session alive in memory only.
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}
