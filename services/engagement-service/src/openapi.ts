import type { swagger } from "@elysiajs/swagger";

type Documentation = NonNullable<
  NonNullable<Parameters<typeof swagger>[0]>["documentation"]
>;
type JsonSchema = Record<string, any>;

const SCHEMA_REF = "#/components/schemas/";
const ref = (name: string): JsonSchema => ({ $ref: SCHEMA_REF + name });

const obj = (
  properties: Record<string, JsonSchema>,
  required: string[] = Object.keys(properties)
): JsonSchema => ({ type: "object", required, properties });
const arr = (items: JsonSchema, extra: JsonSchema = {}): JsonSchema => ({
  type: "array",
  items,
  ...extra,
});
const str = (extra: JsonSchema = {}): JsonSchema => ({ type: "string", ...extra });
const en = (...values: string[]): JsonSchema => ({ type: "string", enum: values });
const int = (extra: JsonSchema = {}): JsonSchema => ({ type: "integer", ...extra });
const bool = (): JsonSchema => ({ type: "boolean" });

const uuid = str({ format: "uuid" });
const dateTime = str({ format: "date-time" });
const nullableDateTime = { type: "string", format: "date-time", nullable: true };

const schemas: Record<string, JsonSchema> = {
  ErrorBody: obj({
    code: str({ example: "SESSION_NOT_LIVE" }),
    message: str({ example: "Session is not live yet" }),
  }),
  ValidationError: obj(
    {
      type: str({ example: "validation" }),
      on: str({ example: "body" }),
      property: str({ example: "/content" }),
      message: str({ example: "Expected string to have a length of at least 1" }),
      summary: str(),
      expected: { type: "object", additionalProperties: true },
      found: { type: "object", additionalProperties: true },
      errors: arr({ type: "object", additionalProperties: true }),
    },
    ["type", "on", "property", "message"]
  ),
  HealthResponse: obj({
    status: en("ok", "degraded"),
    service: str({ example: "engagement-service" }),
    database: en("ok", "unavailable"),
  }),
  QAQuestion: obj({
    id: uuid,
    sessionId: uuid,
    userId: uuid,
    content: str({ example: "How does the circuit breaker recover?" }),
    upvotes: int({ minimum: 0, example: 4 }),
    createdAt: dateTime,
  }),
  QAQuestionListResponse: obj({
    sessionId: uuid,
    questions: arr(ref("QAQuestion")),
  }),
  CreateQuestionRequest: obj({
    content: str({ minLength: 1, maxLength: 500 }),
  }),
  CreateQuestionResponse: obj({ question: ref("QAQuestion") }),
  VoteResponse: obj({
    questionId: uuid,
    upvotes: int({ minimum: 0, example: 5 }),
    hasVoted: bool(),
  }),
  PollOption: obj({
    id: uuid,
    pollId: uuid,
    content: str({ example: "Very good" }),
    voteCount: int({ minimum: 0, example: 12 }),
  }),
  Poll: obj({
    id: uuid,
    sessionId: uuid,
    title: str({ example: "How was the keynote?" }),
    isActive: bool(),
    createdAt: dateTime,
    options: arr(ref("PollOption")),
  }),
  PollListResponse: obj({
    sessionId: uuid,
    polls: arr(ref("Poll")),
  }),
  PollResponse: obj({ poll: ref("Poll") }),
  PollVoteResponse: obj({
    pollId: uuid,
    optionId: uuid,
    voted: bool(),
  }),
  CreatePollRequest: obj({
    title: str({ minLength: 1, maxLength: 200 }),
    options: arr(str({ minLength: 1 }), { minItems: 2, maxItems: 10 }),
  }),
  UpdatePollRequest: obj({ isActive: bool() }),
  SessionStatsResponse: obj({
    sessionId: uuid,
    questions: obj({
      total: int({ minimum: 0, example: 12 }),
      topQuestion: {
        type: "object",
        nullable: true,
        required: ["id", "content", "upvotes"],
        properties: {
          id: uuid,
          content: str({ example: "How does the circuit breaker recover?" }),
          upvotes: int({ minimum: 0, example: 7 }),
        },
      },
    }),
    activePoll: {
      type: "object",
      nullable: true,
      required: ["id", "title", "isActive", "totalVotes"],
      properties: {
        id: uuid,
        title: str({ example: "How was the keynote?" }),
        isActive: bool(),
        totalVotes: int({ minimum: 0, example: 31 }),
      },
    },
    game: {
      type: "object",
      nullable: true,
      required: ["status", "currentQuestionIndex", "totalQuestions"],
      properties: {
        status: en("WAITING", "QUESTION_ACTIVE", "ROUND_REVEALED", "FINISHED"),
        currentQuestionIndex: int({ minimum: 0, example: 1 }),
        totalQuestions: int({ minimum: 0, example: 3 }),
      },
    },
  }),
  PollVoteRequest: obj({
    optionId: uuid,
  }),
  GameQuestion: obj(
    {
      id: uuid,
      orderNum: int({ minimum: 0, example: 0 }),
      content: str({ example: "Which algorithm prevents double check-in?" }),
      options: arr(str()),
      correctOption: int({ minimum: 0, maximum: 5 }),
      timeLimitSec: int({ minimum: 1, maximum: 300, example: 30 }),
      questionStartedAt: nullableDateTime,
    },
    ["id", "orderNum", "content", "options"]
  ),
  Game: obj(
    {
      id: uuid,
      sessionId: uuid,
      status: en("WAITING", "QUESTION_ACTIVE", "ROUND_REVEALED", "FINISHED"),
      currentQuestionIndex: int({ minimum: 0, example: 0 }),
      totalQuestions: int({ minimum: 0, example: 3 }),
      questions: arr(ref("GameQuestion")),
      currentQuestion: ref("GameQuestion"),
    },
    ["id", "sessionId", "status", "currentQuestionIndex"]
  ),
  GameResponse: obj({ game: ref("Game") }),
  AddQuestionRequest: obj({
    content: str({ minLength: 1, maxLength: 500 }),
    options: arr(str({ minLength: 1 }), { minItems: 2, maxItems: 6 }),
    correctOption: int({ minimum: 0, maximum: 5 }),
    timeLimitSec: int({ minimum: 1, maximum: 300 }),
  }),
  QuizQuestionResponse: obj({ question: ref("GameQuestion") }),
  StartGameResponse: obj({
    game: ref("Game"),
    currentQuestion: ref("GameQuestion"),
  }),
  RevealGameResponse: obj({
    game: ref("Game"),
    correctOption: int({ minimum: 0, maximum: 5 }),
  }),
  AnswerRequest: obj(
    {
      questionId: uuid,
      selectedOption: int({ minimum: 0, maximum: 5 }),
      userId: str({ description: "Ignored; identity always comes from the JWT." }),
      responseTimeMs: int({ description: "Ignored; the server measures elapsed time." }),
    },
    ["questionId", "selectedOption"]
  ),
  AnswerResponse: obj({
    isCorrect: bool(),
    score: int({ minimum: 0, example: 750 }),
    responseTimeMs: int({ minimum: 0, example: 10_000 }),
  }),
  LeaderboardEntry: obj({
    rank: int({ minimum: 1, example: 1 }),
    userId: uuid,
    totalScore: int({ minimum: 0, example: 2750 }),
    correctCount: int({ minimum: 0, example: 3 }),
  }),
  LeaderboardResponse: obj({
    gameId: uuid,
    leaderboard: arr(ref("LeaderboardEntry")),
  }),
};

let uuidSeq = 0;
const nextUuid = () =>
  `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, "0")}`;

function sampleString(schema: JsonSchema): string {
  if (schema.format === "uuid") return nextUuid();
  if (schema.format === "date-time") return "2026-11-14T08:00:00.000Z";
  return "string";
}

function sampleValue(schema: JsonSchema): any {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.startsWith(SCHEMA_REF)
      ? schema.$ref.slice(SCHEMA_REF.length)
      : "";
    return name && schemas[name] ? sampleValue(schemas[name]) : {};
  }
  if (schema.example !== undefined) return structuredClone(schema.example);
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (schema.type === "object") {
    const value: Record<string, any> = {};
    for (const [key, child] of Object.entries<JsonSchema>(schema.properties ?? {})) {
      value[key] = sampleValue(child);
    }
    return value;
  }
  if (schema.type === "array") {
    return schema.items ? [sampleValue(schema.items)] : [];
  }
  if (schema.type === "integer" || schema.type === "number") {
    return schema.minimum ?? 1;
  }
  if (schema.type === "boolean") return true;
  return sampleString(schema);
}

function merge(base: any, patch: any): any {
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== "object") return patch;
  if (Array.isArray(patch)) return patch;
  if (!base || typeof base !== "object" || Array.isArray(base)) return patch;
  const merged: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = merge(base[key], value);
  }
  return merged;
}

const media = (schema: JsonSchema, example: unknown) => ({
  "application/json": { schema, example },
});

const ok = (description: string, schemaName: string, patch?: JsonSchema) => ({
  description,
  content: media(
    ref(schemaName),
    merge(sampleValue(ref(schemaName)), patch)
  ),
});

const fail = (description: string, code: string, message: string) => ({
  description,
  content: media(ref("ErrorBody"), { code, message }),
});

const examples = (
  description: string,
  schema: JsonSchema,
  values: Record<string, unknown>
) => ({
  description,
  content: {
    "application/json": {
      schema,
      examples: Object.fromEntries(
        Object.entries(values).map(([label, value]) => [label, { value }])
      ),
    },
  },
});

const body = (schemaName: string, patch?: JsonSchema) => ({
  required: true,
  content: media(ref(schemaName), merge(sampleValue(ref(schemaName)), patch)),
});

const idParameter = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
});

const bearer = [{ bearerAuth: [] }];
const unauthorized = { $ref: "#/components/responses/Unauthorized" };
const forbidden = { $ref: "#/components/responses/Forbidden" };
const validationFailed = { $ref: "#/components/responses/ValidationFailed" };
const upstreamUnavailable = { $ref: "#/components/responses/UpstreamUnavailable" };
const upstreamTimeout = { $ref: "#/components/responses/UpstreamTimeout" };

const components = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "JWT verified by the API Gateway. For WebSocket handshakes use `?token=<jwt>` because browsers cannot set headers.",
    },
  },
  schemas,
  responses: {
    Unauthorized: fail(
      "Authentication is missing or the JWT is invalid.",
      "UNAUTHORIZED",
      "Authentication is required"
    ),
    Forbidden: fail(
      "The caller is not a STAFF or ORGANIZER for the host-only action.",
      "FORBIDDEN",
      "Only staff or organizer can perform this action"
    ),
    ValidationFailed: {
      description: "The request body or parameters do not satisfy the declared schema.",
      content: media(
        ref("ValidationError"),
        sampleValue(ref("ValidationError"))
      ),
    },
    UpstreamUnavailable: {
      description:
        "A dependency (Event Service or Admission Service) could not be reached. The client may retry with backoff.",
      content: media(ref("ErrorBody"), {
        code: "EVENT_SERVICE_UNAVAILABLE",
        message: "Event Service is unavailable; try again later",
      }),
    },
    UpstreamTimeout: examples(
      "A dependency did not answer within the internal timeout. The client may retry with backoff.",
      ref("ErrorBody"),
      {
        eventTimeout: {
          code: "EVENT_SERVICE_TIMEOUT",
          message: "Event Service timed out; try again later",
        },
        admissionTimeout: {
          code: "ADMISSION_SERVICE_TIMEOUT",
          message: "Admission Service timed out; try again later",
        },
      }
    ),
  },
};

const notCheckedIn = fail(
  "The attendee has not checked in to the session's event (BR-6).",
  "NOT_CHECKED_IN",
  "Attendee has not checked in to this event"
);
const sessionNotLive = fail(
  "The session is not live, so attendee interaction is closed.",
  "SESSION_NOT_LIVE",
  "Session is not live yet"
);
const sessionNotFound = fail(
  "The session does not exist in Event Service.",
  "SESSION_NOT_FOUND",
  "Session was not found"
);
const gameNotFound = fail(
  "The quiz game does not exist.",
  "GAME_NOT_FOUND",
  "Quiz game was not found"
);

const paths = {
  "/health": {
    get: {
      tags: ["health"],
      summary: "Report service and database readiness",
      operationId: "getHealth",
      responses: {
        "200": ok("Service and database are reachable.", "HealthResponse"),
        "503": ok("Database is unavailable.", "HealthResponse", {
          status: "degraded",
          database: "unavailable",
        }),
      },
    },
  },
  "/api/sessions/{sessionId}/questions": {
    get: {
      tags: ["qa"],
      summary: "List questions for a session ordered by upvotes",
      operationId: "listQuestions",
      parameters: [idParameter("sessionId")],
      responses: {
        "200": ok("Questions ordered by upvotes, then creation time.", "QAQuestionListResponse"),
      },
    },
    post: {
      tags: ["qa"],
      summary: "Ask a question in a live session",
      description:
        "Requires BR-6: the session must be live and the caller must have checked in to the session's real event. The event id is resolved from Event Service, never accepted from the client.",
      operationId: "createQuestion",
      security: bearer,
      parameters: [idParameter("sessionId")],
      requestBody: body("CreateQuestionRequest"),
      responses: {
        "201": ok("Question created.", "CreateQuestionResponse"),
        "400": fail("The question content is empty.", "VALIDATION", "content must not be empty"),
        "401": unauthorized,
        "403": examples(
          "Attendee access is denied.",
          ref("ErrorBody"),
          {
            notCheckedIn: {
              code: "NOT_CHECKED_IN",
              message: "Attendee has not checked in to this event",
            },
            sessionNotLive: {
              code: "SESSION_NOT_LIVE",
              message: "Session is not live yet",
            },
          }
        ),
        "404": sessionNotFound,
        "422": validationFailed,
        "503": upstreamUnavailable,
        "504": upstreamTimeout,
      },
    },
  },
  "/api/questions/{questionId}": {
    delete: {
      tags: ["qa"],
      summary: "Delete a question (host only)",
      description:
        "Staff and organizers can remove an inappropriate question. Its votes are removed by cascade.",
      operationId: "deleteQuestion",
      security: bearer,
      parameters: [idParameter("questionId")],
      responses: {
        "204": { description: "Question deleted." },
        "401": unauthorized,
        "403": forbidden,
        "404": fail("The question does not exist.", "QUESTION_NOT_FOUND", "Question was not found"),
      },
    },
  },
  "/api/questions/{questionId}/votes": {
    put: {
      tags: ["qa"],
      summary: "Toggle an upvote on a question",
      description:
        "Requires BR-6 against the question's session. Calling it twice removes the vote.",
      operationId: "toggleQuestionVote",
      security: bearer,
      parameters: [idParameter("questionId")],
      responses: {
        "200": ok("Vote toggled.", "VoteResponse"),
        "401": unauthorized,
        "403": notCheckedIn,
        "404": fail("The question does not exist.", "QUESTION_NOT_FOUND", "Question was not found"),
        "503": upstreamUnavailable,
        "504": upstreamTimeout,
      },
    },
  },
  "/api/sessions/{sessionId}/polls": {
    get: {
      tags: ["polls"],
      summary: "List polls for a session",
      operationId: "listPolls",
      parameters: [idParameter("sessionId")],
      responses: {
        "200": ok("Polls ordered by creation time (newest first).", "PollListResponse"),
      },
    },
    post: {
      tags: ["polls"],
      summary: "Create a poll (host only)",
      operationId: "createPoll",
      security: bearer,
      parameters: [idParameter("sessionId")],
      requestBody: body("CreatePollRequest"),
      responses: {
        "201": ok("Poll created.", "PollResponse"),
        "400": fail(
          "The poll has fewer than 2 non-empty options.",
          "INVALID_OPTIONS",
          "Poll must have at least 2 options"
        ),
        "401": unauthorized,
        "403": forbidden,
        "422": validationFailed,
      },
    },
  },
  "/api/polls/{pollId}/vote": {
    post: {
      tags: ["polls"],
      summary: "Cast, switch, or remove a poll vote",
      description: "Requires BR-6 against the poll's session. Voting on a closed poll returns 400.",
      operationId: "votePoll",
      security: bearer,
      parameters: [idParameter("pollId")],
      requestBody: body("PollVoteRequest"),
      responses: {
        "200": ok("Vote applied (or removed when voting the same option twice).", "PollVoteResponse"),
        "400": examples("The poll is closed or the option is invalid.", ref("ErrorBody"), {
          inactive: { code: "POLL_INACTIVE", message: "Poll is closed for voting" },
          invalidOption: {
            code: "INVALID_OPTION",
            message: "Option does not belong to this poll",
          },
        }),
        "401": unauthorized,
        "403": notCheckedIn,
        "404": fail("The poll does not exist.", "POLL_NOT_FOUND", "Poll was not found"),
        "422": validationFailed,
        "503": upstreamUnavailable,
        "504": upstreamTimeout,
      },
    },
  },
  "/api/polls/{pollId}": {
    patch: {
      tags: ["polls"],
      summary: "Open or close a poll (host only)",
      operationId: "updatePoll",
      security: bearer,
      parameters: [idParameter("pollId")],
      requestBody: body("UpdatePollRequest"),
      responses: {
        "200": ok("Poll updated.", "PollResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": fail("The poll does not exist.", "POLL_NOT_FOUND", "Poll was not found"),
        "422": validationFailed,
      },
    },
  },
  "/api/sessions/{sessionId}/stats": {
    get: {
      tags: ["stats"],
      summary: "Dashboard counters for a session (host only)",
      operationId: "getSessionStats",
      security: bearer,
      parameters: [idParameter("sessionId")],
      responses: {
        "200": ok("Question, poll and game counters.", "SessionStatsResponse"),
        "401": unauthorized,
        "403": forbidden,
      },
    },
  },
  "/api/sessions/{sessionId}/game": {
    get: {
      tags: ["game"],
      summary: "Read the game for a session",
      operationId: "getSessionGame",
      parameters: [idParameter("sessionId")],
      responses: {
        "200": ok("Game summary.", "GameResponse"),
        "404": fail(
          "No game exists for this session.",
          "GAME_NOT_FOUND",
          "No quiz game found for this session"
        ),
      },
    },
    post: {
      tags: ["game"],
      summary: "Create or return the session's quiz game (host only)",
      operationId: "createSessionGame",
      security: bearer,
      parameters: [idParameter("sessionId")],
      responses: {
        "200": ok("Game already existed and is returned unchanged.", "GameResponse"),
        "201": ok("Game created.", "GameResponse"),
        "401": unauthorized,
        "403": forbidden,
      },
    },
  },
  "/api/game/{gameId}/question": {
    post: {
      tags: ["game"],
      summary: "Add a question while the game is WAITING (host only)",
      operationId: "addGameQuestion",
      security: bearer,
      parameters: [idParameter("gameId")],
      requestBody: body("AddQuestionRequest"),
      responses: {
        "201": ok("Question added at the next order number.", "QuizQuestionResponse"),
        "400": examples("The question payload is invalid.", ref("ErrorBody"), {
          options: {
            code: "INVALID_OPTIONS",
            message: "Question must have between 2 and 6 options",
          },
          correctOption: {
            code: "INVALID_CORRECT_OPTION",
            message: "correctOption must be an index between 0 and 5",
          },
          timeLimit: {
            code: "INVALID_TIME_LIMIT",
            message: "timeLimitSec must be between 1 and 300 seconds",
          },
        }),
        "401": unauthorized,
        "403": forbidden,
        "404": gameNotFound,
        "409": fail(
          "The game has already started.",
          "INVALID_GAME_STATE",
          "Game status changed while adding question"
        ),
        "422": validationFailed,
      },
    },
  },
  "/api/game/{gameId}": {
    get: {
      tags: ["game"],
      summary: "Read game state (hosts also see correct answers)",
      description:
        "Attendees never receive `correctOption` before ROUND_REVEALED; hosts receive the full question list.",
      operationId: "getGame",
      parameters: [idParameter("gameId")],
      responses: {
        "200": ok("Game state for the caller's role.", "GameResponse"),
        "404": gameNotFound,
      },
    },
  },
  "/api/game/{gameId}/start": {
    post: {
      tags: ["game"],
      summary: "Start the first question (host only, CAS)",
      operationId: "startGame",
      security: bearer,
      parameters: [idParameter("gameId")],
      responses: {
        "200": ok("Game started and the first question is active.", "StartGameResponse"),
        "400": fail("The game has no questions.", "NO_QUESTIONS", "Game must have at least one question to start"),
        "401": unauthorized,
        "403": forbidden,
        "404": gameNotFound,
        "409": fail(
          "The game is not WAITING, or another request won the transition.",
          "INVALID_GAME_STATE",
          "Cannot start a game with status QUESTION_ACTIVE"
        ),
      },
    },
  },
  "/api/game/{gameId}/reveal": {
    post: {
      tags: ["game"],
      summary: "Reveal the correct answer (host only, CAS)",
      operationId: "revealGameAnswer",
      security: bearer,
      parameters: [idParameter("gameId")],
      responses: {
        "200": ok("Round revealed.", "RevealGameResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": gameNotFound,
        "409": fail(
          "The game is not in QUESTION_ACTIVE.",
          "INVALID_GAME_STATE",
          "Cannot reveal answer when game is ROUND_REVEALED"
        ),
      },
    },
  },
  "/api/game/{gameId}/next": {
    post: {
      tags: ["game"],
      summary: "Advance to the next question (host only, CAS)",
      operationId: "nextGameQuestion",
      security: bearer,
      parameters: [idParameter("gameId")],
      responses: {
        "200": ok("Next question is active.", "StartGameResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": gameNotFound,
        "409": examples("The transition is not allowed.", ref("ErrorBody"), {
          notRevealed: {
            code: "INVALID_GAME_STATE",
            message: "Must reveal round before advancing. Current status: QUESTION_ACTIVE",
          },
          noMore: {
            code: "NO_MORE_QUESTIONS",
            message: "No more questions available. Call /end to finish the game.",
          },
        }),
      },
    },
  },
  "/api/game/{gameId}/end": {
    post: {
      tags: ["game"],
      summary: "Finish the game (host only)",
      operationId: "endGame",
      security: bearer,
      parameters: [idParameter("gameId")],
      responses: {
        "200": ok("Game finished.", "GameResponse"),
        "401": unauthorized,
        "403": forbidden,
        "404": gameNotFound,
        "409": fail("The game is already finished.", "INVALID_GAME_STATE", "Game is already finished"),
      },
    },
  },
  "/api/game/{gameId}/answer": {
    post: {
      tags: ["game"],
      summary: "Submit an answer for the active question",
      description:
        "Requires BR-6. Identity comes from the JWT and timing from the server; `userId` and `responseTimeMs` in the body are ignored.",
      operationId: "submitGameAnswer",
      security: bearer,
      parameters: [idParameter("gameId")],
      requestBody: body("AnswerRequest"),
      responses: {
        "200": ok("Answer scored.", "AnswerResponse"),
        "400": examples("The answer cannot be accepted.", ref("ErrorBody"), {
          closed: {
            code: "ANSWER_WINDOW_CLOSED",
            message: "Current question is not accepting answers",
          },
          late: { code: "ANSWER_TOO_LATE", message: "Time limit exceeded" },
          wrongQuestion: {
            code: "NOT_CURRENT_QUESTION",
            message: "Answers are only accepted for the currently active question",
          },
          invalidOption: {
            code: "INVALID_OPTION",
            message: "Selected option index is out of bounds",
          },
        }),
        "401": unauthorized,
        "403": notCheckedIn,
        "404": gameNotFound,
        "409": fail(
          "The answer was already submitted or the question has not started.",
          "ALREADY_ANSWERED",
          "You have already submitted an answer for this question"
        ),
        "422": validationFailed,
        "503": upstreamUnavailable,
        "504": upstreamTimeout,
      },
    },
  },
  "/api/game/{gameId}/leaderboard": {
    get: {
      tags: ["game"],
      summary: "Read the game leaderboard",
      operationId: "getGameLeaderboard",
      parameters: [idParameter("gameId")],
      responses: {
        "200": ok("Leaderboard ordered by total score.", "LeaderboardResponse"),
        "404": gameNotFound,
      },
    },
  },
};

export const openapiDocumentation = {
  info: {
    title: "qEvent Engagement Service",
    version: "1.0.0",
    description:
      "Live Q&A, polls, and a Kahoot-style quiz engine. " +
      "Interaction endpoints enforce BR-6: Event Service resolves the session's real event id and live flag, " +
      "then Admission Service confirms the attendee checked in. Infrastructure failures return 503 (unreachable) or 504 (timeout), never 403. " +
      "Errors use `{ code, message }` except request validation failures, which return the Elysia validation payload.",
  },
  servers: [
    { url: "http://localhost:3003", description: "Direct service port (Docker network)" },
    { url: "http://localhost:8000", description: "API Gateway entry point" },
  ],
  tags: [
    { name: "qa", description: "Live Q&A and upvoting" },
    { name: "polls", description: "Live interactive polls and voting" },
    { name: "game", description: "Kahoot-like live quiz engine" },
    { name: "stats", description: "Session dashboard counters" },
    { name: "health", description: "Health and readiness probe" },
  ],
  components,
  paths,
} as Documentation;
