import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated";
import { TOKEN_EXPIRED_EVENT, clearToken, readToken } from "./token";

/**
 * One client, one base URL. In dev Vite proxies /api to the gateway; in
 * production Nginx serves the SPA and proxies /api on the same origin.
 */
export const api = createClient<paths>({ baseUrl: "" });

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = readToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  onResponse({ request, response }) {
    const isLogin = new URL(request.url, "http://localhost").pathname === "/api/auth/login";
    if (response.status === 401 && !isLogin) {
      clearToken();
      window.dispatchEvent(new Event(TOKEN_EXPIRED_EVENT));
    }
    return response;
  },
};

api.use(authMiddleware);
