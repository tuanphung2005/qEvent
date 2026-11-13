import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { ServiceCircuitBreakers, ServiceName } from "./circuit-breaker";
import { extractWsToken } from "./ws-token";

export interface GatewayConfig {
  port: number;
  jwtSecret: string;
  eventServiceUrl: string;
  admissionServiceUrl: string;
  engagementServiceUrl: string;
  circuitBreakerOptions?: {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
    rollingCountTimeout?: number;
    rollingCountBuckets?: number;
  };
}

export function getConfigFromEnv(): GatewayConfig {
  return {
    port: Number(process.env.PORT || 8000),
    jwtSecret: process.env.JWT_SECRET || "qevent_super_jwt_secret_key_2026",
    eventServiceUrl: process.env.EVENT_SERVICE_URL || "http://localhost:3001",
    admissionServiceUrl: process.env.ADMISSION_SERVICE_URL || "http://localhost:3002",
    engagementServiceUrl: process.env.ENGAGEMENT_SERVICE_URL || "http://localhost:3003",
  };
}

export function createGatewayApp(customConfig?: Partial<GatewayConfig>) {
  const config: GatewayConfig = {
    ...getConfigFromEnv(),
    ...customConfig,
  };

  const circuitBreakers = new ServiceCircuitBreakers(config.circuitBreakerOptions);

  const getTargetService = (pathname: string): { service: ServiceName; baseUrl: string } | null => {
    if (pathname.startsWith("/api/events")) {
      return { service: "event", baseUrl: config.eventServiceUrl };
    }
    if (
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/orders") ||
      pathname.startsWith("/api/tickets") ||
      pathname.startsWith("/api/checkins")
    ) {
      return { service: "admission", baseUrl: config.admissionServiceUrl };
    }
    if (
      pathname.startsWith("/api/sessions") ||
      pathname.startsWith("/api/polls") ||
      pathname.startsWith("/api/questions") ||
      pathname.startsWith("/api/game")
    ) {
      return { service: "engagement", baseUrl: config.engagementServiceUrl };
    }
    return null;
  };

  const app = new Elysia()
    .use(cors())
    .use(
      jwt({
        name: "jwt",
        secret: config.jwtSecret,
      })
    )
    .get("/health", async () => {
      // Fast probe to downstream services
      const probeService = async (url: string) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 600);
          const res = await fetch(`${url}/health`, { signal: controller.signal });
          clearTimeout(timer);
          return res.ok ? "ok" : `degraded_${res.status}`;
        } catch {
          return "unreachable";
        }
      };

      const [eventStatus, admissionStatus, engagementStatus] = await Promise.all([
        probeService(config.eventServiceUrl),
        probeService(config.admissionServiceUrl),
        probeService(config.engagementServiceUrl),
      ]);

      return {
        status: "ok",
        service: "api-gateway",
        timestamp: new Date().toISOString(),
        circuitBreakers: circuitBreakers.getAllStates(),
        downstream: {
          event: eventStatus,
          admission: admissionStatus,
          engagement: engagementStatus,
        },
      };
    })
    // WebSocket proxy to engagement service
    .ws("/ws/*", {
      body: t.Any(),
      async open(ws) {
        // Verify the JWT before opening any upstream connection. Anonymous
        // clients must never be able to join a session, even read-only.
        const data = ws.data as unknown as {
          request: Request;
          jwt?: { verify(token?: string): Promise<unknown> };
        };
        const token = extractWsToken(data.request);
        const payload = token && data.jwt ? await data.jwt.verify(token) : false;
        if (!payload || typeof payload !== "object") {
          ws.close(4401, "UNAUTHORIZED");
          return;
        }

        const path = new URL(ws.data.request.url).pathname;
        const query = new URL(ws.data.request.url).search;
        const upstreamBase = config.engagementServiceUrl.replace(/^http/, "ws");
        const upstreamUrl = `${upstreamBase}${path}${query}`;
        (ws.data as any).messageQueue = [];

        try {
          const upstream = new WebSocket(upstreamUrl);
          (ws.data as any).upstreamWs = upstream;

          upstream.onopen = () => {
            // Never log the full URL: it may contain the access token.
            console.log(`[Gateway WS] Upstream connected for ${path}`);
            const queue: any[] = (ws.data as any).messageQueue || [];
            while (queue.length > 0) {
              const msg = queue.shift();
              upstream.send(typeof msg === "string" ? msg : JSON.stringify(msg));
            }
          };
          upstream.onmessage = (event) => {
            ws.send(event.data);
          };
          upstream.onclose = () => {
            ws.close();
          };
          upstream.onerror = (err) => {
            console.error(`[Gateway WS] Upstream error:`, err);
            ws.close();
          };
        } catch (err) {
          console.error(`[Gateway WS] Failed to connect upstream:`, err);
          ws.close();
        }
      },
      message(ws, msg) {
        const upstream: WebSocket | undefined = (ws.data as any).upstreamWs;
        if (upstream && upstream.readyState === WebSocket.OPEN) {
          upstream.send(typeof msg === "string" ? msg : JSON.stringify(msg));
        } else if (upstream && upstream.readyState === WebSocket.CONNECTING) {
          ((ws.data as any).messageQueue ||= []).push(msg);
        }
      },
      close(ws) {
        const upstream: WebSocket | undefined = (ws.data as any).upstreamWs;
        if (upstream && upstream.readyState === WebSocket.OPEN) {
          upstream.close();
        }
      },
    })
    // All HTTP routes reverse proxy with JWT & Circuit Breaker
    .all("/api/*", async ({ request, jwt, set }) => {
      const url = new URL(request.url);
      const target = getTargetService(url.pathname);
      const startedAt = performance.now();
      const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

      if (!target) {
        set.status = 404;
        console.warn(
          JSON.stringify({
            requestId,
            method: request.method,
            path: url.pathname,
            status: 404,
            error: "ROUTE_NOT_FOUND",
          })
        );
        return {
          code: "ROUTE_NOT_FOUND",
          message: `No microservice mapped for path: ${url.pathname}`,
        };
      }

      // Security: clone headers and strip untrusted spoofable user headers
      const forwardedHeaders = new Headers(request.headers);
      forwardedHeaders.delete("x-user-id");
      forwardedHeaders.delete("x-user-role");
      forwardedHeaders.delete("host");
      forwardedHeaders.set("x-request-id", requestId);

      // Centralized JWT Verification
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        const payload = (await jwt.verify(token)) as Record<string, any> | false;

        if (!payload) {
          set.status = 401;
          set.headers["x-request-id"] = requestId;
          console.warn(
            JSON.stringify({
              requestId,
              method: request.method,
              path: url.pathname,
              service: target.service,
              status: 401,
              durationMs: Math.round(performance.now() - startedAt),
            })
          );
          return {
            code: "UNAUTHORIZED",
            message: "Invalid or expired token",
          };
        }

        const userId = payload.sub || payload.id || payload.userId;
        const role = payload.role || "ATTENDEE";

        if (userId) {
          forwardedHeaders.set("x-user-id", String(userId));
        }
        if (role) {
          forwardedHeaders.set("x-user-role", String(role));
        }
      }

      // Target URL construction
      const targetUrl = new URL(url.pathname + url.search, target.baseUrl).toString();
      const method = request.method;
      const hasBody = method !== "GET" && method !== "HEAD";
      const timeoutMs = config.circuitBreakerOptions?.timeout || 2000;

      const breaker = circuitBreakers.getBreaker(target.service);

      try {
        const upstreamResponse = (await breaker.fire(async () => {
          return await fetch(targetUrl, {
            method,
            headers: forwardedHeaders,
            body: hasBody ? request.body : null,
            signal: AbortSignal.timeout(timeoutMs),
            // @ts-ignore
            duplex: hasBody ? "half" : undefined,
          });
        })) as Response;

        // Forward response status, headers and body
        const responseHeaders = new Headers(upstreamResponse.headers);
        // Clean hop-by-hop headers
        responseHeaders.delete("transfer-encoding");
        responseHeaders.delete("connection");
        responseHeaders.set("x-request-id", requestId);

        set.status = upstreamResponse.status;
        console.log(
          JSON.stringify({
            requestId,
            method,
            path: url.pathname,
            service: target.service,
            status: upstreamResponse.status,
            durationMs: Math.round(performance.now() - startedAt),
          })
        );
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      } catch (err: any) {
        const timedOut =
          err?.code === "ETIMEDOUT" || /timed out/i.test(String(err?.message ?? ""));
        const status = timedOut ? 504 : 503;
        set.status = status;
        set.headers["x-request-id"] = requestId;
        console.error(
          JSON.stringify({
            requestId,
            method,
            path: url.pathname,
            service: target.service,
            status,
            durationMs: Math.round(performance.now() - startedAt),
            error: err?.message || String(err),
          })
        );
        return {
          code: timedOut ? "GATEWAY_TIMEOUT" : "SERVICE_UNAVAILABLE",
          message: timedOut
            ? "Downstream service timed out"
            : "Downstream service unavailable (circuit open or unreachable)",
          service: target.service,
          circuitState: circuitBreakers.getState(target.service),
          error: err?.message || String(err),
        };
      }
    });

  return { app, circuitBreakers, config };
}

// Start standalone server when executed directly
if (import.meta.main) {
  const { app, config } = createGatewayApp();
  app.listen(config.port, () => {
    console.log(`[API Gateway] Listening on http://0.0.0.0:${config.port}`);
    console.log(`- Event Service:       ${config.eventServiceUrl}`);
    console.log(`- Admission Service:   ${config.admissionServiceUrl}`);
    console.log(`- Engagement Service:  ${config.engagementServiceUrl}`);
  });
}
