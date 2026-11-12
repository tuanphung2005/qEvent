import type { swagger } from "@elysiajs/swagger";

type Documentation = NonNullable<
  NonNullable<Parameters<typeof swagger>[0]>["documentation"]
>;

export const openapiDocumentation: Documentation = {
  info: {
    title: "qEvent Engagement Service",
    version: "1.0.0",
    description:
      "Interactive Q&A questions, polls, and Kahoot-like live quiz games with WebSocket updates. " +
      "Protected endpoints enforce BR-6 check-in verification against Admission Service. " +
      "Quiz games strictly enforce authoritative server-side timing and state machine CAS transitions.",
  },
  servers: [
    { url: "http://localhost:3003", description: "Direct service port (Docker network)" },
    { url: "http://localhost:8000", description: "API Gateway entry point" },
  ],
  tags: [
    { name: "qa", description: "Live Q&A and Upvoting" },
    { name: "polls", description: "Live interactive polls and voting" },
    { name: "game", description: "Kahoot-like live quiz engine" },
    { name: "health", description: "Health and readiness probe" },
  ],
};
