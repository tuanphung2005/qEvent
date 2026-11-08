import { createApp } from "./app";
import { config } from "./config";
import { reconcileOnce } from "./services/order.service";

const { app, deps } = createApp();

const timer = setInterval(() => {
  reconcileOnce(deps).catch((error) => {
    console.error("reconcile tick failed", error instanceof Error ? error.message : error);
  });
}, config.reconcileIntervalMs);
timer.unref?.();

const shutdown = async () => {
  clearInterval(timer);
  await deps.prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

app.listen({ port: config.port, hostname: process.env.HOST ?? "0.0.0.0" });
console.log(`qEvent admission service listening on ${config.port}`);
