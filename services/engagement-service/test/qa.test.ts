import { describe, expect, it } from "bun:test";
import { makeTestApp, call } from "./helpers";

describe("Engagement Service - Q&A Routes", () => {
  const sessionId = "session-test-qa";
  const attendeeId = "user-attendee-qa-1";

  it("1. GET /api/sessions/:id/questions returns empty array initially", async () => {
    const { app } = makeTestApp();
    const res = await call(app, `/api/sessions/${sessionId}/questions`);
    expect(res.status).toBe(200);
    expect(res.data.sessionId).toBe(sessionId);
    expect(res.data.questions).toEqual([]);
  });

  it("2. POST /api/sessions/:id/questions without token returns 401", async () => {
    const { app } = makeTestApp();
    const res = await call(app, `/api/sessions/${sessionId}/questions`, {
      method: "POST",
      body: { content: "Làm sao để scale hệ thống?" },
    });
    expect(res.status).toBe(401);
    expect(res.data.code).toBe("UNAUTHORIZED");
  });

  it("3. POST /api/sessions/:id/questions with un-checked-in attendee returns 403 NOT_CHECKED_IN", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.disallow(attendeeId);

    const res = await call(app, `/api/sessions/${sessionId}/questions`, {
      method: "POST",
      headers: {
        "x-user-id": attendeeId,
        "x-user-role": "ATTENDEE",
      },
      body: { content: "Câu hỏi từ người chưa check-in" },
    });

    expect(res.status).toBe(403);
    expect(res.data.code).toBe("NOT_CHECKED_IN");
  });

  it("4. POST /api/sessions/:id/questions with checked-in attendee returns 201", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow(attendeeId);

    const res = await call(app, `/api/sessions/${sessionId}/questions`, {
      method: "POST",
      headers: {
        "x-user-id": attendeeId,
        "x-user-role": "ATTENDEE",
      },
      body: { content: "Kiến trúc Event-Driven có ứng dụng trong qEvent không?" },
    });

    expect(res.status).toBe(201);
    expect(res.data.question.content).toBe("Kiến trúc Event-Driven có ứng dụng trong qEvent không?");
    expect(res.data.question.userId).toBe(attendeeId);
    expect(res.data.question.upvotes).toBe(0);
  });

  it("5. PUT /api/questions/:id/votes toggles upvote correctly", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow(attendeeId);

    // Create question first
    const createRes = await call(app, `/api/sessions/${sessionId}/questions`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { content: "Câu hỏi test upvote" },
    });
    const questionId = createRes.data.question.id;

    // First upvote
    const vote1 = await call(app, `/api/questions/${questionId}/votes`, {
      method: "PUT",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
    });
    expect(vote1.status).toBe(200);
    expect(vote1.data.upvotes).toBe(1);
    expect(vote1.data.hasVoted).toBe(true);

    // Second upvote by same user -> unvote
    const vote2 = await call(app, `/api/questions/${questionId}/votes`, {
      method: "PUT",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
    });
    expect(vote2.status).toBe(200);
    expect(vote2.data.upvotes).toBe(0);
    expect(vote2.data.hasVoted).toBe(false);
  });

  it("6. PUT /api/questions/:id/votes on non-existent question returns 404", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow(attendeeId);

    const res = await call(app, "/api/questions/non-existent-id/votes", {
      method: "PUT",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
    });
    expect(res.status).toBe(404);
    expect(res.data.code).toBe("QUESTION_NOT_FOUND");
  });
});
