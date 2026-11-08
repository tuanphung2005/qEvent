import type { PrismaClient } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { getKeys } from "./lib/keys";
import { HttpEventClient, type EventClient } from "./services/event-client";

export type Deps = {
  prisma: PrismaClient;
  keys: { privateKey: string; publicKey: string };
  eventClient: EventClient;
  now: () => Date;
  jwtSecret: string;
  internalToken: string;
  requestTimeoutMs: number;
  reconcileLeaseMs: number;
};

export function makeDeps(overrides: Partial<Deps> = {}): Deps {
  const internalToken = overrides.internalToken ?? config.internalToken;
  return {
    prisma: overrides.prisma ?? prisma,
    keys: overrides.keys ?? getKeys(),
    eventClient:
      overrides.eventClient ??
      new HttpEventClient(config.eventServiceUrl, internalToken, {
        timeoutMs: config.requestTimeoutMs,
      }),
    now: overrides.now ?? (() => new Date()),
    jwtSecret: overrides.jwtSecret ?? config.jwtSecret,
    internalToken,
    requestTimeoutMs: overrides.requestTimeoutMs ?? config.requestTimeoutMs,
    reconcileLeaseMs: overrides.reconcileLeaseMs ?? config.reconcileLeaseMs,
  };
}
