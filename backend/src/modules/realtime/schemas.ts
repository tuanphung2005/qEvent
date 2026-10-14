import { t } from "elysia";

export const postQuestionBody = t.Object({
  sessionId: t.String(),
  userId: t.Optional(t.String()),
  content: t.String(),
});

export const upvoteBody = t.Object({
  userId: t.Optional(t.String()),
});

export const answerQuestionBody = t.Object({
  answerText: t.Optional(t.String()),
});

export const createPollBody = t.Object({
  question: t.String(),
  options: t.Array(t.String()),
});

export const votePollBody = t.Object({
  optionId: t.String(),
  userId: t.Optional(t.String()),
});
