import { describe, expect, it } from "bun:test";
import { makeTestApp, call } from "./helpers";

describe("Engagement Service - Quiz Game Engine", () => {
  const sessionId = "session-game-test";
  const organizerId = "user-organizer-game";
  const attendeeId = "user-attendee-game-1";
  const attendee2Id = "user-attendee-game-2";

  it("1. POST /api/sessions/:id/game requires host role", async () => {
    const { app } = makeTestApp();

    const attendeeRes = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
    });
    expect(attendeeRes.status).toBe(403);

    const hostRes = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(hostRes.status).toBe(201);
    expect(hostRes.data.game.status).toBe("WAITING");
    expect(hostRes.data.game.sessionId).toBe(sessionId);
  });

  it("2. Host adds questions to game in WAITING status", async () => {
    const { app } = makeTestApp();

    // Create game
    const gameRes = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = gameRes.data.game.id;

    // Add Question 0
    const q0Res = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Đâu là ưu điểm lớn nhất của Bun so với Node.js?",
        options: [
          "Tốc độ khởi động và thực thi nhanh",
          "Dung lượng bộ nhớ lớn hơn",
          "Chỉ hỗ trợ Windows",
          "Không hỗ trợ TypeScript",
        ],
        correctOption: 0,
        timeLimitSec: 20,
      },
    });
    expect(q0Res.status).toBe(201);
    expect(q0Res.data.question.orderNum).toBe(0);

    // Add Question 1
    const q1Res = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Mã HTTP 409 biểu thị lỗi gì?",
        options: ["Unauthorized", "Not Found", "Conflict", "Bad Request"],
        correctOption: 2,
        timeLimitSec: 15,
      },
    });
    expect(q1Res.status).toBe(201);
    expect(q1Res.data.question.orderNum).toBe(1);
  });

  it("3. GET /api/game/:id hides questions/answers from attendees during WAITING", async () => {
    const { app } = makeTestApp();

    const gameRes = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = gameRes.data.game.id;

    await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Câu hỏi bí mật?",
        options: ["Đáp án A", "Đáp án B"],
        correctOption: 0,
      },
    });

    // Attendee sees no questions array
    const attendeeView = await call(app, `/api/game/${gameId}`, {
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
    });
    expect(attendeeView.status).toBe(200);
    expect(attendeeView.data.game.questions).toBeUndefined();
    expect(attendeeView.data.game.totalQuestions).toBe(1);

    // Host sees questions with correctOption
    const hostView = await call(app, `/api/game/${gameId}`, {
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(hostView.status).toBe(200);
    expect(hostView.data.game.questions.length).toBe(1);
    expect(hostView.data.game.questions[0].correctOption).toBe(0);
  });

  it("4. Full Game Lifecycle: WAITING -> start -> QUESTION_ACTIVE -> reveal -> ROUND_REVEALED -> next -> end -> FINISHED", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow(attendeeId);
    fakeAdmissionClient.allow(attendee2Id);

    // Create game
    const gameRes = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    const gameId = gameRes.data.game.id;

    // Add 2 questions
    const q0 = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Câu 1: Thủ đô của Việt Nam là gì?",
        options: ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Huế"],
        correctOption: 0,
        timeLimitSec: 30,
      },
    });
    const q0Id = q0.data.question.id;

    const q1 = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        content: "Câu 2: 2 + 2 bằng mấy?",
        options: ["3", "4", "5", "6"],
        correctOption: 1,
        timeLimitSec: 30,
      },
    });
    const q1Id = q1.data.question.id;

    // START
    const startRes = await call(app, `/api/game/${gameId}/start`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(startRes.status).toBe(200);
    expect(startRes.data.game.status).toBe("QUESTION_ACTIVE");
    expect(startRes.data.game.currentQuestionIndex).toBe(0);

    // SUBMIT ANSWERS FOR QUESTION 0
    // Attendee 1: Correct answer (option 0)
    const ans1 = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { questionId: q0Id, selectedOption: 0 },
    });
    expect(ans1.status).toBe(200);
    expect(ans1.data.isCorrect).toBe(true);
    expect(ans1.data.score).toBeGreaterThan(0);

    // Attendee 2: Wrong answer (option 1)
    const ans2 = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: { "x-user-id": attendee2Id, "x-user-role": "ATTENDEE" },
      body: { questionId: q0Id, selectedOption: 1 },
    });
    expect(ans2.status).toBe(200);
    expect(ans2.data.isCorrect).toBe(false);
    expect(ans2.data.score).toBe(0);

    // Duplicate answer rejected
    const dup = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { questionId: q0Id, selectedOption: 0 },
    });
    expect(dup.status).toBe(409);
    expect(dup.data.code).toBe("ALREADY_ANSWERED");

    // REVEAL
    const revealRes = await call(app, `/api/game/${gameId}/reveal`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(revealRes.status).toBe(200);
    expect(revealRes.data.game.status).toBe("ROUND_REVEALED");
    expect(revealRes.data.correctOption).toBe(0);

    // NEXT
    const nextRes = await call(app, `/api/game/${gameId}/next`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(nextRes.status).toBe(200);
    expect(nextRes.data.game.status).toBe("QUESTION_ACTIVE");
    expect(nextRes.data.game.currentQuestionIndex).toBe(1);

    // Answers for question 1: Attendee 1 answers correctly (option 1)
    const ansQ1 = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { questionId: q1Id, selectedOption: 1 },
    });
    expect(ansQ1.status).toBe(200);
    expect(ansQ1.data.isCorrect).toBe(true);

    // END
    const endRes = await call(app, `/api/game/${gameId}/end`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
    });
    expect(endRes.status).toBe(200);
    expect(endRes.data.game.status).toBe("FINISHED");

    // LEADERBOARD
    const lbRes = await call(app, `/api/game/${gameId}/leaderboard`);
    expect(lbRes.status).toBe(200);
    expect(lbRes.data.leaderboard.length).toBe(2);
    expect(lbRes.data.leaderboard[0].userId).toBe(attendeeId);
    expect(lbRes.data.leaderboard[0].correctCount).toBe(2);
    expect(lbRes.data.leaderboard[1].userId).toBe(attendee2Id);
    expect(lbRes.data.leaderboard[1].correctCount).toBe(0);
  });
});
