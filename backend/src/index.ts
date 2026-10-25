import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authModule } from "./modules/auth";
import { ticketsModule } from "./modules/tickets";
import { checkinModule } from "./modules/checkin";
import { realtimeModule } from "./modules/realtime";
import { gameModule } from "./modules/game";
import { aiModule } from "./modules/ai";

const FALLBACK_JWT_SECRET = "qevent_super_secret_jwt_key_2026_production_grade";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === FALLBACK_JWT_SECRET)
) {
  throw new Error(
    "JWT_SECRET bắt buộc ở production và không được trùng fallback công khai"
  );
}

const port = Number(process.env.PORT) || 3000;

export const app = new Elysia()
  .use(cors())
  .get("/", () => ({
    status: "ok",
    app: "qEvent Backend API",
    version: "1.0.0",
    docs: "/swagger",
  }))
  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }))
  .use(authModule)
  .use(ticketsModule)
  .use(checkinModule)
  .use(realtimeModule)
  .use(gameModule)
  .use(aiModule)
  .listen({ port, hostname: process.env.HOST || "0.0.0.0" });

console.log(`🚀 qEvent Backend server is running at http://${app.server?.hostname}:${app.server?.port}`);
