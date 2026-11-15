import { http, HttpResponse } from "msw";
import { admissionStatsFixture, eventFixture, sessionFixture } from "../../../test/msw/fixtures";

export const handlers = [
  http.get("/api/events", () => HttpResponse.json({ events: [eventFixture] })),
  http.get("/api/events/:id", () => HttpResponse.json({ event: eventFixture })),
  http.get("/api/checkins/stats", () => HttpResponse.json(admissionStatsFixture)),
  http.get("/api/sessions/:sessionId/stats", () =>
    HttpResponse.json({
      sessionId: sessionFixture.id,
      questions: {
        total: 12,
        topQuestion: { id: "q-1", content: "Circuit breaker hồi phục thế nào?", upvotes: 7 },
      },
      activePoll: { id: "p-1", title: "Keynote thế nào?", isActive: true, totalVotes: 31 },
      game: { status: "WAITING", currentQuestionIndex: 0, totalQuestions: 3 },
    }),
  ),
];
