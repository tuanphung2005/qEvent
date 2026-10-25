import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../src/index";
import { prisma } from "../src/plugins/prisma";

const BASE = "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await app.handle(
    new Request(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    })
  );
  return (await res.json()).token;
}

function headers(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Không set GEMINI_API_KEY → AI_ENABLED=false: kiểm tra phân quyền và mã 503.
describe("AI endpoints when GEMINI_API_KEY is missing", () => {
  let organizerToken = "";
  let attendeeToken = "";
  let sessionId = "";
  let gameId = "";

  beforeAll(async () => {
    organizerToken = await login("organizer@qevent.com");
    attendeeToken = await login("attendee2@qevent.com");

    const session = await prisma.session.findFirst({ where: { isLive: true } });
    if (!session) throw new Error("Cần DB đã seed trước khi chạy test");
    sessionId = session.id;

    const game = await prisma.quizGame.findFirst({ where: { sessionId } });
    gameId = game?.id ?? "";
  });

  it("cluster without token → 401", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/qa/cluster/${sessionId}`, { method: "POST", headers: headers() })
    );
    expect(res.status).toBe(401);
  });

  it("cluster with attendee token → 403", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/qa/cluster/${sessionId}`, {
        method: "POST",
        headers: headers(attendeeToken),
      })
    );
    expect(res.status).toBe(403);
  });

  it("cluster with unknown session → 404", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/qa/cluster/does-not-exist`, {
        method: "POST",
        headers: headers(organizerToken),
      })
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("SESSION_NOT_FOUND");
  });

  it("cluster without API key → 503 AI_NOT_CONFIGURED", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/qa/cluster/${sessionId}`, {
        method: "POST",
        headers: headers(organizerToken),
      })
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("AI_NOT_CONFIGURED");
  });

  const quizPayload = (sid: string, gid: string) =>
    JSON.stringify({
      sessionId: sid,
      gameId: gid,
      topic: "Kiểm thử",
      contextText: "Đây là nội dung tài liệu tham khảo đủ dài để vượt qua giới hạn 50 ký tự.",
      questionCount: 3,
      language: "vi",
    });

  it("generate-quiz without token → 401", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/ai/generate-quiz`, {
        method: "POST",
        headers: headers(),
        body: quizPayload(sessionId, gameId),
      })
    );
    expect(res.status).toBe(401);
  });

  it("generate-quiz with attendee token → 403", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/ai/generate-quiz`, {
        method: "POST",
        headers: headers(attendeeToken),
        body: quizPayload(sessionId, gameId),
      })
    );
    expect(res.status).toBe(403);
  });

  it("generate-quiz with unknown session → 404", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/ai/generate-quiz`, {
        method: "POST",
        headers: headers(organizerToken),
        body: quizPayload("does-not-exist", gameId),
      })
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("SESSION_NOT_FOUND");
  });

  it("generate-quiz without API key → 503 AI_NOT_CONFIGURED", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/ai/generate-quiz`, {
        method: "POST",
        headers: headers(organizerToken),
        body: quizPayload(sessionId, gameId),
      })
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("AI_NOT_CONFIGURED");
  });
});
