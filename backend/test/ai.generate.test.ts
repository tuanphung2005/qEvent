import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { app } from "../src/index";
import { prisma } from "../src/plugins/prisma";
import { createGenerateQuizRoutes } from "../src/modules/ai/routes/generate-quiz.routes";
import { AiInvalidOutputError } from "../src/services/ai.service";
import type { QuizDraftQuestion } from "../src/modules/ai/services/quiz-draft.service";

const BASE = "http://localhost:3000";

function draftQuestions(count = 1): QuizDraftQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    question: `Câu hỏi AI số ${i}`,
    timeLimitSec: 20,
    points: 1000,
    options: [
      { text: "Đáp án đúng", isCorrect: true },
      { text: "Đáp án sai 1", isCorrect: false },
      { text: "Đáp án sai 2", isCorrect: false },
      { text: "Đáp án sai 3", isCorrect: false },
    ],
  }));
}

function makeApp(draft: () => Promise<QuizDraftQuestion[]>) {
  return new Elysia().use(createGenerateQuizRoutes({ aiEnabled: true, draft }));
}

function post(app: Elysia, gameId: string, sessionId: string, token: string) {
  return app.handle(
    new Request(`${BASE}/api/ai/generate-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sessionId,
        gameId,
        topic: "Kiểm thử tạo quiz",
        contextText: "Nội dung tài liệu kiểm thử. ".repeat(10),
      }),
    })
  );
}

describe("POST /api/ai/generate-quiz (fake draft generator)", () => {
  let token = "";
  let sessionId = "";
  const gameIds: string[] = [];

  beforeAll(async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "organizer@qevent.com", password: "password123" }),
      })
    );
    token = (await res.json()).token;

    const live = await prisma.session.findFirst({ where: { isLive: true } });
    if (!live) throw new Error("Cần DB đã seed trước khi chạy test");
    sessionId = live.id;
  });

  afterAll(async () => {
    await prisma.quizGame.deleteMany({ where: { id: { in: gameIds } } });
  });

  async function createGame(status: "WAITING" | "QUESTION_ACTIVE" = "WAITING") {
    const game = await prisma.quizGame.create({
      data: { sessionId, title: `ai-generate-${Date.now()}-${gameIds.length}`, status },
    });
    gameIds.push(game.id);
    return game;
  }

  it("game đã rời WAITING → 409, không gọi AI và không ghi câu", async () => {
    let calls = 0;
    const testApp = makeApp(async () => {
      calls++;
      return draftQuestions();
    });
    const game = await createGame("QUESTION_ACTIVE");

    const res = await post(testApp, game.id, sessionId, token);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("GAME_ALREADY_STARTED");
    expect(calls).toBe(0);
    expect(await prisma.quizQuestion.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("double-submit → 1 lần gọi AI, 1 bộ câu hỏi", async () => {
    let calls = 0;
    const testApp = makeApp(async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return draftQuestions(2);
    });
    const game = await createGame();

    const [first, second] = await Promise.all([
      post(testApp, game.id, sessionId, token),
      post(testApp, game.id, sessionId, token),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(calls).toBe(1);
    expect(await prisma.quizQuestion.count({ where: { gameId: game.id } })).toBe(2);
  });

  it("host start trong lúc AI chạy → 409, không chèn câu", async () => {
    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const testApp = makeApp(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return draftQuestions();
    });
    const game = await createGame();

    const pending = post(testApp, game.id, sessionId, token);
    await startedPromise;

    await prisma.quizGame.update({
      where: { id: game.id },
      data: { status: "QUESTION_ACTIVE", currentQuestionIndex: 0 },
    });
    release();

    const res = await pending;
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("GAME_ALREADY_STARTED");
    expect(await prisma.quizQuestion.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("AI trả output không hợp lệ → 502, DB không đổi", async () => {
    const testApp = makeApp(async () => {
      throw new AiInvalidOutputError("output rỗng");
    });
    const game = await createGame();

    const res = await post(testApp, game.id, sessionId, token);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI_INVALID_OUTPUT");
    expect(await prisma.quizQuestion.count({ where: { gameId: game.id } })).toBe(0);
  });

  it("generator lỗi mạng → 500 AI_FAILED, không ghi câu", async () => {
    const testApp = makeApp(async () => {
      throw new Error("network down");
    });
    const game = await createGame();

    const res = await post(testApp, game.id, sessionId, token);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("AI_FAILED");
    expect(await prisma.quizQuestion.count({ where: { gameId: game.id } })).toBe(0);
  });
});
