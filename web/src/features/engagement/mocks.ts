import { http, HttpResponse } from "msw";
import { attendee, sessionFixture } from "../../../test/msw/fixtures";
import type { Game, Poll, QAQuestion } from "./types";

export const initialQuestions: QAQuestion[] = [
  {
    id: "question-uuid-1",
    sessionId: sessionFixture.id,
    userId: attendee.id,
    content: "Làm thế nào để scale WebSocket lên 100k kết nối đồng thời?",
    upvotes: 15,
    createdAt: "2026-11-20T01:10:00.000Z",
  },
  {
    id: "question-uuid-2",
    sessionId: sessionFixture.id,
    userId: "0f7a1b2c-0000-4000-8000-000000000099",
    content: "Chiến lược Circuit Breaker phục hồi sau bao nhiêu giây?",
    upvotes: 8,
    createdAt: "2026-11-20T01:12:00.000Z",
  },
];

export const initialPolls: Poll[] = [
  {
    id: "poll-uuid-1",
    sessionId: sessionFixture.id,
    title: "Bạn thấy nội dung bài diễn thuyết Keynote thế nào?",
    isActive: true,
    createdAt: "2026-11-20T01:05:00.000Z",
    options: [
      { id: "opt-1", pollId: "poll-uuid-1", content: "Rất xuất sắc", voteCount: 42 },
      { id: "opt-2", pollId: "poll-uuid-1", content: "Hữu ích, thực tế", voteCount: 28 },
      { id: "opt-3", pollId: "poll-uuid-1", content: "Cần chi tiết kỹ thuật hơn", voteCount: 10 },
    ],
  },
];

export const initialGame: Game = {
  id: "game-uuid-1",
  sessionId: sessionFixture.id,
  status: "WAITING",
  currentQuestionIndex: 0,
  totalQuestions: 2,
  questions: [
    {
      id: "gq-1",
      orderNum: 0,
      content: "Thuật toán nào ngăn chặn check-in trùng lặp vé?",
      options: ["Redis CAS", "Optimistic Locking", "Token Bucket", "Paxos"],
      correctOption: 0,
      timeLimitSec: 30,
      questionStartedAt: null,
    },
    {
      id: "gq-2",
      orderNum: 1,
      content: "Giao thức nào được sử dụng để phát broadcast câu hỏi trực tiếp?",
      options: ["HTTP Long-polling", "WebSocket", "gRPC-Web", "WebRTC"],
      correctOption: 1,
      timeLimitSec: 20,
      questionStartedAt: null,
    },
  ],
};

let questions = [...initialQuestions];
const polls = [...initialPolls];
let game: Game | null = { ...initialGame };

export const handlers = [
  // Q&A
  http.get("/api/sessions/:sessionId/questions", ({ params }) => {
    const list = questions.filter((q) => q.sessionId === params.sessionId);
    return HttpResponse.json({ sessionId: params.sessionId, questions: list });
  }),

  http.post("/api/sessions/:sessionId/questions", async ({ params, request }) => {
    const body = (await request.json()) as { content: string };
    const newQuestion: QAQuestion = {
      id: `q-${Date.now()}`,
      sessionId: String(params.sessionId),
      userId: attendee.id,
      content: body.content,
      upvotes: 0,
      createdAt: new Date().toISOString(),
    };
    questions.push(newQuestion);
    return HttpResponse.json({ question: newQuestion }, { status: 201 });
  }),

  http.put("/api/questions/:questionId/votes", ({ params }) => {
    const q = questions.find((item) => item.id === params.questionId);
    if (!q) return new HttpResponse(null, { status: 404 });
    q.upvotes += 1;
    return HttpResponse.json({ questionId: q.id, upvotes: q.upvotes, hasVoted: true });
  }),

  http.patch("/api/questions/:questionId", async ({ params, request }) => {
    const body = (await request.json()) as { content: string };
    const q = questions.find((item) => item.id === params.questionId);
    if (!q) return new HttpResponse(null, { status: 404 });
    q.content = body.content;
    return HttpResponse.json({ question: q });
  }),

  http.delete("/api/questions/:questionId", ({ params }) => {
    questions = questions.filter((q) => q.id !== params.questionId);
    return HttpResponse.json({ success: true });
  }),

  // Polls
  http.get("/api/sessions/:sessionId/polls", ({ params }) => {
    const list = polls.filter((p) => p.sessionId === params.sessionId);
    return HttpResponse.json({ sessionId: params.sessionId, polls: list });
  }),

  http.post("/api/sessions/:sessionId/polls", async ({ params, request }) => {
    const body = (await request.json()) as { title: string; options: string[] };
    const pollId = `poll-${Date.now()}`;
    const newPoll: Poll = {
      id: pollId,
      sessionId: String(params.sessionId),
      title: body.title,
      isActive: true,
      createdAt: new Date().toISOString(),
      options: body.options.map((opt, idx) => ({
        id: `opt-${pollId}-${idx}`,
        pollId,
        content: opt,
        voteCount: 0,
      })),
    };
    polls.push(newPoll);
    return HttpResponse.json({ poll: newPoll }, { status: 201 });
  }),

  http.patch("/api/polls/:pollId", async ({ params, request }) => {
    const body = (await request.json()) as {
      isActive?: boolean;
      title?: string;
      options?: string[];
    };
    const p = polls.find((item) => item.id === params.pollId);
    if (!p) return new HttpResponse(null, { status: 404 });
    if (body.isActive !== undefined) p.isActive = body.isActive;
    if (body.title !== undefined) p.title = body.title;
    if (body.options) {
      p.options = body.options.map((content, idx) => ({
        id: `opt-${p.id}-${idx}-${Date.now()}`,
        pollId: p.id,
        content,
        voteCount: 0,
      }));
    }
    return HttpResponse.json({ poll: p });
  }),

  http.delete("/api/polls/:pollId", ({ params }) => {
    const idx = polls.findIndex((item) => item.id === params.pollId);
    if (idx < 0) return new HttpResponse(null, { status: 404 });
    polls.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Quiz Game
  http.get("/api/sessions/:sessionId/game", ({ params }) => {
    if (game && game.sessionId === params.sessionId) {
      return HttpResponse.json({ game });
    }
    return HttpResponse.json({ game: null });
  }),

  http.post("/api/sessions/:sessionId/game", ({ params }) => {
    game = {
      ...initialGame,
      id: `game-${Date.now()}`,
      sessionId: String(params.sessionId),
      status: "WAITING",
      currentQuestionIndex: 0,
    };
    return HttpResponse.json({ game }, { status: 201 });
  }),

  http.post("/api/game/:gameId/question", async ({ request }) => {
    const body = (await request.json()) as {
      content: string;
      options: string[];
      correctOption: number;
      timeLimitSec?: number;
    };
    const newQ = {
      id: `gq-${Date.now()}`,
      orderNum: game?.questions?.length ?? 0,
      content: body.content,
      options: body.options,
      correctOption: body.correctOption,
      timeLimitSec: body.timeLimitSec ?? 30,
      questionStartedAt: null,
    };
    if (game) {
      game.questions = [...(game.questions ?? []), newQ];
      game.totalQuestions = game.questions.length;
    }
    return HttpResponse.json({ question: newQ }, { status: 201 });
  }),

  http.patch("/api/game/:gameId/question/:questionId", async ({ params, request }) => {
    const body = (await request.json()) as {
      content?: string;
      options?: string[];
      correctOption?: number;
      timeLimitSec?: number;
    };
    const q = game?.questions?.find((item) => item.id === params.questionId);
    if (!q) return new HttpResponse(null, { status: 404 });
    Object.assign(q, body);
    return HttpResponse.json({ question: q });
  }),

  http.delete("/api/game/:gameId/question/:questionId", ({ params }) => {
    if (game?.questions) {
      game.questions = game.questions
        .filter((item) => item.id !== params.questionId)
        .map((item, index) => ({ ...item, orderNum: index }));
      game.totalQuestions = game.questions.length;
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("/api/game/:gameId", () => {
    game = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/game/:gameId/start", () => {
    if (game) {
      game.status = "QUESTION_ACTIVE";
      game.currentQuestionIndex = 0;
    }
    return HttpResponse.json({ game });
  }),

  http.post("/api/game/:gameId/reveal", () => {
    if (game) game.status = "ROUND_REVEALED";
    return HttpResponse.json({ game });
  }),

  http.post("/api/game/:gameId/next", () => {
    if (!game) return HttpResponse.json({ game: null });
    if (game.currentQuestionIndex + 1 < (game.questions?.length ?? 0)) {
      game.currentQuestionIndex += 1;
      game.status = "QUESTION_ACTIVE";
    } else {
      game.status = "FINISHED";
    }
    return HttpResponse.json({ game });
  }),

  http.post("/api/game/:gameId/end", () => {
    if (game) game.status = "FINISHED";
    return HttpResponse.json({ game });
  }),

  http.get("/api/game/:gameId/leaderboard", ({ params }) => {
    return HttpResponse.json({
      gameId: params.gameId,
      leaderboard: [
        { rank: 1, userId: attendee.id, totalScore: 2850, correctCount: 2 },
        { rank: 2, userId: "user-2", totalScore: 2100, correctCount: 2 },
        { rank: 3, userId: "user-3", totalScore: 1450, correctCount: 1 },
      ],
    });
  }),
];
