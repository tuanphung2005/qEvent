import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import { call, makeTestApp } from "./helpers";

const { app } = makeTestApp();

function uniqueEmail() {
  return `auth-${crypto.randomUUID()}@test.local`;
}

describe("auth", () => {
  it("registers an attendee and returns a JWT", async () => {
    const email = uniqueEmail();
    const result = await call(app, "/api/auth/register", {
      method: "POST",
      body: { email, password: "password123", fullName: "Auth User" },
    });

    expect(result.status).toBe(201);
    expect(result.data.token).toBeString();
    expect(result.data.user.email).toBe(email);
    expect(result.data.user.role).toBe("ATTENDEE");
  });

  it("never grants STAFF or ORGANIZER through public registration", async () => {
    const result = await call(app, "/api/auth/register", {
      method: "POST",
      body: {
        email: uniqueEmail(),
        password: "password123",
        fullName: "Sneaky User",
        role: "ORGANIZER",
      },
    });

    expect(result.status).toBe(201);
    expect(result.data.user.role).toBe("ATTENDEE");
  });

  it("normalizes email and rejects duplicates with 409", async () => {
    const email = uniqueEmail();
    const first = await call(app, "/api/auth/register", {
      method: "POST",
      body: { email, password: "password123", fullName: "First" },
    });
    expect(first.status).toBe(201);

    const duplicate = await call(app, "/api/auth/register", {
      method: "POST",
      body: { email: email.toUpperCase(), password: "password123", fullName: "Second" },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.data.code).toBe("EMAIL_TAKEN");
  });

  it("rejects short passwords", async () => {
    const result = await call(app, "/api/auth/register", {
      method: "POST",
      body: { email: uniqueEmail(), password: "short", fullName: "Short" },
    });
    expect(result.status).toBe(422);
  });

  it("logs in with valid credentials and rejects wrong ones", async () => {
    const email = uniqueEmail();
    await call(app, "/api/auth/register", {
      method: "POST",
      body: { email, password: "password123", fullName: "Login User" },
    });

    const ok = await call(app, "/api/auth/login", {
      method: "POST",
      body: { email, password: "password123" },
    });
    expect(ok.status).toBe(200);
    expect(ok.data.user.email).toBe(email);

    const wrong = await call(app, "/api/auth/login", {
      method: "POST",
      body: { email, password: "wrong-password" },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.data.code).toBe("INVALID_CREDENTIALS");
  });

  it("protects ticket and order routes without a valid JWT", async () => {
    expect((await call(app, "/api/tickets")).status).toBe(401);
    expect((await call(app, "/api/orders/anything")).status).toBe(401);
    expect(
      (await call(app, "/api/tickets", { token: "not-a-jwt" })).status
    ).toBe(401);
  });
});
