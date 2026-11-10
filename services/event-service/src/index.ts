import { createApp } from "./app";
import { config } from "./config";

const { app, deps } = createApp();

const shutdown = async () => {
  await deps.prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

app.listen({ port: config.port, hostname: process.env.HOST ?? "0.0.0.0" });
console.log(`qEvent event service listening on ${config.port}`);
