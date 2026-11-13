import type { PrismaClient } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { HttpAdmissionClient, type AdmissionClient } from "./lib/admission-client";
import { HttpEventClient, type EventClient } from "./lib/event-client";

export type Deps = {
  prisma: PrismaClient;
  admissionClient: AdmissionClient;
  eventClient: EventClient;
  now: () => Date;
  jwtSecret: string;
  internalToken: string;
};

export function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    prisma: overrides.prisma ?? prisma,
    admissionClient:
      overrides.admissionClient ??
      new HttpAdmissionClient(config.admissionServiceUrl, config.internalToken, 1000),
    eventClient:
      overrides.eventClient ??
      new HttpEventClient(config.eventServiceUrl, config.internalToken, config.requestTimeoutMs),
    now: overrides.now ?? (() => new Date()),
    jwtSecret: overrides.jwtSecret ?? config.jwtSecret,
    internalToken: overrides.internalToken ?? config.internalToken,
  };
}
