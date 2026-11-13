import { describe, expect, it } from "bun:test";
import { InfraError } from "../src/lib/resilient-fetch";
import type { AccessVerification, AdmissionClient } from "../src/lib/admission-client";
import { call, makeTestApp } from "./helpers";

const organizer = { "x-user-id": "user-organizer-br6", "x-user-role": "ORGANIZER" };
const attendee = { "x-user-id": "user-attendee-br6", "x-user-role": "ATTENDEE" };

/** Only grants access to one exact (userId, eventId) pair, so a forged eventId fails. */
class StrictAdmissionClient implements AdmissionClient {
  constructor(private readonly allowedUserId: string, private readonly allowedEventId: string) {}

  async verifyAccess(userId: string, eventId: string): Promise<AccessVerification> {
    const hasAccess = userId === this.allowedUserId && eventId === this.allowedEventId;
    return { hasAccess, checkedIn: hasAccess, ticketId: hasAccess ? "ticket-1" : null };
  }
}

class DownAdmissionClient implements AdmissionClient {
  async verifyAccess(): Promise<AccessVerification> {
    throw new InfraError("downstream unreachable");
  }
}

class TimeoutAdmissionClient implements AdmissionClient {
  async verifyAccess(): Promise<AccessVerification> {
    throw new InfraError("downstream timeout");
  }
}

class TimeoutEventClient {
  async getSession(): Promise<never> {
    throw new InfraError("downstream timeout");
  }
}

async function createPoll(app: ReturnType<typeof makeTestApp>["app"], sessionId: string) {
  const res = await call(app, `/api/sessions/${sessionId}/polls`, {
    method: "POST",
    headers: organizer,
    body: { title: "BR-6 poll", options: ["A", "B"] },
  });
  expect(res.status).toBe(201);
  return res.data.poll;
}

async function createActiveGame(app: ReturnType<typeof makeTestApp>["app"], sessionId: string) {
  const game = await call(app, `/api/sessions/${sessionId}/game`, {
    method: "POST",
    headers: organizer,
  });
  const gameId = game.data.game.id;
  const question = await call(app, `/api/game/${gameId}/question`, {
    method: "POST",
    headers: organizer,
    body: { content: "BR-6?", options: ["A", "B"], correctOption: 0, timeLimitSec: 30 },
  });
  await call(app, `/api/game/${gameId}/start`, { method: "POST", headers: organizer });
  return { gameId, questionId: question.data.question.id };
}

describe("BR-6 session access guard", () => {
  it("rejects a session that is not live", async () => {
    const { app, fakeEventClient } = makeTestApp();
    fakeEventClient.setSession("session-offline", "event-1", false);

    const res = await call(app, "/api/sessions/session-offline/questions", {
      method: "POST",
      headers: attendee,
      body: { content: "hello" },
    });

    expect(res.status).toBe(403);
    expect(res.data.code).toBe("SESSION_NOT_LIVE");
  });

  it("rejects an unknown session with 404", async () => {
    const { app, fakeEventClient } = makeTestApp();
    fakeEventClient.markMissing("session-ghost");

    const res = await call(app, "/api/sessions/session-ghost/questions", {
      method: "POST",
      headers: attendee,
      body: { content: "hello" },
    });

    expect(res.status).toBe(404);
    expect(res.data.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns 503 when Event Service is unavailable (not 403)", async () => {
    const { app, fakeEventClient } = makeTestApp();
    fakeEventClient.failWith("session-down");

    const res = await call(app, "/api/sessions/session-down/questions", {
      method: "POST",
      headers: attendee,
      body: { content: "hello" },
    });

    expect(res.status).toBe(503);
    expect(res.data.code).toBe("EVENT_SERVICE_UNAVAILABLE");
  });

  it("returns 504 when Event Service times out (not 403)", async () => {
    const { app } = makeTestApp({ eventClient: new TimeoutEventClient() as any });

    const res = await call(app, "/api/sessions/session-1/questions", {
      method: "POST",
      headers: attendee,
      body: { content: "hello" },
    });

    expect(res.status).toBe(504);
    expect(res.data.code).toBe("EVENT_SERVICE_TIMEOUT");
  });

  it("returns 504 when Admission Service times out (not 403)", async () => {
    const { app } = makeTestApp({ admissionClient: new TimeoutAdmissionClient() });

    const res = await call(app, "/api/sessions/session-1/questions", {
      method: "POST",
      headers: attendee,
      body: { content: "hello" },
    });

    expect(res.status).toBe(504);
    expect(res.data.code).toBe("ADMISSION_SERVICE_TIMEOUT");
  });

  it("returns 503 when Admission Service is unavailable (not 403)", async () => {
    const { app } = makeTestApp({ admissionClient: new DownAdmissionClient() });

    const res = await call(app, "/api/sessions/session-1/questions", {
      method: "POST",
      headers: attendee,
      body: { content: "hello" },
    });

    expect(res.status).toBe(503);
    expect(res.data.code).toBe("ADMISSION_SERVICE_UNAVAILABLE");
  });

  it("ignores a forged body.eventId and uses the session's real event", async () => {
    const { app, fakeEventClient } = makeTestApp({
      admissionClient: new StrictAdmissionClient("user-attendee-br6", "real-event"),
    });
    fakeEventClient.setSession("session-real", "real-event", true);

    const res = await call(app, "/api/sessions/session-real/questions", {
      method: "POST",
      headers: attendee,
      body: { content: "forged event", eventId: "another-event" },
    });

    // The request succeeds only because the real event ("real-event") is used;
    // a forged eventId would fail the strict admission client with 403.
    expect(res.status).toBe(201);
    expect(res.data.question.userId).toBe("user-attendee-br6");
  });

  it("applies the guard to poll votes and quiz answers", async () => {
    const { app, fakeEventClient } = makeTestApp({
      admissionClient: new StrictAdmissionClient("user-attendee-br6", "real-event"),
    });
    fakeEventClient.setSession("session-real", "real-event", true);

    const poll = await createPoll(app, "session-real");
    const pollVote = await call(app, `/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: attendee,
      body: { optionId: poll.options[0].id },
    });
    expect(pollVote.status).toBe(200);

    const { gameId, questionId } = await createActiveGame(app, "session-real");
    const answer = await call(app, `/api/game/${gameId}/answer`, {
      method: "POST",
      headers: attendee,
      body: { questionId, selectedOption: 0 },
    });
    expect(answer.status).toBe(200);
  });

  it("returns 503 for poll votes when Event Service is down", async () => {
    const { app, fakeEventClient } = makeTestApp();
    const poll = await createPoll(app, "session-vote-down");
    fakeEventClient.failWith("session-vote-down");

    const res = await call(app, `/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: attendee,
      body: { optionId: poll.options[0].id },
    });

    expect(res.status).toBe(503);
    expect(res.data.code).toBe("EVENT_SERVICE_UNAVAILABLE");
  });
});
