import path from "node:path";

const serviceRoot = path.resolve(import.meta.dir, "..");

function requiredInProduction(name: string): string | undefined {
  if (process.env.NODE_ENV === "production" && !process.env[name]) {
    throw new Error(`${name} is required in production`);
  }
  return process.env[name];
}

export const config = {
  port: Number(process.env.PORT) || 3002,
  jwtSecret: requiredInProduction("JWT_SECRET") ?? "qevent_dev_jwt_secret_change_me",
  internalToken:
    requiredInProduction("INTERNAL_SERVICE_TOKEN") ?? "qevent_internal_service_token_dev",
  eventServiceUrl: process.env.EVENT_SERVICE_URL ?? "http://localhost:3001",
  keysDir: path.resolve(serviceRoot, process.env.KEYS_DIR ?? "keys"),
  // Must stay below the gateway's 2000ms timeout; see deps.ts.
  requestTimeoutMs: Number(process.env.INTERNAL_TIMEOUT_MS) || 1000,
  reconcileIntervalMs: Number(process.env.RECONCILE_INTERVAL_MS) || 5000,
  reconcileLeaseMs: Number(process.env.RECONCILE_LEASE_MS) || 30_000,
  serviceRoot,
};
