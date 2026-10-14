import { Elysia } from "elysia";
import { checkinRoutes } from "./routes/checkin.routes";
import { monitorRoutes } from "./routes/monitor.routes";
import { syncRoutes } from "./routes/sync.routes";

export const checkinModule = new Elysia().use(checkinRoutes).use(monitorRoutes).use(syncRoutes);

export * from "./services/verification.service";
export * from "./services/sync.service";
export * from "./schemas";
