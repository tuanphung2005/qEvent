import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Generate or load RSA 2048 keypair
const KEYS_DIR = path.resolve(import.meta.dir, "../../keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "private.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "public.pem");

if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
}

let privateKeyPem: string;
let publicKeyPem: string;

if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
  privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, "utf-8");
  publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, "utf-8");
} else {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  privateKeyPem = privateKey;
  publicKeyPem = publicKey;
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKeyPem);
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKeyPem);
}

export const RSA_KEYS = {
  privateKey: privateKeyPem,
  publicKey: publicKeyPem,
};

/**
 * Standard RFC 6238 TOTP calculation (30s window, 6 digits)
 */
export function generateTOTP(secret: string, timestampMs = Date.now(), stepSeconds = 30): string {
  const epoch = Math.floor(timestampMs / 1000);
  const counter = Math.floor(epoch / stepSeconds);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secret);
  hmac.update(buf);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Verify TOTP against secret.
 * Allows current time window and previous time window (tolerance of 30s)
 */
export function verifyTOTP(secret: string, tokenCode: string, timestampMs = Date.now()): boolean {
  const currentCode = generateTOTP(secret, timestampMs);
  if (currentCode === tokenCode) return true;
  // Allow 1 step grace period (e.g. edge of 30s window)
  const previousCode = generateTOTP(secret, timestampMs - 30000);
  if (previousCode === tokenCode) return true;
  return false;
}

export interface DynamicQRPayload {
  tid: string; // ticketId
  eid: string; // eventId
  code: string; // TOTP code
  iat: number; // timestamp in seconds
}

/**
 * Sign payload with RSA-SHA256
 */
export function signDynamicQRPayload(payload: DynamicQRPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  const signature = sign.sign(RSA_KEYS.privateKey, "base64url");
  return `${data}.${signature}`;
}

/**
 * Verify dynamic QR token using RSA public key
 */
export function verifyDynamicQRToken(token: string): { valid: boolean; payload?: DynamicQRPayload; error?: string } {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return { valid: false, error: "Malformed token structure" };
    }
    const [dataB64, signature] = parts;
    const verify = crypto.createVerify("SHA256");
    verify.update(dataB64);
    verify.end();

    const isValidSig = verify.verify(RSA_KEYS.publicKey, signature, "base64url");
    if (!isValidSig) {
      return { valid: false, error: "Invalid cryptographic signature" };
    }

    const payload: DynamicQRPayload = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf-8"));
    const nowSec = Math.floor(Date.now() / 1000);

    // Reject tokens older than 60 seconds (Acceptance Criteria 1: Mã cũ quét sau 60s phải bị từ chối)
    if (nowSec - payload.iat > 60) {
      return { valid: false, error: "Token expired (>60s)" };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || "Failed to decode token" };
  }
}
