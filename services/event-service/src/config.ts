import path from "node:path";

const serviceRoot = path.resolve(import.meta.dir, "..");

function requiredInProduction(name: string): string | undefined {
  if (process.env.NODE_ENV === "production" && !process.env[name]) {
    throw new Error(`${name} is required in production`);
  }
  return process.env[name];
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  internalToken:
    requiredInProduction("INTERNAL_SERVICE_TOKEN") ?? "qevent_internal_service_token_dev",
  reservationTtlMs: Number(process.env.RESERVATION_TTL_MS) || 600_000,
  serviceRoot,
};
