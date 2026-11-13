function requiredInProduction(name: string): string | undefined {
  if (process.env.NODE_ENV === "production" && !process.env[name]) {
    throw new Error(`${name} is required in production`);
  }
  return process.env[name];
}

export const config = {
  port: Number(process.env.PORT) || 3003,
  jwtSecret: requiredInProduction("JWT_SECRET") ?? "qevent_dev_jwt_secret_change_me",
  internalToken:
    requiredInProduction("INTERNAL_SERVICE_TOKEN") ?? "qevent_internal_service_token_dev",
  admissionServiceUrl: process.env.ADMISSION_SERVICE_URL ?? "http://localhost:3002",
  eventServiceUrl: process.env.EVENT_SERVICE_URL ?? "http://localhost:3001",
  // Must stay below the gateway's 2000ms circuit-breaker timeout so the
  // service can return its own 503 instead of being cut off by the gateway.
  requestTimeoutMs: Number(process.env.INTERNAL_TIMEOUT_MS) || 1000,
};
