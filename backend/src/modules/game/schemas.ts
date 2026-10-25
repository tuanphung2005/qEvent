import { t } from "elysia";

export const createGameBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 500 })),
});

const optionBody = t.Object({
  text: t.String({ minLength: 1, maxLength: 120 }),
  isCorrect: t.Boolean(),
});

export const addQuestionBody = t.Object({
  question: t.String({ minLength: 1, maxLength: 500 }),
  timeLimitSec: t.Optional(t.Integer({ minimum: 5, maximum: 120 })),
  points: t.Optional(t.Integer({ minimum: 100, maximum: 5000 })),
  options: t.Array(optionBody, { minItems: 4, maxItems: 4 }),
});

export const submitAnswerBody = t.Object({
  questionId: t.String({ minLength: 1 }),
  optionId: t.String({ minLength: 1 }),
  /**
   * @deprecated server tự tính từ `questionStartedAt`. Giữ field để client cũ không bị 422;
   * giá trị gửi lên bị bỏ qua.
   */
  responseTimeMs: t.Optional(t.Number({ minimum: 0 })),
});
