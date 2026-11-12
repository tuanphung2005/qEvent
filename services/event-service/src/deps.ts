import type { PrismaClient } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./lib/prisma";

export type Deps = {
  prisma: PrismaClient;
  now: () => Date;
  internalToken: string;
  reservationTtlMs: number;
};

export function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    prisma: overrides.prisma ?? prisma,
    now: overrides.now ?? (() => new Date()),
    internalToken: overrides.internalToken ?? config.internalToken,
    reservationTtlMs: overrides.reservationTtlMs ?? config.reservationTtlMs,
  };
}
