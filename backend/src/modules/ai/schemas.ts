import { t } from "elysia";

export const generateQuizBody = t.Object({
  sessionId: t.String({ minLength: 1 }),
  gameId: t.String({ minLength: 1 }),
  topic: t.String({ minLength: 3, maxLength: 200 }),
  contextText: t.String({ minLength: 50, maxLength: 8000 }),
  questionCount: t.Optional(t.Integer({ minimum: 3, maximum: 10 })),
  language: t.Optional(t.Union([t.Literal("vi"), t.Literal("en")])),
});
