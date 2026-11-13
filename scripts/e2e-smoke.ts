/**
 * End-to-end smoke test through the API Gateway (no direct service calls).
 *
 * Preconditions:
 *   docker compose up -d
 *   seeds for the 3 services
 *   the seeded session must be live for the Q&A/quiz part
 *
 *   bun scripts/e2e-smoke.ts
 *
 * Exits non-zero when a required check fails. Missing optional data (e.g. the
 * quiz already started) is reported as SKIP rather than failing the run.
 */
const BASE = process.env.GATEWAY_URL ?? "http://localhost:8000";

type Json = any;
type Result = { status: number; data: Json };

async function req(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Result> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const res = await fetch(BASE + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let data: Json = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

let failures = 0;
let passes = 0;
let skips = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passes++;
    console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    failures++;
    console.log(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
  }
}

function skip(label: string, reason: string) {
  skips++;
  console.log(`SKIP ${label} (${reason})`);
}

async function main() {
  const login = (email: string) =>
    req("/api/auth/login", {
      method: "POST",
      body: { email, password: "password123" },
    });

  const organizer = await login("organizer@qevent.com");
  const staff = await login("staff1@qevent.com");
  check("organizer login", organizer.status === 200);
  check("staff login", staff.status === 200);

  const me = await req("/api/auth/me", { token: organizer.data.token });
  check(
    "auth/me restores the session",
    me.status === 200 && me.data.user.role === "ORGANIZER"
  );

  const attendee = await req("/api/auth/register", {
    method: "POST",
    body: {
      email: `e2e-${crypto.randomUUID()}@qevent.test`,
      password: "password123",
      fullName: "E2E Attendee",
    },
  });
  check("attendee registration", attendee.status === 201);
  const attendeeToken = attendee.data.token as string;

  const events = await req("/api/events");
  check("list events", events.status === 200);
  const event = events.data.events[0];
  if (!event) throw new Error("no seeded event");
  let session = event.sessions[0];
  const ticketType = event.ticketTypes[0];
  check("seed has session and ticket type", Boolean(session && ticketType));

  const badJwt = await req("/api/events", { token: "invalid.token.here" });
  check("invalid JWT is rejected", badJwt.status === 401 && badJwt.data.code === "UNAUTHORIZED");

  if (session && !session.isLive) {
    const live = await req(`/api/events/${event.id}/sessions/${session.id}`, {
      method: "PATCH",
      token: organizer.data.token,
      body: { isLive: true },
    });
    check("PATCH session isLive", live.status === 200 && live.data.session.isLive === true);
    session = { ...session, isLive: true };
  }

  if (event.rooms?.[0]) {
    const room = await req(`/api/events/${event.id}/rooms/${event.rooms[0].id}`, {
      method: "PATCH",
      token: organizer.data.token,
      body: { capacity: event.rooms[0].capacity },
    });
    check("PATCH room", room.status === 200);
  }

  if (ticketType) {
    const ticketTypeUpdate = await req(
      `/api/events/${event.id}/ticket-types/${ticketType.id}`,
      {
        method: "PATCH",
        token: organizer.data.token,
        body: { price: ticketType.price },
      }
    );
    check("PATCH ticket type", ticketTypeUpdate.status === 200);
  }

  if (session?.isLive) {
    const before = await req(`/api/sessions/${session.id}/questions`, {
      method: "POST",
      token: attendeeToken,
      body: { content: "before check-in" },
    });
    check(
      "BR-6 rejects before check-in",
      before.status === 403 && before.data.code === "NOT_CHECKED_IN"
    );
  } else {
    skip("BR-6 before check-in", "seeded session is not live");
  }

  const order = await req("/api/orders", {
    method: "POST",
    token: attendeeToken,
    headers: { "idempotency-key": crypto.randomUUID() },
    body: { eventId: event.id, ticketTypeId: ticketType.id, quantity: 1 },
  });
  check("create order", order.status === 201, `status ${order.status}`);
  const ticketId = order.data?.order?.tickets?.[0]?.id;
  check("order issued one ticket", Boolean(ticketId));

  const replay = await req("/api/orders", {
    method: "POST",
    token: attendeeToken,
    headers: { "idempotency-key": crypto.randomUUID() },
    body: { eventId: event.id, ticketTypeId: ticketType.id, quantity: 1 },
  });
  check(
    "a new idempotency key creates a new order",
    replay.status === 201 && replay.data.order.id !== order.data.order.id
  );

  const qr = await req(`/api/tickets/${ticketId}/qr-token`, { token: attendeeToken });
  check("issue QR token", qr.status === 200);

  const checkin = await req("/api/checkins", {
    method: "POST",
    token: staff.data.token,
    body: { qrToken: qr.data.qrToken, deviceId: "gate:e2e" },
  });
  check("check-in", checkin.status === 201 && checkin.data.code === "CHECKIN_SUCCESS");

  const myTickets = await req("/api/tickets/my", { token: attendeeToken });
  check("list my tickets", myTickets.status === 200);

  const staffOrders = await req(`/api/orders?eventId=${event.id}`, {
    token: staff.data.token,
  });
  check("staff order list", staffOrders.status === 200 && staffOrders.data.orders.length > 0);

  const staffTickets = await req(`/api/tickets?eventId=${event.id}`, {
    token: staff.data.token,
  });
  check(
    "staff ticket list",
    staffTickets.status === 200 && staffTickets.data.tickets.some((t: any) => t.id === ticketId)
  );

  const ticketDetail = await req(`/api/tickets/${ticketId}`, { token: staff.data.token });
  check(
    "staff ticket detail without qrSecret",
    ticketDetail.status === 200 && ticketDetail.data.ticket.qrSecret === undefined
  );

  const feed = await req(`/api/checkins?eventId=${event.id}`, { token: staff.data.token });
  check(
    "check-in feed",
    feed.status === 200 && feed.data.checkins.some((log: any) => log.ticketId === ticketId)
  );

  const stats = await req(`/api/checkins/stats?eventId=${event.id}`, {
    token: staff.data.token,
  });
  check(
    "check-in stats",
    stats.status === 200 && stats.data.tickets.checkedIn >= 1 && stats.data.orders.confirmed >= 1
  );

  if (session?.isLive) {
    const after = await req(`/api/sessions/${session.id}/questions`, {
      method: "POST",
      token: attendeeToken,
      body: { content: "after check-in" },
    });
    check("BR-6 accepts after check-in", after.status === 201);
    if (after.status === 201) {
      const questionId = after.data.question.id;
      const vote = await req(`/api/questions/${questionId}/votes`, {
        method: "PUT",
        token: attendeeToken,
      });
      check("upvote", vote.status === 200 && vote.data.hasVoted === true);

      const removed = await req(`/api/questions/${questionId}`, {
        method: "DELETE",
        token: organizer.data.token,
      });
      check("delete question", removed.status === 204);
      const remaining = await req(`/api/sessions/${session.id}/questions`);
      check(
        "deleted question is gone",
        !remaining.data.questions.some((question: any) => question.id === questionId)
      );
    }

    const polls = await req(`/api/sessions/${session.id}/polls`);
    if (polls.status === 200 && polls.data.polls.length > 0) {
      const poll = polls.data.polls[0];
      const vote = await req(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        token: attendeeToken,
        body: { optionId: poll.options[0].id },
      });
      check("poll vote", vote.status === 200);

      const closed = await req(`/api/polls/${poll.id}`, {
        method: "PATCH",
        token: organizer.data.token,
        body: { isActive: false },
      });
      check("close poll", closed.status === 200 && closed.data.poll.isActive === false);
      await req(`/api/polls/${poll.id}`, {
        method: "PATCH",
        token: organizer.data.token,
        body: { isActive: true },
      });
    } else {
      skip("poll vote", "no seeded poll");
    }

    const sessionStats = await req(`/api/sessions/${session.id}/stats`, {
      token: organizer.data.token,
    });
    check(
      "session stats",
      sessionStats.status === 200 && typeof sessionStats.data.questions.total === "number"
    );

    const game = await req(`/api/sessions/${session.id}/game`);
    if (game.status === 200) {
      const gameId = game.data.game.id;
      const start = await req(`/api/game/${gameId}/start`, {
        method: "POST",
        token: organizer.data.token,
      });
      if (start.status === 200 || start.status === 409) {
        const hostView = await req(`/api/game/${gameId}`, { token: organizer.data.token });
        const gameState = hostView.data.game;
        const active = gameState.questions?.[gameState.currentQuestionIndex];
        if (active && gameState.status === "QUESTION_ACTIVE") {
          const answer = await req(`/api/game/${gameId}/answer`, {
            method: "POST",
            token: attendeeToken,
            body: { questionId: active.id, selectedOption: 0 },
          });
          if (answer.status === 200 || answer.status === 409) {
            check("quiz answer", true, `status ${answer.status}`);
          } else if (
            answer.status === 400 &&
            ["ANSWER_TOO_LATE", "ANSWER_WINDOW_CLOSED", "NOT_CURRENT_QUESTION"].includes(
              answer.data.code
            )
          ) {
            skip("quiz answer", `question window closed (${answer.data.code}); reseed for a full run`);
          } else {
            check("quiz answer", false, `${answer.status} ${answer.data.code}`);
          }
        } else {
          skip("quiz answer", `game status is ${gameState.status}`);
        }
      }
    } else {
      skip("quiz", "no seeded game");
    }
  } else {
    skip("Q&A/poll/quiz", "seeded session is not live");
  }

  const wsMessage = await new Promise<string>((resolve) => {
    const ws = new WebSocket(`ws://localhost:8000/ws/qa?token=${encodeURIComponent(attendeeToken)}`);
    const timer = setTimeout(() => {
      ws.close();
      resolve("timeout");
    }, 3000);
    ws.onopen = () => ws.send(JSON.stringify({ type: "JOIN_SESSION", sessionId: "e2e" }));
    ws.onmessage = (event) => {
      clearTimeout(timer);
      ws.close();
      resolve(String(event.data));
    };
    ws.onerror = () => {
      clearTimeout(timer);
      resolve("error");
    };
  });
  check("authenticated WebSocket joins", wsMessage.includes("JOINED_SESSION"));

  const anonymous = await new Promise<number>((resolve) => {
    const ws = new WebSocket("ws://localhost:8000/ws/qa");
    ws.onclose = (event) => resolve(event.code);
    ws.onerror = () => {};
  });
  check("anonymous WebSocket is closed", anonymous === 4401, `code ${anonymous}`);

  console.log(`\n${passes} passed, ${failures} failed, ${skips} skipped`);
  if (failures > 0) process.exit(1);
}

await main();
