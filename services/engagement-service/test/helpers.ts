import crypto from "node:crypto";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import type { AdmissionClient, AccessVerification } from "../src/lib/admission-client";

export class FakeAdmissionClient implements AdmissionClient {
  private allowedUsers = new Set<string>();

  allow(userId: string, eventId = "") {
    this.allowedUsers.add(`${userId}:${eventId}`);
    this.allowedUsers.add(userId);
  }

  disallow(userId: string, eventId = "") {
    this.allowedUsers.delete(`${userId}:${eventId}`);
    this.allowedUsers.delete(userId);
  }

  async verifyAccess(userId: string, eventId: string): Promise<AccessVerification> {
    const has = this.allowedUsers.has(`${userId}:${eventId}`) || this.allowedUsers.has(userId);
    return {
      hasAccess: has,
      checkedIn: has,
      ticketId: has ? `ticket-${userId}` : null,
    };
  }
}

export class InMemoryPrisma {
  qAQuestions: any[] = [];
  qAVotes: any[] = [];
  polls: any[] = [];
  pollOptions: any[] = [];
  pollVotes: any[] = [];
  quizGames: any[] = [];
  quizQuestions: any[] = [];
  quizAnswers: any[] = [];

  async $queryRaw() {
    return [{ 1: 1 }];
  }

  async $transaction(fn: (tx: any) => Promise<any>) {
    return fn(this);
  }

  async $disconnect() {}

  qAQuestion = {
    findMany: async (args: any = {}) => {
      let list = this.qAQuestions;
      if (args.where?.sessionId) {
        list = list.filter((q) => q.sessionId === args.where.sessionId);
      }
      return list.map((q) => {
        const votes = this.qAVotes.filter((v) => v.questionId === q.id);
        return { ...q, votes };
      });
    },
    findUnique: async (args: any) => {
      const q = this.qAQuestions.find((item) => item.id === args.where.id);
      return q ? { ...q } : null;
    },
    create: async (args: any) => {
      const item = {
        id: crypto.randomUUID(),
        sessionId: args.data.sessionId,
        userId: args.data.userId,
        content: args.data.content,
        upvotes: args.data.upvotes ?? 0,
        createdAt: new Date(),
      };
      this.qAQuestions.push(item);
      return { ...item };
    },
    update: async (args: any) => {
      const item = this.qAQuestions.find((q) => q.id === args.where.id);
      if (!item) throw new Error("Question not found");
      if (args.data.upvotes?.increment) item.upvotes += args.data.upvotes.increment;
      if (args.data.upvotes?.decrement) item.upvotes -= args.data.upvotes.decrement;
      return { ...item };
    },
    deleteMany: async () => {
      const count = this.qAQuestions.length;
      this.qAQuestions = [];
      return { count };
    },
  };

  qAVote = {
    findUnique: async (args: any) => {
      const target = args.where.questionId_userId;
      const v = this.qAVotes.find(
        (item) => item.questionId === target.questionId && item.userId === target.userId
      );
      return v ? { ...v } : null;
    },
    create: async (args: any) => {
      const item = {
        id: crypto.randomUUID(),
        questionId: args.data.questionId,
        userId: args.data.userId,
      };
      this.qAVotes.push(item);
      return { ...item };
    },
    delete: async (args: any) => {
      const idx = this.qAVotes.findIndex((v) => v.id === args.where.id);
      if (idx >= 0) {
        const item = this.qAVotes.splice(idx, 1)[0];
        return { ...item };
      }
      return null;
    },
    deleteMany: async () => {
      const count = this.qAVotes.length;
      this.qAVotes = [];
      return { count };
    },
  };

  poll = {
    findMany: async (args: any = {}) => {
      let list = this.polls;
      if (args.where?.sessionId) {
        list = list.filter((p) => p.sessionId === args.where.sessionId);
      }
      return list.map((p) => {
        const options = this.pollOptions
          .filter((o) => o.pollId === p.id)
          .map((opt) => {
            const votes = this.pollVotes.filter((v) => v.optionId === opt.id);
            return {
              ...opt,
              votes: args.include?.options?.include?.votes
                ? votes.filter((v) =>
                    args.include.options.include.votes.where?.userId
                      ? v.userId === args.include.options.include.votes.where.userId
                      : true
                  )
                : [],
            };
          });
        return { ...p, options };
      });
    },
    findUnique: async (args: any) => {
      const p = this.polls.find((item) => item.id === args.where.id);
      if (!p) return null;
      const options = this.pollOptions.filter((o) => o.pollId === p.id);
      return { ...p, options };
    },
    create: async (args: any) => {
      const pollId = crypto.randomUUID();
      const poll = {
        id: pollId,
        sessionId: args.data.sessionId,
        title: args.data.title,
        isActive: args.data.isActive ?? true,
        createdAt: new Date(),
      };
      this.polls.push(poll);

      const createdOptions: any[] = [];
      if (args.data.options?.create) {
        for (const opt of args.data.options.create) {
          const optItem = {
            id: crypto.randomUUID(),
            pollId,
            content: opt.content,
            voteCount: opt.voteCount ?? 0,
          };
          this.pollOptions.push(optItem);
          createdOptions.push(optItem);
        }
      }

      return { ...poll, options: createdOptions };
    },
    deleteMany: async () => {
      const count = this.polls.length;
      this.polls = [];
      return { count };
    },
  };

  pollOption = {
    update: async (args: any) => {
      const opt = this.pollOptions.find((o) => o.id === args.where.id);
      if (!opt) throw new Error("Option not found");
      if (args.data.voteCount?.increment) opt.voteCount += args.data.voteCount.increment;
      if (args.data.voteCount?.decrement) opt.voteCount -= args.data.voteCount.decrement;
      return { ...opt };
    },
    deleteMany: async () => {
      const count = this.pollOptions.length;
      this.pollOptions = [];
      return { count };
    },
  };

  pollVote = {
    findFirst: async (args: any) => {
      let list = this.pollVotes;
      if (args.where?.userId) {
        list = list.filter((v) => v.userId === args.where.userId);
      }
      if (args.where?.option?.pollId) {
        list = list.filter((v) => {
          const opt = this.pollOptions.find((o) => o.id === v.optionId);
          return opt && opt.pollId === args.where.option.pollId;
        });
      }
      return list[0] ? { ...list[0] } : null;
    },
    create: async (args: any) => {
      const item = {
        id: crypto.randomUUID(),
        optionId: args.data.optionId,
        userId: args.data.userId,
      };
      this.pollVotes.push(item);
      return { ...item };
    },
    delete: async (args: any) => {
      const idx = this.pollVotes.findIndex((v) => v.id === args.where.id);
      if (idx >= 0) {
        const item = this.pollVotes.splice(idx, 1)[0];
        return { ...item };
      }
      return null;
    },
    deleteMany: async () => {
      const count = this.pollVotes.length;
      this.pollVotes = [];
      return { count };
    },
  };

  quizGame = {
    findUnique: async (args: any) => {
      let g = null;
      if (args.where.id) g = this.quizGames.find((item) => item.id === args.where.id);
      if (args.where.sessionId) g = this.quizGames.find((item) => item.sessionId === args.where.sessionId);
      if (!g) return null;

      const questions = this.quizQuestions
        .filter((q) => q.gameId === g.id)
        .sort((a, b) => a.orderNum - b.orderNum);
      return { ...g, questions };
    },
    findUniqueOrThrow: async (args: any) => {
      const g = await this.quizGame.findUnique(args);
      if (!g) throw new Error("QuizGame not found");
      return g;
    },
    findMany: async (args: any = {}) => {
      let list = this.quizGames;
      if (args.where?.sessionId) {
        list = list.filter((g) => g.sessionId === args.where.sessionId);
      }
      return list.map((g) => {
        const questions = this.quizQuestions.filter((q) => q.gameId === g.id);
        return { ...g, questions };
      });
    },
    create: async (args: any) => {
      const item = {
        id: crypto.randomUUID(),
        sessionId: args.data.sessionId,
        status: args.data.status ?? "WAITING",
        currentQuestionIndex: args.data.currentQuestionIndex ?? 0,
      };
      this.quizGames.push(item);
      return { ...item, questions: [] };
    },
    update: async (args: any) => {
      const g = this.quizGames.find((item) => item.id === args.where.id);
      if (!g) throw new Error("Game not found");
      Object.assign(g, args.data);
      return { ...g };
    },
    updateMany: async (args: any) => {
      let count = 0;
      for (const g of this.quizGames) {
        let match = true;
        if (args.where.id && g.id !== args.where.id) match = false;
        if (args.where.status) {
          if (typeof args.where.status === "string" && g.status !== args.where.status) match = false;
          if (Array.isArray(args.where.status?.in) && !args.where.status.in.includes(g.status)) match = false;
        }
        if (args.where.currentQuestionIndex !== undefined && g.currentQuestionIndex !== args.where.currentQuestionIndex) {
          match = false;
        }

        if (match) {
          Object.assign(g, args.data);
          count++;
        }
      }
      return { count };
    },
    deleteMany: async () => {
      const count = this.quizGames.length;
      this.quizGames = [];
      return { count };
    },
  };

  quizQuestion = {
    findFirst: async (args: any) => {
      let list = this.quizQuestions;
      if (args.where?.gameId) list = list.filter((q) => q.gameId === args.where.gameId);
      if (args.where?.orderNum !== undefined) list = list.filter((q) => q.orderNum === args.where.orderNum);
      return list[0] ? { ...list[0] } : null;
    },
    findMany: async (args: any = {}) => {
      let list = this.quizQuestions;
      if (args.where?.gameId) list = list.filter((q) => q.gameId === args.where.gameId);
      return list.map((q) => ({ ...q }));
    },
    aggregate: async (args: any) => {
      const questions = this.quizQuestions.filter((q) => q.gameId === args.where.gameId);
      if (questions.length === 0) return { _max: { orderNum: null } };
      const maxOrder = Math.max(...questions.map((q) => q.orderNum));
      return { _max: { orderNum: maxOrder } };
    },
    create: async (args: any) => {
      const item = {
        id: crypto.randomUUID(),
        gameId: args.data.gameId,
        orderNum: args.data.orderNum,
        content: args.data.content,
        options: args.data.options,
        correctOption: args.data.correctOption,
        timeLimitSec: args.data.timeLimitSec ?? 30,
        questionStartedAt: args.data.questionStartedAt ?? null,
      };
      this.quizQuestions.push(item);
      return { ...item };
    },
    update: async (args: any) => {
      const q = this.quizQuestions.find((item) => item.id === args.where.id);
      if (!q) throw new Error("Question not found");
      Object.assign(q, args.data);
      return { ...q };
    },
    deleteMany: async () => {
      const count = this.quizQuestions.length;
      this.quizQuestions = [];
      return { count };
    },
  };

  quizAnswer = {
    findUnique: async (args: any) => {
      const target = args.where.questionId_userId;
      const ans = this.quizAnswers.find(
        (a) => a.questionId === target.questionId && a.userId === target.userId
      );
      return ans ? { ...ans } : null;
    },
    findMany: async (args: any = {}) => {
      let list = this.quizAnswers;
      if (args.where?.question?.gameId) {
        const gameQuestionIds = this.quizQuestions
          .filter((q) => q.gameId === args.where.question.gameId)
          .map((q) => q.id);
        list = list.filter((a) => gameQuestionIds.includes(a.questionId));
      }
      return list.map((a) => ({ ...a }));
    },
    create: async (args: any) => {
      const item = {
        id: crypto.randomUUID(),
        questionId: args.data.questionId,
        userId: args.data.userId,
        selectedOption: args.data.selectedOption,
        responseTimeMs: args.data.responseTimeMs,
        score: args.data.score ?? 0,
        answeredAt: args.data.answeredAt ?? new Date(),
      };
      this.quizAnswers.push(item);
      return { ...item };
    },
    deleteMany: async () => {
      const count = this.quizAnswers.length;
      this.quizAnswers = [];
      return { count };
    },
  };
}

export function makeTestApp(overrides: Partial<Deps> = {}) {
  const inMemoryPrisma = new InMemoryPrisma();
  const fakeAdmissionClient = new FakeAdmissionClient();

  const deps: Deps = {
    prisma: (overrides.prisma ?? (inMemoryPrisma as any)),
    admissionClient: overrides.admissionClient ?? fakeAdmissionClient,
    now: overrides.now ?? (() => new Date()),
    jwtSecret: overrides.jwtSecret ?? "test_jwt_secret_key_12345",
    internalToken: overrides.internalToken ?? "test_internal_token",
    ...overrides,
  };

  const { app } = createApp(deps);
  return { app, deps, fakeAdmissionClient, inMemoryPrisma };
}

type App = ReturnType<typeof makeTestApp>["app"];

export async function call(
  app: App,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  );

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}
