import { describe, expect, it } from "bun:test";
import { makeTestApp, call } from "./helpers";

describe("Engagement Service - Security & Anti-Cheat Guards", () => {
  const sessionId = "session-sec-test";
  const organizerId = "user-organizer-sec";
  const victimId = "user-victim-1";
  const attackerId = "user-attacker-1";

  it("1. Reject start from unauthorized or non-host users", async () => {
    const { app } = makeTestApp();
    const game = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = game.data.game.id;

    // No token -> 401
    const noToken = await call(app, `/api/game/${gameId}/start`, { method: "POST" });
    expect(noToken.status).toBe(401);

    // Attendee -> 403
    const attendee = await call(app, `/api/game/${gameId}/start`, {
      method: "POST",
      headers: { "x-user-id": attackerId, "x-user-role": "ATTENDEE" },
    });
    expect(attendee.status).toBe(403);
  });

  it("2. State Machine Transitions enforce strict CAS flow", async () => {
    const { app } = makeTestApp();
    const game = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = game.data.game.id;

    // Add question
    await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Bảo mật trong Microservices?",
        options: ["Centralized Auth", "Basic Auth"],
        correctOption: 0,
      },
    });

    // 2a. Reveal before Start -> 409
    const earlyReveal = await call(app, `/api/game/${gameId}/reveal`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(earlyReveal.status).toBe(409);

    // 2b. Start game
    const start = await call(app, `/api/game/${gameId}/start`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(start.status).toBe(200);

    // 2c. Next before Reveal -> 409
    const earlyNext = await call(app, `/api/game/${gameId}/next`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(earlyNext.status).toBe(409);

    // 2d. End game -> FINISHED
    const end = await call(app, `/api/game/${gameId}/end`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(end.status).toBe(200);

    // 2e. Re-start or re-end FINISHED game -> 409 (no resurrecting finished game)
    const restart = await call(app, `/api/game/${gameId}/start`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(restart.status).toBe(409);

    const reEnd = await call(app, `/api/game/${gameId}/end`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(reEnd.status).toBe(409);
  });

  it("3. Anti-Spoofing: Server enforces identity from JWT and ignores body.userId", async () => {
    const { app, fakeAdmissionClient, inMemoryPrisma } = makeTestApp();
    fakeAdmissionClient.allow(attackerId);

    const game = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = game.data.game.id;

    const q = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Test câu hỏi",
        options: ["A", "B"],
        correctOption: 0,
      },
    });
    const qId = q.data.question.id;

    await call(app, `/api/game/${gameId}/start`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });

    // Attacker submits answer attempting to impersonate victimId in body
    const ans = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: { "x-user-id": attackerId, "x-user-role": "ATTENDEE" },
      body: {
        questionId: qId,
        selectedOption: 0,
        userId: victimId, // spoof attempt
      },
    });
    expect(ans.status).toBe(200);

    // Verify stored answer in DB is attributed to attackerId, NOT victimId
    const stored = inMemoryPrisma.quizAnswers.find((a) => a.questionId === qId);
    expect(stored.userId).toBe(attackerId);
    expect(stored.userId).not.toBe(victimId);
  });

  it("4. Anti-Speed-Hack: Server calculates responseTimeMs authoritative from questionStartedAt", async () => {
    const startTime = new Date("2026-11-11T12:00:00.000Z");
    let currentTime = new Date("2026-11-11T12:00:00.000Z");

    const { app, fakeAdmissionClient } = makeTestApp({
      now: () => currentTime,
    });
    fakeAdmissionClient.allow(attackerId);

    const game = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = game.data.game.id;

    const q = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Test thời gian phản hồi",
        options: ["A", "B"],
        correctOption: 0,
        timeLimitSec: 20,
      },
    });
    const qId = q.data.question.id;

    // Start at 12:00:00
    await call(app, `/api/game/${gameId}/start`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });

    // Attacker answers 10 seconds later (12:00:10) but sends responseTimeMs: 0
    currentTime = new Date("2026-11-11T12:00:10.000Z"); // 10s elapsed
    const ans = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: { "x-user-id": attackerId, "x-user-role": "ATTENDEE" },
      body: {
        questionId: qId,
        selectedOption: 0,
        responseTimeMs: 0, // Cheater claims instant answer
      },
    });

    expect(ans.status).toBe(200);
    // Server calculates exactly 10,000ms, not 0ms!
    expect(ans.data.responseTimeMs).toBe(10000);
    // Score at half-time of 20s (10s): 1000 * (1 - 10000 / 40000) = 750 points (not 1000)
    expect(ans.data.score).toBe(750);
  });

  it("5. Rejects answer submitted after timeLimitSec + 2s grace", async () => {
    let currentTime = new Date("2026-11-11T12:00:00.000Z");

    const { app, fakeAdmissionClient } = makeTestApp({
      now: () => currentTime,
    });
    fakeAdmissionClient.allow(attackerId);

    const game = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = game.data.game.id;

    const q = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Test hết giờ",
        options: ["A", "B"],
        correctOption: 0,
        timeLimitSec: 10, // 10s limit, grace is 2s -> max 12s
      },
    });
    const qId = q.data.question.id;

    await call(app, `/api/game/${gameId}/start`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });

    // Advance 13 seconds (past limit + grace)
    currentTime = new Date("2026-11-11T12:00:13.000Z");

    const lateAns = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: { "x-user-id": attackerId, "x-user-role": "ATTENDEE" },
      body: { questionId: qId, selectedOption: 0 },
    });
    expect(lateAns.status).toBe(400);
    expect(lateAns.data.code).toBe("ANSWER_TOO_LATE");
  });
});
