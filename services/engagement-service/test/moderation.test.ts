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

    const hostList = await call(app, `/api/sessions/${sessionId}/questions`, { headers: organizer });
    expect(hostList.data.deletedQuestions).toHaveLength(1);

    const restored = await call(app, `/api/questions/${questionId}/restore`, {
      method: "POST",
      headers: organizer,
    });
    expect(restored.status).toBe(200);

    const after = await call(app, `/api/sessions/${sessionId}/questions`, { headers: organizer });
    expect(after.data.questions).toHaveLength(1);
    expect(after.data.deletedQuestions).toHaveLength(0);

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

  it("edits a poll title/options and deletes it", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow("user-attendee-mod");

    const created = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: organizer,
      body: { title: "Old title", options: ["A", "B"] },
    });
    const poll = created.data.poll;
    await call(app, `/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: attendee,
      body: { optionId: poll.options[0].id },
    });

    const denied = await call(app, `/api/polls/${poll.id}`, {
      method: "PATCH",
      headers: attendee,
      body: { title: "hack" },
    });
    expect(denied.status).toBe(403);

    const updated = await call(app, `/api/polls/${poll.id}`, {
      method: "PATCH",
      headers: organizer,
      body: { title: "New title", options: ["X", "Y", "Z"] },
    });
    expect(updated.status).toBe(200);
    expect(updated.data.poll.title).toBe("New title");
    expect(updated.data.poll.options.map((option: { content: string }) => option.content)).toEqual([
      "X",
      "Y",
      "Z",
    ]);
    // Replacing the option set clears the votes that pointed at the old ids.
    expect(updated.data.poll.options.every((option: { voteCount: number }) => option.voteCount === 0)).toBe(true);

    const removed = await call(app, `/api/polls/${poll.id}`, {
      method: "DELETE",
      headers: organizer,
    });
    expect(removed.status).toBe(204);

    const list = await call(app, `/api/sessions/${sessionId}/polls`);
    expect(list.data.polls).toHaveLength(0);

    const hostList = await call(app, `/api/sessions/${sessionId}/polls`, { headers: organizer });
    expect(hostList.data.deletedPolls).toHaveLength(1);
    expect(hostList.data.deletedPolls[0].title).toBe("New title");

    const restored = await call(app, `/api/polls/${poll.id}/restore`, {
      method: "POST",
      headers: organizer,
    });
    expect(restored.status).toBe(200);

    const after = await call(app, `/api/sessions/${sessionId}/polls`, { headers: organizer });
    expect(after.data.polls).toHaveLength(1);
    expect(after.data.deletedPolls).toHaveLength(0);
  });

  it("edits a question text", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow("user-attendee-mod");
    const questionId = await createQuestion(app, "original text");

    const denied = await call(app, `/api/questions/${questionId}`, {
      method: "PATCH",
      headers: attendee,
      body: { content: "hacked" },
    });
    expect(denied.status).toBe(403);

    const updated = await call(app, `/api/questions/${questionId}`, {
      method: "PATCH",
      headers: organizer,
      body: { content: "edited text" },
    });
    expect(updated.status).toBe(200);
    expect(updated.data.question.content).toBe("edited text");

    const list = await call(app, `/api/sessions/${sessionId}/questions`);
    expect(list.data.questions[0].content).toBe("edited text");
  });

  it("edits and deletes quiz questions while WAITING", async () => {
    const { app } = makeTestApp();
    const session = "session-quiz-edit";
    const game = await call(app, `/api/sessions/${session}/game`, {
      method: "POST",
      headers: organizer,
    });
    const gameId = game.data.game.id;

    const first = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: organizer,
      body: { content: "Q1", options: ["A", "B"], correctOption: 0 },
    });
    await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: organizer,
      body: { content: "Q2", options: ["C", "D", "E"], correctOption: 2 },
    });

    const denied = await call(app, `/api/game/${gameId}/question/${first.data.question.id}`, {
      method: "PATCH",
      headers: attendee,
      body: { content: "hacked" },
    });
    expect(denied.status).toBe(403);

    const patched = await call(app, `/api/game/${gameId}/question/${first.data.question.id}`, {
      method: "PATCH",
      headers: organizer,
      body: { content: "Q1 edited", correctOption: 1 },
    });
    expect(patched.status).toBe(200);
    expect(patched.data.question.content).toBe("Q1 edited");
    expect(patched.data.question.correctOption).toBe(1);

    const removed = await call(app, `/api/game/${gameId}/question/${first.data.question.id}`, {
      method: "DELETE",
      headers: organizer,
    });
    expect(removed.status).toBe(204);

    const state = await call(app, `/api/game/${gameId}`, { headers: organizer });
    expect(state.data.game.questions).toHaveLength(1);
    expect(state.data.game.questions[0].content).toBe("Q2");
    expect(state.data.deletedQuestions).toHaveLength(1);
    expect(state.data.deletedQuestions[0].content).toBe("Q1 edited");

    // Soft delete is reversible: restore puts the question back where it was.
    const restored = await call(
      app,
      `/api/game/${gameId}/question/${first.data.question.id}/restore`,
      { method: "POST", headers: organizer }
    );
    expect(restored.status).toBe(200);
    expect(restored.data.question.orderNum).toBe(0);

    const after = await call(app, `/api/game/${gameId}`, { headers: organizer });
    expect(after.data.game.questions).toHaveLength(2);
    expect(after.data.deletedQuestions).toHaveLength(0);

    const removedAgain = await call(app, `/api/game/${gameId}/question/${first.data.question.id}`, {
      method: "DELETE",
      headers: organizer,
    });
    expect(removedAgain.status).toBe(204);

    await call(app, `/api/game/${gameId}/start`, { method: "POST", headers: organizer });
    const locked = await call(app, `/api/game/${gameId}/question/${state.data.game.questions[0].id}`, {
      method: "DELETE",
      headers: organizer,
    });
    expect(locked.status).toBe(409);
  });

  it("restarts a finished quiz for a replay", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();
    fakeAdmissionClient.allow("user-attendee-mod");
    const session = "session-quiz-replay";

    const gameRes = await call(app, `/api/sessions/${session}/game`, {
      method: "POST",
      headers: organizer,
    });
    const gameId = gameRes.data.game.id;
    const question = await call(app, `/api/game/${gameId}/question`, {
      method: "POST",
      headers: organizer,
      body: { content: "Replay me", options: ["A", "B"], correctOption: 0 },
    });
    await call(app, `/api/game/${gameId}/start`, { method: "POST", headers: organizer });

    // A live question cannot be restarted out from under the players.
    const tooEarly = await call(app, `/api/game/${gameId}/restart`, {
      method: "POST",
      headers: organizer,
    });
    expect(tooEarly.status).toBe(409);

    await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: attendee,
      body: { questionId: question.data.question.id, selectedOption: 0 },
    });
    await call(app, `/api/game/${gameId}/reveal`, { method: "POST", headers: organizer });
    await call(app, `/api/game/${gameId}/end`, { method: "POST", headers: organizer });

    const before = await call(app, `/api/game/${gameId}/leaderboard`, { headers: organizer });
    expect(before.data.leaderboard.length).toBeGreaterThan(0);

    const restarted = await call(app, `/api/game/${gameId}/restart`, {
      method: "POST",
      headers: organizer,
    });
    expect(restarted.status).toBe(200);
    expect(restarted.data.game.status).toBe("WAITING");
    expect(restarted.data.game.currentQuestionIndex).toBe(0);

    const after = await call(app, `/api/game/${gameId}/leaderboard`, { headers: organizer });
    expect(after.data.leaderboard).toHaveLength(0);

    const again = await call(app, `/api/game/${gameId}/start`, { method: "POST", headers: organizer });
    expect(again.status).toBe(200);
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
