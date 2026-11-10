import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { ServiceCircuitBreakers, ServiceName } from "./circuit-breaker";

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
    if (pathname.startsWith("/api/sessions") || pathname.startsWith("/api/polls") || pathname.startsWith("/api/questions")) {
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
      open(ws) {
        const path = new URL(ws.data.request.url).pathname;
        const query = new URL(ws.data.request.url).search;
        const upstreamBase = config.engagementServiceUrl.replace(/^http/, "ws");
        const upstreamUrl = `${upstreamBase}${path}${query}`;
        (ws.data as any).messageQueue = [];

        try {
          const upstream = new WebSocket(upstreamUrl);
          (ws.data as any).upstreamWs = upstream;

          upstream.onopen = () => {
            console.log(`[Gateway WS] Upstream connected to ${upstreamUrl}`);
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

      if (!target) {
        set.status = 404;
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

      // Centralized JWT Verification
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        const payload = (await jwt.verify(token)) as Record<string, any> | false;

        if (!payload) {
          set.status = 401;
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
        const upstreamResponse = await breaker.fire(async () => {
          return await fetch(targetUrl, {
            method,
            headers: forwardedHeaders,
            body: hasBody ? request.body : null,
            signal: AbortSignal.timeout(timeoutMs),
            // @ts-ignore
            duplex: hasBody ? "half" : undefined,
          });
        });

        // Forward response status, headers and body
        const responseHeaders = new Headers(upstreamResponse.headers);
        // Clean hop-by-hop headers
        responseHeaders.delete("transfer-encoding");
        responseHeaders.delete("connection");

        set.status = upstreamResponse.status;
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      } catch (err: any) {
        set.status = 503;
        return {
          code: "SERVICE_UNAVAILABLE",
          message: "Downstream service unavailable (circuit open or timeout)",
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
