import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import { getKeys } from "../src/lib/keys";

const dir = path.join(os.tmpdir(), `qevent-keys-${crypto.randomUUID()}`);

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("RSA key material", () => {
  it("generates, persists and reuses a usable key pair", () => {
    const first = getKeys(dir);

    expect(first.privateKey).toContain("BEGIN PRIVATE KEY");
    expect(first.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(fs.existsSync(path.join(dir, "private.pem"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "public.pem"))).toBe(true);

    const second = getKeys(dir);
    expect(second.privateKey).toBe(first.privateKey);

    const signature = crypto.sign("sha256", Buffer.from("ping"), first.privateKey);
    expect(
      crypto.verify("sha256", Buffer.from("ping"), first.publicKey, signature)
    ).toBe(true);
  });
});
