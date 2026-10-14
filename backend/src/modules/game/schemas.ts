import { t } from "elysia";

export const createGameBody = t.Object({
  title: t.String(),
  description: t.Optional(t.String()),
});

export const addQuestionBody = t.Object({
  question: t.String(),
  timeLimitSec: t.Optional(t.Number()),
  points: t.Optional(t.Number()),
  options: t.Array(
    t.Object({
      text: t.String(),
      isCorrect: t.Boolean(),
    })
  ),
});

export const submitAnswerBody = t.Object({
  questionId: t.String(),
  optionId: t.String(),
  responseTimeMs: t.Number(),
  userId: t.Optional(t.String()),
});
