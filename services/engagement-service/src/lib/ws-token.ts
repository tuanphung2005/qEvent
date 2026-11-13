/**
 * Browsers cannot set an Authorization header on a WebSocket handshake, so the
 * token may arrive as `?token=`, as a Bearer header (non-browser clients), or as
 * a `bearer,<jwt>` / `bearer.<jwt>` subprotocol.
 */
export function extractWsToken(request: Request): string | null {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") ?? url.searchParams.get("access_token");
  if (queryToken) return queryToken;

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }

  const protocols = request.headers.get("sec-websocket-protocol");
  if (protocols) {
    const parts = protocols.split(",").map((part) => part.trim());
    const first = parts[0]?.toLowerCase() ?? "";
    if (first === "bearer" && parts[1]) return parts[1];
    if (first.startsWith("bearer.")) return parts[0].slice("bearer.".length);
  }

  return null;
}
