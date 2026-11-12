import { describe, expect, it } from "bun:test";
import type { Deps } from "../src/deps";
import { call, makeTestApp } from "./helpers";

describe("health", () => {
  it("reports ok when the database answers", async () => {
    const { app } = makeTestApp();
    const result = await call(app, "/health");

    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      status: "ok",
      service: "event-service",
      database: "ok",
    });
  });

  it("reports degraded when the database is unavailable", async () => {
    const prisma = {
      $queryRaw: async () => {
        throw new Error("database is down");
      },
    } as unknown as Deps["prisma"];
    const { app } = makeTestApp({ prisma });
    const result = await call(app, "/health");

    expect(result.status).toBe(503);
    expect(result.data).toEqual({
      status: "degraded",
      service: "event-service",
      database: "unavailable",
    });
  });
});
