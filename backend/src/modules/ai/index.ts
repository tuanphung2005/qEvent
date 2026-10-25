import { Elysia } from "elysia";
import { generateQuizRoutes } from "./routes/generate-quiz.routes";

export const aiModule = new Elysia().use(generateQuizRoutes);

export * from "./schemas";
