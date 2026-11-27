import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

export type RsaKeys = { privateKey: string; publicKey: string };

const cache = new Map<string, RsaKeys>();

export function getKeys(dir = config.keysDir): RsaKeys {
  const cached = cache.get(dir);
  if (cached) return cached;

  const privatePath = path.join(dir, "private.pem");
  const publicPath = path.join(dir, "public.pem");

  let keys: RsaKeys;
  if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
    keys = {
      privateKey: fs.readFileSync(privatePath, "utf-8"),
      publicKey: fs.readFileSync(publicPath, "utf-8"),
    };
  } else {
    fs.mkdirSync(dir, { recursive: true });
    const generated = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    keys = { privateKey: generated.privateKey, publicKey: generated.publicKey };
    fs.writeFileSync(privatePath, keys.privateKey, { mode: 0o600 });
    fs.writeFileSync(publicPath, keys.publicKey);
  }

  cache.set(dir, keys);
  return keys;
}

/**
 * Stable identifier for the active signing key. Mobile caches the public key by
 * this id so a rotation can invalidate the old one without shipping an app.
 */
export function keyId(publicKey: string): string {
  return crypto.createHash("sha256").update(publicKey).digest("base64url").slice(0, 16);
}
