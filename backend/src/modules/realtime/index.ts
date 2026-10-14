import { Elysia } from "elysia";
import { qaRoutes } from "./routes/qa.routes";
import { pollRoutes } from "./routes/poll.routes";
import { qaWs } from "./ws/qa.ws";

export const realtimeModule = new Elysia().use(qaRoutes).use(pollRoutes).use(qaWs);

export * from "./services/broadcast.service";
export * from "./services/session-access.service";
export * from "./schemas";
