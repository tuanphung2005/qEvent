import fs from "node:fs";
import path from "node:path";

const serviceRoot = path.resolve(import.meta.dir, "..");
const testUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:password123@localhost:5433/qevent_event_test?schema=public";

process.env.TEST_DATABASE_URL = testUrl;
process.env.DATABASE_URL = testUrl;

const markerDir = path.resolve(serviceRoot, ".test-keys");
const pushMarker = path.resolve(markerDir, ".db-pushed");
const isPushedRecently =
  fs.existsSync(pushMarker) && Date.now() - fs.statSync(pushMarker).mtimeMs < 60_000;

if (!isPushedRecently) {
  const push = Bun.spawnSync({
    cmd: ["bun", "run", "db:push", "--", "--skip-generate"],
    cwd: serviceRoot,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (push.exitCode !== 0) {
    throw new Error(`Test schema push failed:\n${push.stderr.toString()}`);
  }

  try {
    fs.mkdirSync(markerDir, { recursive: true });
    fs.writeFileSync(pushMarker, String(Date.now()));
  } catch {}
}
