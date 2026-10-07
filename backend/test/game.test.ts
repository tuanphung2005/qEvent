import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../src/index";
import { prisma } from "../src/plugins/prisma";
import { calculateQuizScore } from "../src/modules/game";

describe("qCheck Kahoot-like Live Quiz Game Engine", () => {
  let attendeeToken: string;
  let attendeeId: string;
  let unCheckedInToken: string;
  let sessionId: string;
  let gameId: string;
  let question0Id: string;
  let correctOption0Id: string;
  let wrongOption0Id: string;

  beforeAll(async () => {
    // 1. Login attendee 2 (who is CHECKED_IN)
    const loginRes = await app.handle(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "attendee2@qcheck.com", password: "password123" }),
      })
    );
    const loginData = await loginRes.json();
    attendeeToken = loginData.token;
    attendeeId = loginData.user.id;

    // 2. Login attendee 1 (who is NOT checked in - only PAID)
    const guestLogin = await app.handle(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "attendee@qcheck.com", password: "password123" }),
      })
    );
    const guestData = await guestLogin.json();
    unCheckedInToken = guestData.token;

    // 3. Find seeded game
    const game = await prisma.quizGame.findFirst({
      include: {
        questions: {
          include: { options: true },
          orderBy: { orderNum: "asc" },
        },
      },
    });

    if (!game) throw new Error("Seeded quiz game not found");
    gameId = game.id;
    sessionId = game.sessionId;

    const q0 = game.questions[0];
    question0Id = q0.id;
    const correctOpt = q0.options.find((o) => o.isCorrect);
    const wrongOpt = q0.options.find((o) => !o.isCorrect);

    correctOption0Id = correctOpt!.id;
    wrongOption0Id = wrongOpt!.id;
  });

  it("1. Scoring algorithm calculates speed-weighted points correctly", () => {
    // Wrong answer always 0
    expect(calculateQuizScore(false, 1000, 20, 1000)).toBe(0);

    // Instant answer (0ms) gets 1000 points
    const instantScore = calculateQuizScore(true, 0, 20, 1000);
    expect(instantScore).toBe(1000);

    // Answer at half-time (10s of 20s) gets 750 points
    const halfTimeScore = calculateQuizScore(true, 10000, 20, 1000);
    expect(halfTimeScore).toBe(750);

    // Answer at last second (20s of 20s) gets 500 points
    const lastSecScore = calculateQuizScore(true, 20000, 20, 1000);
    expect(lastSecScore).toBe(500);
  });

  it("2. Attendees can list active quiz games in live session", async () => {
    const res = await app.handle(
      new Request(`http://localhost:3000/api/game/session/${sessionId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${attendeeToken}` },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isLive).toBe(true);
    expect(data.canPlay).toBe(true);
    expect(data.games.length).toBeGreaterThan(0);
    expect(data.games[0].id).toBe(gameId);
  });

  it("3. Host starts game -> status becomes QUESTION_ACTIVE & isCorrect is masked from players", async () => {
    const startRes = await app.handle(
      new Request(`http://localhost:3000/api/game/${gameId}/start`, {
        method: "POST",
      })
    );

    expect(startRes.status).toBe(200);
    const startData = await startRes.json();
    expect(startData.game.status).toBe("QUESTION_ACTIVE");
    expect(startData.game.currentQuestionIndex).toBe(0);

    // Verify player view hides isCorrect
    const viewRes = await app.handle(
      new Request(`http://localhost:3000/api/game/${gameId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${attendeeToken}` },
      })
    );

    expect(viewRes.status).toBe(200);
    const viewData = await viewRes.json();
    expect(viewData.currentQuestion).toBeDefined();
    // Check that options do NOT expose isCorrect while question is active
    for (const opt of viewData.currentQuestion.options) {
      expect(opt.isCorrect).toBeUndefined();
    }
  });

  it("4. Unchecked-in attendee CANNOT submit an answer (403 NOT_CHECKED_IN)", async () => {
    const answerRes = await app.handle(
      new Request(`http://localhost:3000/api/game/${gameId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${unCheckedInToken}`,
        },
        body: JSON.stringify({
          questionId: question0Id,
          optionId: correctOption0Id,
          responseTimeMs: 2000,
        }),
      })
    );

    expect(answerRes.status).toBe(403);
    const err = await answerRes.json();
    expect(err.error).toBe("NOT_CHECKED_IN");
  });

  it("5. Checked-in attendee submits correct answer -> receives score & prevents duplicate answer", async () => {
    const answerRes = await app.handle(
      new Request(`http://localhost:3000/api/game/${gameId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attendeeToken}`,
        },
        body: JSON.stringify({
          questionId: question0Id,
          optionId: correctOption0Id,
          responseTimeMs: 2500, // fast answer (2.5s)
        }),
      })
    );

    expect(answerRes.status).toBe(200);
    const ansData = await answerRes.json();
    expect(ansData.submitted).toBe(true);

    // Duplicate submission should be rejected
    const dupRes = await app.handle(
      new Request(`http://localhost:3000/api/game/${gameId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attendeeToken}`,
        },
        body: JSON.stringify({
          questionId: question0Id,
          optionId: wrongOption0Id,
          responseTimeMs: 3000,
        }),
      })
    );

    expect(dupRes.status).toBe(409);
  });

  it("6. Host reveals round -> reveals correct answer and leaderboard ranking", async () => {
    const revealRes = await app.handle(
      new Request(`http://localhost:3000/api/game/${gameId}/reveal`, {
        method: "POST",
      })
    );

    expect(revealRes.status).toBe(200);
    const data = await revealRes.json();
    expect(data.reveal.correctOptionId).toBe(correctOption0Id);
    expect(data.reveal.answerStats.length).toBe(4);
    expect(data.reveal.leaderboard.length).toBeGreaterThan(0);

    const topPlayer = data.reveal.leaderboard[0];
    expect(topPlayer.userId).toBe(attendeeId);
    expect(topPlayer.totalScore).toBeGreaterThan(900); // 2.5s out of 20s yields >900 points
    expect(topPlayer.rank).toBe(1);
  });

  it("7. Host ends game -> finishes game and returns final podium", async () => {
    const endRes = await app.handle(
      new Request(`http://localhost:3000/api/game/${gameId}/end`, {
        method: "POST",
      })
    );

    expect(endRes.status).toBe(200);
    const data = await endRes.json();
    expect(data.game.status).toBe("FINISHED");
    expect(data.results.podium.length).toBeGreaterThan(0);
    expect(data.results.podium[0].userId).toBe(attendeeId);
  });
});
