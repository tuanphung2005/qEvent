import type { RequestHandler } from "msw";
import { setupWorker } from "msw/browser";

type FeatureMocks = { handlers?: RequestHandler[] };

const modules = import.meta.glob<FeatureMocks>("../../src/features/*/mocks.ts", { eager: true });
const handlers = Object.values(modules).flatMap((module) => module.handlers ?? []);

/** Dev-only worker: open the app with ?mock=1 to work without the gateway. */
export const worker = setupWorker(...handlers);
