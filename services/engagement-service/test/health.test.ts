import { describe, expect, it } from "bun:test";
import { makeTestApp, call } from "./helpers";

describe("Engagement Service - Health Check", () => {
  it("returns 200 ok when database query succeeds", async () => {
    const { app } = makeTestApp();
    const res = await call(app, "/health");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      status: "ok",
      service: "engagement-service",
      database: "ok",
    });
  });

  it("returns 503 degraded when database query fails", async () => {
    const { app } = makeTestApp({
      prisma: {
        $queryRaw: async () => {
          throw new Error("DB connection failed");
        },
      } as any,
    });
    const res = await call(app, "/health");
    expect(res.status).toBe(503);
    expect(res.data.status).toBe("degraded");
    expect(res.data.database).toBe("unavailable");
  });
});
