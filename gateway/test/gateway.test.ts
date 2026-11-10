import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { createGatewayApp } from "../src/index";

describe("API Gateway (bun test)", () => {
  let mockEvent: Elysia;
  let mockAdmission: Elysia;
  let mockEngagement: Elysia;

  let eventPort: number;
  let admissionPort: number;
  let engagementPort: number;

  const JWT_SECRET = "test_jwt_secret_gateway_2026";

  beforeAll(() => {
    mockEvent = new Elysia()
      .get("/health", () => ({ status: "ok" }))
      .get("/api/events", ({ request }) => ({
        events: [{ id: "evt-1", title: "Keynote" }],
        headers: {
          userId: request.headers.get("x-user-id"),
          role: request.headers.get("x-user-role"),
        },
      }))
      .listen(0);

    mockAdmission = new Elysia()
      .get("/health", () => ({ status: "ok" }))
      .post("/api/orders", async ({ request }) => ({
        orderId: "ord-1",
        body: await request.json(),
        headers: {
          userId: request.headers.get("x-user-id"),
          role: request.headers.get("x-user-role"),
        },
      }))
      .listen(0);

    mockEngagement = new Elysia()
      .get("/health", () => ({ status: "ok" }))
      .get("/api/sessions/live", () => ({ live: true }))
      .ws("/ws/test", {
        message(ws, msg) {
          ws.send(`echo:${msg}`);
        },
      })
      .listen(0);

    eventPort = (mockEvent.server as any).port;
    admissionPort = (mockAdmission.server as any).port;
    engagementPort = (mockEngagement.server as any).port;
  });

  afterAll(() => {
    mockEvent.stop();
    mockAdmission.stop();
    mockEngagement.stop();
  });

  function getTestApp(options?: any) {
    return createGatewayApp({
      jwtSecret: JWT_SECRET,
      eventServiceUrl: `http://localhost:${eventPort}`,
      admissionServiceUrl: `http://localhost:${admissionPort}`,
      engagementServiceUrl: `http://localhost:${engagementPort}`,
      circuitBreakerOptions: {
        timeout: 500,
        volumeThreshold: 5,
        errorThresholdPercentage: 50,
        resetTimeout: 2000,
        rollingCountTimeout: 10000,
        ...options,
      },
    });
  }

  it("Health endpoint returns status and circuit breaker states", async () => {
    const { app } = getTestApp();
    const res = await app.handle(new Request("http://localhost:8000/health"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("api-gateway");
    expect(body.circuitBreakers).toEqual({ event: "CLOSED", admission: "CLOSED", engagement: "CLOSED" });
    expect(body.downstream).toEqual({ event: "ok", admission: "ok", engagement: "ok" });
  });

  it("Proxies GET /api/events to Event Service", async () => {
    const { app } = getTestApp();
    const res = await app.handle(new Request("http://localhost:8000/api/events"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.events[0].id).toBe("evt-1");
  });

  it("Proxies POST /api/orders with payload to Admission Service", async () => {
    const { app } = getTestApp();
    const payload = { ticketTypeId: "vip-1", quantity: 2 };
    const res = await app.handle(
      new Request("http://localhost:8000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.orderId).toBe("ord-1");
    expect(body.body.ticketTypeId).toBe("vip-1");
  });

  it("Rejects invalid JWT with 401 UNAUTHORIZED", async () => {
    const { app } = getTestApp();
    const res = await app.handle(
      new Request("http://localhost:8000/api/events", {
        headers: { Authorization: "Bearer bad.token.here" },
      })
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("Verifies valid JWT, strips spoofed headers, and forwards x-user-id/role", async () => {
    const { app } = getTestApp();

    // Sign valid token
    const tokenSigner = new Elysia().use(jwt({ name: "jwt", secret: JWT_SECRET }));
    let validToken = "";
    tokenSigner.get("/token", async ({ jwt }: any) => {
      validToken = await jwt.sign({ sub: "tuan-123", role: "ORGANIZER" });
      return validToken;
    });
    await tokenSigner.handle(new Request("http://localhost/token"));

    const res = await app.handle(
      new Request("http://localhost:8000/api/events", {
        headers: {
          Authorization: `Bearer ${validToken}`,
          "x-user-id": "hacker-spoof",
          "x-user-role": "admin-spoof",
        },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.headers.userId).toBe("tuan-123");
    expect(body.headers.role).toBe("ORGANIZER");
  });

  it("Circuit Breaker opens on repeated failures and fails fast with 503", async () => {
    const failingService = new Elysia()
      .get("/api/sessions/fail", ({ set }) => {
        set.status = 503;
        return { error: "downstream error" };
      })
      .listen(0);

    const failingPort = (failingService.server as any).port;

    const { app, circuitBreakers } = createGatewayApp({
      engagementServiceUrl: `http://localhost:${failingPort}`,
      circuitBreakerOptions: {
        volumeThreshold: 5,
        errorThresholdPercentage: 50,
        resetTimeout: 5000,
        rollingCountTimeout: 10000,
      },
    });

    // 5 failures
    for (let i = 0; i < 5; i++) {
      const res = await app.handle(new Request("http://localhost:8000/api/sessions/fail"));
      expect(res.status).toBe(503);
    }

    // Circuit is now OPEN
    expect(circuitBreakers.getState("engagement")).toBe("OPEN");

    // 6th call rejected immediately (fail-fast)
    const t0 = performance.now();
    const res6 = await app.handle(new Request("http://localhost:8000/api/sessions/fail"));
    const duration = performance.now() - t0;

    expect(res6.status).toBe(503);
    const body6 = (await res6.json()) as any;
    expect(body6.code).toBe("SERVICE_UNAVAILABLE");
    expect(body6.circuitState).toBe("OPEN");
    expect(duration).toBeLessThan(30);

    failingService.stop();
  });

  it("Circuit Breaker times out slow downstream calls", async () => {
    const slowService = new Elysia()
      .get("/api/sessions/slow", async () => {
        await new Promise((r) => setTimeout(r, 600));
        return { ok: true };
      })
      .listen(0);

    const slowPort = (slowService.server as any).port;

    const { app } = createGatewayApp({
      engagementServiceUrl: `http://localhost:${slowPort}`,
      circuitBreakerOptions: {
        timeout: 100, // 100ms timeout for test
      },
    });

    const res = await app.handle(new Request("http://localhost:8000/api/sessions/slow"));
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.code).toBe("SERVICE_UNAVAILABLE");

    slowService.stop();
  });

  it("WebSocket proxies and delivers messages to downstream service", async () => {
    const { app } = getTestApp();
    const gatewayServer = app.listen(0);
    const gwPort = (gatewayServer.server as any).port;

    const wsClient = new WebSocket(`ws://localhost:${gwPort}/ws/test`);
    const received: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WS test timeout")), 3000);
      wsClient.onopen = () => {
        // Send immediately on open
        wsClient.send("hello-microservices");
      };
      wsClient.onmessage = (event) => {
        received.push(String(event.data));
        clearTimeout(timer);
        wsClient.close();
        resolve();
      };
      wsClient.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });

    expect(received[0]).toBe("echo:hello-microservices");
    gatewayServer.stop();
  });
});
