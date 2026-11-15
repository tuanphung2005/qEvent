import type { RequestHandler } from "msw";
import { setupServer } from "msw/node";

type FeatureMocks = { handlers?: RequestHandler[] };

/**
 * MSW handlers come from features/<name>/mocks.ts, which keeps each owner's
 * fake contract inside their own folder. Nobody overrides another feature.
 */
const modules = import.meta.glob<FeatureMocks>("../../src/features/*/mocks.ts", { eager: true });
const handlers = Object.values(modules).flatMap((module) => module.handlers ?? []);

export const server = setupServer(...handlers);
