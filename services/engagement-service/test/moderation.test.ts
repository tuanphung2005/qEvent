import { describe, expect, it } from "bun:test";
import { call, makeTestApp } from "./helpers";

const sessionId = "session-moderation";
const organizer = { "x-user-id": "user-organizer-mod", "x-user-role": "ORGANIZER" };
const attendee = { "x-user-id": "user-attendee-mod", "x-user-role": "ATTENDEE" };

async function createQuestion(app: ReturnType<typeof makeTestApp>["app"], content: string) {
  const result = await call(app, `/api/sessions/${sessionId}/questions`, {
    method: "POST",
    headers: attendee,
    body: { content },
  });
  expect(result.status).toBe(201);
  return result.data.question.id as string;
}

describe("host moderation", () => {
  it("deletes a question only for hosts", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow("user-attendee-mod");
    const questionId = await createQuestion(app, "delete me");

    const denied = await call(app, `/api/questions/${questionId}`, {
      method: "DELETE",
      headers: attendee,
    });
    expect(denied.status).toBe(403);

    const deleted = await call(app, `/api/questions/${questionId}`, {
      method: "DELETE",
      headers: organizer,
    });
    expect(deleted.status).toBe(204);

    const list = await call(app, `/api/sessions/${sessionId}/questions`);
    expect(list.data.questions).toHaveLength(0);

    const missing = await call(app, "/api/questions/missing", {
      method: "DELETE",
      headers: organizer,
    });
    expect(missing.status).toBe(404);
  });

  it("closes a poll so votes are rejected", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow("user-attendee-mod");

    const created = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: organizer,
      body: { title: "Close me", options: ["A", "B"] },
    });
    const poll = created.data.poll;

    const closed = await call(app, `/api/polls/${poll.id}`, {
      method: "PATCH",
      headers: organizer,
      body: { isActive: false },
    });
    expect(closed.status).toBe(200);
    expect(closed.data.poll.isActive).toBe(false);

    const vote = await call(app, `/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: attendee,
      body: { optionId: poll.options[0].id },
    });
    expect(vote.status).toBe(400);
    expect(vote.data.code).toBe("POLL_INACTIVE");

    const denied = await call(app, `/api/polls/${poll.id}`, {
      method: "PATCH",
      headers: attendee,
      body: { isActive: true },
    });
    expect(denied.status).toBe(403);

    const missing = await call(app, "/api/polls/missing", {
      method: "PATCH",
      headers: organizer,
      body: { isActive: true },
    });
    expect(missing.status).toBe(404);
  });

  it("returns session counters for the dashboard", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow("user-attendee-mod");
    const questionId = await createQuestion(app, "top question");

    const poll = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: organizer,
      body: { title: "Active poll", options: ["A", "B"] },
    });
    await call(app, `/api/polls/${poll.data.poll.id}/vote`, {
      method: "POST",
      headers: attendee,
      body: { optionId: poll.data.poll.options[0].id },
    });

    const game = await call(app, `/api/sessions/${sessionId}/game`, {
      method: "POST",
      headers: organizer,
    });
    await call(app, `/api/game/${game.data.game.id}/question`, {
      method: "POST",
      headers: organizer,
      body: { content: "Q?", options: ["A", "B"], correctOption: 0 },
    });

    const stats = await call(app, `/api/sessions/${sessionId}/stats`, {
      headers: organizer,
    });
    expect(stats.status).toBe(200);
    expect(stats.data.questions.total).toBeGreaterThanOrEqual(1);
    expect(stats.data.questions.topQuestion.id).toBe(questionId);
    expect(stats.data.activePoll.id).toBe(poll.data.poll.id);
    expect(stats.data.activePoll.totalVotes).toBe(1);
    expect(stats.data.game.totalQuestions).toBe(1);

    const anonymous = await call(app, `/api/sessions/${sessionId}/stats`);
    expect(anonymous.status).toBe(401);

    const denied = await call(app, `/api/sessions/${sessionId}/stats`, {
      headers: attendee,
    });
    expect(denied.status).toBe(403);

    const missingSession = await call(app, "/api/sessions/unknown/stats", {
      headers: organizer,
    });
    expect(missingSession.status).toBe(200);
    expect(missingSession.data.questions.total).toBe(0);
    expect(missingSession.data.activePoll).toBeNull();
    expect(missingSession.data.game).toBeNull();
  });
});
