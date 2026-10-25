import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { app } from "../src/index";
import { prisma } from "../src/plugins/prisma";

const BASE = "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await app.handle(
    new Request(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    })
  );
  const data = await res.json();
  return data.token;
}

function auth(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(token?: string): Record<string, string> {
  return { "Content-Type": "application/json", ...auth(token) };
}

describe("Game module security & state machine", () => {
  let organizerToken = "";
  let attendeeToken = "";
  let unCheckedInToken = "";
  let attendeeId = "";
  let sessionId = "";
  const gameIds: string[] = [];

  const optionBody = (n: number, correctIndex = 0) =>
    Array.from({ length: n }, (_, i) => ({ text: `Đáp án ${i}`, isCorrect: i === correctIndex }));

  async function addQuestion(gameId: string, orderNum: number, timeLimitSec = 20) {
    return prisma.quizQuestion.create({
      data: {
        gameId,
        orderNum,
        question: `Câu hỏi ${orderNum}`,
        timeLimitSec,
        points: 1000,
        options: {
          create: optionBody(4).map((o, idx) => ({
            text: o.text,
            color: (["RED", "BLUE", "YELLOW", "GREEN"] as const)[idx % 4],
            isCorrect: o.isCorrect,
          })),
        },
      },
      include: { options: true },
    });
  }

  async function createGame(opts: { questions?: number; status?: "WAITING" } = {}) {
    const game = await prisma.quizGame.create({
      data: {
        sessionId,
        title: `security-test-${Date.now()}-${gameIds.length}`,
        status: opts.status ?? "WAITING",
      },
    });
    gameIds.push(game.id);

    const questions = [];
    for (let i = 0; i < (opts.questions ?? 0); i++) {
      questions.push(await addQuestion(game.id, i));
    }
    return { id: game.id, questions };
  }

  beforeAll(async () => {
    organizerToken = await login("organizer@qevent.com");
    attendeeToken = await login("attendee2@qevent.com");
    unCheckedInToken = await login("attendee@qevent.com");

    const attendee = await prisma.user.findUnique({ where: { email: "attendee2@qevent.com" } });
    attendeeId = attendee!.id;

    const liveSession = await prisma.session.findFirst({ where: { isLive: true } });
    if (!liveSession) throw new Error("Cần DB đã seed trước khi chạy test");
    sessionId = liveSession.id;
  });

  afterAll(async () => {
    await prisma.quizGame.deleteMany({ where: { id: { in: gameIds } } });
  });

  it("1. POST /start without token → 401", async () => {
    const game = await createGame({ questions: 1 });
    const res = await app.handle(new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("2. POST /start as attendee → 403", async () => {
    const game = await createGame({ questions: 1 });
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(attendeeToken) })
    );
    expect(res.status).toBe(403);
  });

  it("3. POST /start with 0 questions as organizer → 422 NO_QUESTIONS", async () => {
    const game = await createGame({ questions: 0 });
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("NO_QUESTIONS");
  });

  it("4. POST /start as organizer → 200, QUESTION_ACTIVE, index 0", async () => {
    const game = await createGame({ questions: 2 });
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.game.status).toBe("QUESTION_ACTIVE");
    expect(data.game.currentQuestionIndex).toBe(0);
  });

  it("5. POST /start a second time → 409 and questionStartedAt unchanged", async () => {
    const game = await createGame({ questions: 1 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const before = await prisma.quizQuestion.findFirst({ where: { gameId: game.id } });

    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("INVALID_GAME_STATE");

    const after = await prisma.quizQuestion.findFirst({ where: { gameId: game.id } });
    expect(after!.questionStartedAt!.getTime()).toBe(before!.questionStartedAt!.getTime());
  });

  it("6. POST /next while QUESTION_ACTIVE → 409 (must reveal first)", async () => {
    const game = await createGame({ questions: 2 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/next`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("INVALID_GAME_STATE");
  });

  it("7. POST /next without token → 401 (auth before state)", async () => {
    const game = await createGame({ questions: 2 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const res = await app.handle(new Request(`${BASE}/api/game/${game.id}/next`, { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("8. POST /reveal while QUESTION_ACTIVE → 200 ROUND_REVEALED", async () => {
    const game = await createGame({ questions: 2 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/reveal`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).game.status).toBe("ROUND_REVEALED");
  });

  it("9. POST /reveal a second time → 409", async () => {
    const game = await createGame({ questions: 1 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/reveal`, { method: "POST", headers: auth(organizerToken) })
    );
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/reveal`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(409);
  });

  it("10. POST /next after reveal → 200, index + 1, new questionStartedAt", async () => {
    const game = await createGame({ questions: 2 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const firstBefore = await prisma.quizQuestion.findFirst({ where: { gameId: game.id, orderNum: 0 } });

    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/reveal`, { method: "POST", headers: auth(organizerToken) })
    );
    await new Promise((r) => setTimeout(r, 10));

    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/next`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.game.currentQuestionIndex).toBe(1);

    const second = await prisma.quizQuestion.findFirst({ where: { gameId: game.id, orderNum: 1 } });
    expect(second!.questionStartedAt).not.toBeNull();
    expect(second!.questionStartedAt!.getTime()).toBeGreaterThan(firstBefore!.questionStartedAt!.getTime());
  });

  it("11. FINISHED game cannot start/next/reveal again", async () => {
    const game = await createGame({ questions: 1 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/end`, { method: "POST", headers: auth(organizerToken) })
    );

    for (const action of ["start", "next", "reveal"]) {
      const res = await app.handle(
        new Request(`${BASE}/api/game/${game.id}/${action}`, { method: "POST", headers: auth(organizerToken) })
      );
      expect(res.status).toBe(409);
    }
  });

  it("12. POST /end a second time → 409", async () => {
    const game = await createGame({ questions: 1 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/end`, { method: "POST", headers: auth(organizerToken) })
    );
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/end`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(409);
  });

  it("13. POST /end with unknown gameId → 404 (not 500)", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/game/does-not-exist/end`, { method: "POST", headers: auth(organizerToken) })
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("GAME_NOT_FOUND");
  });

  it("14. two parallel /start requests → exactly one 200 and one 409", async () => {
    const game = await createGame({ questions: 1 });
    const call = () =>
      app.handle(
        new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
      );
    const [a, b] = await Promise.all([call(), call()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const q = await prisma.quizQuestion.findFirst({ where: { gameId: game.id } });
    expect(q!.questionStartedAt).not.toBeNull();
  });

  it("15. POST question without token → 401", async () => {
    const game = await createGame({ questions: 0 });
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ question: "Hỏi gì?", options: optionBody(4) }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("16. POST question as attendee → 403", async () => {
    const game = await createGame({ questions: 0 });
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body: JSON.stringify({ question: "Hỏi gì?", options: optionBody(4) }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("17. POST question while QUESTION_ACTIVE → 409", async () => {
    const game = await createGame({ questions: 1 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question`, {
        method: "POST",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify({ question: "Chèn giữa ván", options: optionBody(4) }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("18. POST question with 2 correct options → 400", async () => {
    const game = await createGame({ questions: 0 });
    const options = optionBody(4).map((o) => ({ ...o, isCorrect: true }));
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question`, {
        method: "POST",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify({ question: "Hai đáp án đúng", options }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_OPTIONS");
  });

  it("19. POST question with 4 identical option texts → 400", async () => {
    const game = await createGame({ questions: 0 });
    const options = optionBody(4).map((o) => ({ ...o, text: "Giống nhau" }));
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question`, {
        method: "POST",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify({ question: "Bốn đáp án trùng", options }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_OPTIONS");
  });

  it("20. POST question with timeLimitSec 0 → rejected by TypeBox", async () => {
    const game = await createGame({ questions: 0 });
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question`, {
        method: "POST",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify({ question: "Thời gian 0", timeLimitSec: 0, options: optionBody(4) }),
      })
    );
    // Elysia trả 422 cho lỗi schema (kế hoạch ghi 400; đây là hành vi mặc định của framework)
    expect([400, 422]).toContain(res.status);
  });

  it("21. orderNum = max + 1 (deleting a question does not create a duplicate)", async () => {
    const game = await createGame({ questions: 2 });
    await prisma.quizQuestion.delete({ where: { id: game.questions[0]!.id } });

    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question`, {
        method: "POST",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify({ question: "Câu thêm sau khi xoá", options: optionBody(4) }),
      })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).question.orderNum).toBe(2);
  });

  it("22. answer body userId is ignored; answer is recorded for the token holder", async () => {
    const game = await createGame({ questions: 1 });
    const q = game.questions[0]!;
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );

    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body: JSON.stringify({
          questionId: q.id,
          optionId: q.options[0]!.id,
          responseTimeMs: 0,
          userId: "someone-else",
        }),
      })
    );
    expect(res.status).toBe(200);

    const row = await prisma.quizAnswer.findFirst({ where: { questionId: q.id } });
    expect(row!.userId).toBe(attendeeId);
  });

  it("23. answer without token → 401", async () => {
    const game = await createGame({ questions: 1 });
    const q = game.questions[0]!;
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ questionId: q.id, optionId: q.options[0]!.id }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("24. answering a future question → 400 NOT_CURRENT_QUESTION", async () => {
    const game = await createGame({ questions: 2 });
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const future = game.questions[1]!;
    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body: JSON.stringify({ questionId: future.id, optionId: future.options[0]!.id }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("NOT_CURRENT_QUESTION");
  });

  it("25. answering after timeLimitSec + 2s → 400 ANSWER_TOO_LATE", async () => {
    const game = await createGame({ questions: 1 });
    const q = game.questions[0]!;
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    await prisma.quizQuestion.update({
      where: { id: q.id },
      data: { questionStartedAt: new Date(Date.now() - 30_000) },
    });

    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body: JSON.stringify({ questionId: q.id, optionId: q.options[0]!.id }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ANSWER_TOO_LATE");
  });

  it("26. client responseTimeMs is ignored; score uses server time", async () => {
    const game = await createGame({ questions: 1 });
    const q = game.questions[0]!;
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    await prisma.quizQuestion.update({
      where: { id: q.id },
      data: { questionStartedAt: new Date(Date.now() - 2_500) },
    });

    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body: JSON.stringify({ questionId: q.id, optionId: q.options[0]!.id, responseTimeMs: 0 }),
      })
    );
    expect(res.status).toBe(200);

    const row = await prisma.quizAnswer.findFirst({ where: { questionId: q.id } });
    expect(row!.responseTimeMs).toBeGreaterThanOrEqual(2_500);
    expect(row!.scoreAwarded).toBeGreaterThan(900);
    expect(row!.scoreAwarded).toBeLessThan(1_000);
  });

  it("27. answering the same question twice → 409 ALREADY_ANSWERED", async () => {
    const game = await createGame({ questions: 1 });
    const q = game.questions[0]!;
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );

    const body = JSON.stringify({ questionId: q.id, optionId: q.options[0]!.id });
    const first = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body,
      })
    );
    expect(first.status).toBe(200);

    const second = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body,
      })
    );
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBe("ALREADY_ANSWERED");
  });

  it("28. answering after reveal → 400 ANSWER_WINDOW_CLOSED", async () => {
    const game = await createGame({ questions: 1 });
    const q = game.questions[0]!;
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/reveal`, { method: "POST", headers: auth(organizerToken) })
    );

    const res = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body: JSON.stringify({ questionId: q.id, optionId: q.options[0]!.id }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ANSWER_WINDOW_CLOSED");
  });

  it("29. POST /session/:sessionId is host-only", async () => {
    const noToken = await app.handle(
      new Request(`${BASE}/api/game/session/${sessionId}`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ title: "Game mới" }),
      })
    );
    expect(noToken.status).toBe(401);

    const attendee = await app.handle(
      new Request(`${BASE}/api/game/session/${sessionId}`, {
        method: "POST",
        headers: jsonHeaders(attendeeToken),
        body: JSON.stringify({ title: "Game mới" }),
      })
    );
    expect(attendee.status).toBe(403);

    const organizer = await app.handle(
      new Request(`${BASE}/api/game/session/${sessionId}`, {
        method: "POST",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify({ title: "Game mới" }),
      })
    );
    expect(organizer.status).toBe(201);
    const created = await organizer.json();
    gameIds.push(created.game.id);
  });

  it("30. WS JOIN_GAME with unknown game → GAME_NOT_FOUND and no subscribe", async () => {
    const message = await new Promise<any>((resolve, reject) => {
      const ws = new WebSocket("ws://localhost:3000/api/game/ws/game");
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("WS timeout"));
      }, 5_000);

      ws.onopen = () => ws.send(JSON.stringify({ type: "JOIN_GAME", gameId: "does-not-exist" }));
      ws.onmessage = (event) => {
        clearTimeout(timer);
        ws.close();
        resolve(JSON.parse(String(event.data)));
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WS error"));
      };
    });

    expect(message.type).toBe("GAME_NOT_FOUND");
    expect(message.gameId).toBe("does-not-exist");
  });

  it("31. GET game: host thấy questions + isCorrect, player không thấy cả hai", async () => {
    const game = await createGame({ questions: 1 });

    const hostRes = await app.handle(
      new Request(`${BASE}/api/game/${game.id}`, { headers: auth(organizerToken) })
    );
    const host = await hostRes.json();
    expect(host.questions).toHaveLength(1);
    expect(host.questions[0].options.every((o: any) => typeof o.isCorrect === "boolean")).toBe(true);

    const playerRes = await app.handle(
      new Request(`${BASE}/api/game/${game.id}`, { headers: auth(attendeeToken) })
    );
    const player = await playerRes.json();
    expect(player.questions).toBeUndefined();

    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );
    const activeRes = await app.handle(
      new Request(`${BASE}/api/game/${game.id}`, { headers: auth(attendeeToken) })
    );
    const active = await activeRes.json();
    expect(active.currentQuestion).not.toBeNull();
    expect(
      active.currentQuestion.options.every((o: any) => o.isCorrect === undefined)
    ).toBe(true);
  });

  it("32. PATCH trước start áp nội dung mới; PATCH sau start → 409", async () => {
    const game = await createGame({ questions: 1 });
    const q = game.questions[0]!;
    const edited = {
      question: "Câu hỏi đã được host sửa",
      timeLimitSec: 30,
      points: 1200,
      options: [
        { text: "Đáp án đúng", isCorrect: true },
        { text: "Đáp án sai 1", isCorrect: false },
        { text: "Đáp án sai 2", isCorrect: false },
        { text: "Đáp án sai 3", isCorrect: false },
      ],
    };

    const patched = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question/${q.id}`, {
        method: "PATCH",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify(edited),
      })
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).question.question).toBe(edited.question);

    await app.handle(
      new Request(`${BASE}/api/game/${game.id}/start`, { method: "POST", headers: auth(organizerToken) })
    );

    const afterStart = await app.handle(
      new Request(`${BASE}/api/game/${game.id}/question/${q.id}`, {
        method: "PATCH",
        headers: jsonHeaders(organizerToken),
        body: JSON.stringify(edited),
      })
    );
    expect(afterStart.status).toBe(409);
    expect((await afterStart.json()).error).toBe("INVALID_GAME_STATE");

    const activeRes = await app.handle(
      new Request(`${BASE}/api/game/${game.id}`, { headers: auth(organizerToken) })
    );
    const active = await activeRes.json();
    expect(active.currentQuestion.question).toBe(edited.question);
    expect(active.currentQuestion.options.find((o: any) => o.isCorrect).text).toBe("Đáp án đúng");
  });
});
