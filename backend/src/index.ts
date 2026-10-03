import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authModule } from "./modules/auth";
import { ticketsModule } from "./modules/tickets";
import { checkinModule } from "./modules/checkin";
import { realtimeModule } from "./modules/realtime";

const port = Number(process.env.PORT) || 3000;

export const app = new Elysia()
  .use(cors())
  .get("/", () => ({
    status: "ok",
    app: "qCheck Backend API",
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
  .listen({ port, hostname: process.env.HOST || "0.0.0.0" });

console.log(`🚀 qCheck Backend server is running at http://${app.server?.hostname}:${app.server?.port}`);
