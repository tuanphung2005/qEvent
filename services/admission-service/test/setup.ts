import path from "node:path";

const serviceRoot = path.resolve(import.meta.dir, "..");
const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error("TEST_DATABASE_URL is required for admission-service tests (see .env.example)");
}

process.env.DATABASE_URL = testUrl;
process.env.KEYS_DIR = path.resolve(serviceRoot, ".test-keys");

const push = Bun.spawnSync({
  cmd: ["bunx", "prisma", "db", "push", "--skip-generate"],
  cwd: serviceRoot,
  env: { ...process.env, DATABASE_URL: testUrl },
  stdout: "pipe",
  stderr: "pipe",
});

if (push.exitCode !== 0) {
  throw new Error(`Test schema push failed:\n${push.stderr.toString()}`);
}
