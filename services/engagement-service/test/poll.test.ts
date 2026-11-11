import { describe, expect, it } from "bun:test";
import { makeTestApp, call } from "./helpers";

describe("Engagement Service - Poll Routes", () => {
  const sessionId = "session-test-poll";
  const organizerId = "user-organizer-1";
  const attendeeId = "user-attendee-poll-1";

  it("1. GET /api/sessions/:id/polls returns empty array initially", async () => {
    const { app } = makeTestApp();
    const res = await call(app, `/api/sessions/${sessionId}/polls`);
    expect(res.status).toBe(200);
    expect(res.data.polls).toEqual([]);
  });

  it("2. POST /api/sessions/:id/polls without token returns 401", async () => {
    const { app } = makeTestApp();
    const res = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      body: { title: "Bạn dùng công nghệ gì?", options: ["Node", "Bun"] },
    });
    expect(res.status).toBe(401);
  });

  it("3. POST /api/sessions/:id/polls with ATTENDEE returns 403 FORBIDDEN", async () => {
    const { app } = makeTestApp();
    const res = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { title: "Thăm dò từ attendee", options: ["A", "B"] },
    });
    expect(res.status).toBe(403);
    expect(res.data.code).toBe("FORBIDDEN");
  });

  it("4. POST /api/sessions/:id/polls with < 2 options returns 400 or 422", async () => {
    const { app } = makeTestApp();
    const res = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: { title: "Thăm dò thiếu option", options: ["Chỉ một lựa chọn"] },
    });
    expect([400, 422]).toContain(res.status);
  });

  it("5. POST /api/sessions/:id/polls with ORGANIZER creates poll (201)", async () => {
    const { app } = makeTestApp();
    const res = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        title: "Đánh giá chất lượng hội thảo hôm nay?",
        options: ["Rất tốt", "Bình thường", "Cần cải thiện"],
      },
    });

    expect(res.status).toBe(201);
    expect(res.data.poll.title).toBe("Đánh giá chất lượng hội thảo hôm nay?");
    expect(res.data.poll.options.length).toBe(3);
  });

  it("6. POST /api/polls/:id/vote enforces BR-6 and handles voting lifecycle", async () => {
    const { app, fakeAdmissionClient } = makeTestApp();

    // Create poll
    const pollRes = await call(app, `/api/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: { "x-user-id": organizerId, "x-user-role": "ORGANIZER" },
      body: {
        title: "Bạn có hài lòng không?",
        options: ["Có", "Không"],
      },
    });
    const pollId = pollRes.data.poll.id;
    const option0Id = pollRes.data.poll.options[0].id;
    const option1Id = pollRes.data.poll.options[1].id;

    // 6a. Vote without check-in -> 403
    fakeAdmissionClient.disallow(attendeeId);
    const voteFail = await call(app, `/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { optionId: option0Id },
    });
    expect(voteFail.status).toBe(403);
    expect(voteFail.data.code).toBe("NOT_CHECKED_IN");

    // 6b. Vote with check-in -> 200 (voted: true)
    fakeAdmissionClient.allow(attendeeId);
    const voteSuccess = await call(app, `/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { optionId: option0Id },
    });
    expect(voteSuccess.status).toBe(200);
    expect(voteSuccess.data.voted).toBe(true);

    // 6c. Vote same option again -> unvote (voted: false)
    const unvote = await call(app, `/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { optionId: option0Id },
    });
    expect(unvote.status).toBe(200);
    expect(unvote.data.voted).toBe(false);

    // 6d. Vote option 0 then switch to option 1
    await call(app, `/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { optionId: option0Id },
    });
    const switchVote = await call(app, `/api/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "x-user-id": attendeeId, "x-user-role": "ATTENDEE" },
      body: { optionId: option1Id },
    });
    expect(switchVote.status).toBe(200);
    expect(switchVote.data.voted).toBe(true);
    expect(switchVote.data.optionId).toBe(option1Id);
  });
});
