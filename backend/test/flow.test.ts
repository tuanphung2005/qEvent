import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../src/index";
import { generateTOTP, signDynamicQRPayload } from "../src/config/keys";
import { prisma } from "../src/plugins/prisma";

describe("qEvent End-to-End Flow: Register -> Check-in -> Live Event Q&A & Polls", () => {
  let organizerToken: string;
  let staffToken: string;
  let attendeeToken: string;
  let attendeeId: string;
  let attendeeEmail = `attendee_flow_${Date.now()}@qevent.com`;

  let eventId: string;
  let ticketTypeId: string;
  let liveSessionId: string;
  let upcomingSessionId: string;

  let ticketId: string;
  let totpSecret: string;
  let pollId: string;
  let pollOptionId: string;

  beforeAll(async () => {
    // 1. Log in staff and organizer from seed
    const staffLoginRes = await app.handle(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "staff1@qevent.com", password: "password123" }),
      })
    );
    const staffData = await staffLoginRes.json();
    staffToken = staffData.token;

    // Fetch existing live event & sessions from seed
    const event = await prisma.event.findFirst({
      where: { isLive: true },
      include: {
        ticketTypes: true,
        sessions: true,
      },
    });

    if (!event) throw new Error("Seed event not found");
    eventId = event.id;
    ticketTypeId = event.ticketTypes[0].id;

    const liveSession = event.sessions.find((s) => s.isLive);
    const upcomingSession = event.sessions.find((s) => !s.isLive);

    liveSessionId = liveSession!.id;
    upcomingSessionId = upcomingSession!.id;
  });

  // STEP 1: ĐĂNG KÝ (USER REGISTRATION & TICKET REGISTRATION)
  it("Step 1.1: Attendee can register new account (POST /api/auth/register)", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: attendeeEmail,
          password: "password123",
          fullName: "Nguyen Van A",
        }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe(attendeeEmail);
    expect(data.user.role).toBe("ATTENDEE");

    attendeeToken = data.token;
    attendeeId = data.user.id;
  });

  it("Step 1.2: Attendee registers/purchases an event ticket (POST /api/tickets/register)", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/tickets/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attendeeToken}`,
        },
        body: JSON.stringify({
          eventId,
          ticketTypeId,
          quantity: 1,
        }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.tickets).toBeDefined();
    expect(data.tickets.length).toBe(1);

    const ticket = data.tickets[0];
    expect(ticket.status).toBe("PAID");
    expect(ticket.totpSecret).toBeDefined();
    expect(ticket.qrToken).toBeDefined();

    ticketId = ticket.id;
    totpSecret = ticket.totpSecret;
  });

  it("Step 1.3: Verify ticket status before check-in is NOT checked in", async () => {
    const res = await app.handle(
      new Request(`http://localhost:3000/api/checkin/status/${eventId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${attendeeToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isRegistered).toBe(true);
    expect(data.isCheckedIn).toBe(false);
    expect(data.status).toBe("PAID");
  });

  // STEP 2: ĐIỂM DANH (CHECK-IN VERIFICATION AT THE GATE)
  it("Step 2.1: Staff performs gate check-in scanning Dynamic QR (POST /api/checkin/verify)", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const code = generateTOTP(totpSecret);
    const qrToken = signDynamicQRPayload({
      tid: ticketId,
      eid: eventId,
      code,
      iat: nowSec,
    });

    const res = await app.handle(
      new Request("http://localhost:3000/api/checkin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          qrToken,
          deviceId: "Gate_A_Scanner_01",
        }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("SUCCESS");
    expect(data.code).toBe("CHECKIN_SUCCESS");
    expect(data.ticket.id).toBe(ticketId);
  });

  it("Step 2.2: Re-scanning immediately detects duplicate check-in (Screen AMBER)", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const code = generateTOTP(totpSecret);
    const qrToken = signDynamicQRPayload({
      tid: ticketId,
      eid: eventId,
      code,
      iat: nowSec,
    });

    const res = await app.handle(
      new Request("http://localhost:3000/api/checkin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          qrToken,
          deviceId: "Gate_A_Scanner_01",
        }),
      })
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.status).toBe("ALREADY_CHECKED_IN");
    expect(data.code).toBe("ALREADY_CHECKED_IN");
  });

  it("Step 2.3: Attendee status is now marked as CHECKED_IN", async () => {
    const res = await app.handle(
      new Request(`http://localhost:3000/api/checkin/status/${eventId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${attendeeToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isRegistered).toBe(true);
    expect(data.isCheckedIn).toBe(true);
    expect(data.status).toBe("CHECKED_IN");
    expect(data.checkedInAt).toBeDefined();
  });

  // STEP 3: NẾU TRONG THỜI GIAN LIVE EVENT -> HIỂN THỊ QA / CÂU HỎI TƯƠNG TÁC
  it("Step 3.1: Attendee fetches Live Session -> sees Q&A and Interactive Questions (Polls)", async () => {
    const res = await app.handle(
      new Request(`http://localhost:3000/api/qa/session/${liveSessionId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${attendeeToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isLive).toBe(true);
    expect(data.sessionStatus).toBe("LIVE");
    expect(data.userAccess.isCheckedIn).toBe(true);
    expect(data.userAccess.canInteract).toBe(true);
    expect(data.questions).toBeDefined();
    expect(data.polls).toBeDefined();
    expect(data.polls.length).toBeGreaterThan(0);

    pollId = data.polls[0].id;
    pollOptionId = data.polls[0].options[0].id;
  });

  it("Step 3.2: Checked-in attendee posts Q&A question during Live Event -> SUCCESS", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/qa/question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attendeeToken}`,
        },
        body: JSON.stringify({
          sessionId: liveSessionId,
          content: "Diễn giả có thể chia sẻ sâu hơn về cơ chế chống duplicate check-in offline?",
        }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.question).toBeDefined();
    expect(data.question.content).toContain("duplicate check-in");
    expect(data.question.userId).toBe(attendeeId);
  });

  it("Step 3.3: Attendee upvotes a Q&A question -> SUCCESS", async () => {
    // Get existing question
    const listRes = await app.handle(
      new Request(`http://localhost:3000/api/qa/session/${liveSessionId}`)
    );
    const listData = await listRes.json();
    const firstQ = listData.questions[0];

    const upvoteRes = await app.handle(
      new Request(`http://localhost:3000/api/qa/upvote/${firstQ.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attendeeToken}`,
        },
        body: JSON.stringify({}),
      })
    );

    expect(upvoteRes.status).toBe(200);
    const voteData = await upvoteRes.json();
    expect(voteData.hasVoted).toBe(true);
    expect(voteData.upvotes).toBe(firstQ.upvotes + 1);
  });

  it("Step 3.4: Attendee participates in interactive question (Poll) -> SUCCESS", async () => {
    const res = await app.handle(
      new Request(`http://localhost:3000/api/qa/poll/${pollId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attendeeToken}`,
        },
        body: JSON.stringify({
          optionId: pollOptionId,
        }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pollId).toBe(pollId);
    expect(data.userVotedOptionId).toBe(pollOptionId);
    expect(data.tally).toBeDefined();
    expect(data.totalVotes).toBeGreaterThan(0);
  });

  // STEP 4: GATING ENFORCEMENT (REJECTIONS WHEN NOT LIVE OR NOT CHECKED-IN)
  it("Step 4.1: Unchecked-in attendee CANNOT post question or vote", async () => {
    // Create an un-checked-in user
    const guestEmail = `guest_${Date.now()}@qevent.com`;
    const regRes = await app.handle(
      new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: guestEmail,
          password: "password123",
          fullName: "Chua Diem Danh",
        }),
      })
    );
    const guestData = await regRes.json();

    const postRes = await app.handle(
      new Request("http://localhost:3000/api/qa/question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${guestData.token}`,
        },
        body: JSON.stringify({
          sessionId: liveSessionId,
          content: "Tôi chưa điểm danh liệu có hỏi được không?",
        }),
      })
    );

    expect(postRes.status).toBe(403);
    const postErr = await postRes.json();
    expect(postErr.error).toBe("NOT_CHECKED_IN");
  });

  it("Step 4.2: Session that is NOT LIVE rejects posting question", async () => {
    const postRes = await app.handle(
      new Request("http://localhost:3000/api/qa/question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${attendeeToken}`,
        },
        body: JSON.stringify({
          sessionId: upcomingSessionId,
          content: "Hỏi trước giờ sự kiện",
        }),
      })
    );

    expect(postRes.status).toBe(403);
    const postErr = await postRes.json();
    expect(postErr.error).toBe("EVENT_NOT_LIVE");
  });
});
