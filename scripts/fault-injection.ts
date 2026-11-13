/**
 * Fault-isolation measurement for the defense report.
 *
 * Usage (gateway must be running on :8000):
 *   bun scripts/fault-injection.ts baseline
 *   docker compose stop engagement-service
 *   bun scripts/fault-injection.ts engagement-down
 *   docker compose start engagement-service
 *   docker compose stop admission-service
 *   bun scripts/fault-injection.ts admission-down
 *   docker compose start admission-service
 *
 * It signs a STAFF JWT locally, so it still works when Admission is down and
 * /api/auth/login is unavailable.
 */
const BASE = process.env.GATEWAY_URL ?? "http://localhost:8000";
const SECRET = process.env.JWT_SECRET ?? "qevent_super_jwt_secret_key_2026";
const label = process.argv[2] ?? "run";

const encoder = new TextEncoder();
const b64 = (input: ArrayBuffer | Uint8Array) =>
  Buffer.from(input as ArrayBuffer).toString("base64url");

async function signStaffToken(): Promise<string> {
  const header = b64(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64(
    encoder.encode(
      JSON.stringify({
        sub: "fault-injection-staff",
        id: "fault-injection-staff",
        role: "STAFF",
        iat: Math.floor(Date.now() / 1000),
      })
    )
  );
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${b64(signature)}`;
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    min: Math.round(sorted[0] * 10) / 10,
    p50: Math.round(at(50) * 10) / 10,
    p95: Math.round(at(95) * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
  };
}

const token = await signStaffToken();
const auth = { authorization: `Bearer ${token}` };

const readSamples: number[] = [];
const readStatuses: number[] = [];
for (let i = 0; i < 20; i++) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/tickets/my`, { headers: auth });
  readSamples.push(performance.now() - t0);
  readStatuses.push(res.status);
  await res.text();
}

const checkinSamples: number[] = [];
const checkinStatuses: number[] = [];
for (let i = 0; i < 6; i++) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/checkins`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ qrToken: "invalid.token", deviceId: "gate:fault-injection" }),
  });
  checkinSamples.push(performance.now() - t0);
  checkinStatuses.push(res.status);
  await res.text();
}

const health = (await (await fetch(`${BASE}/health`)).json()) as any;

console.log(
  JSON.stringify(
    {
      label,
      readTicketsMy: {
        ...stats(readSamples),
        statuses: [...new Set(readStatuses)],
        ok: readStatuses.filter((s) => s === 200).length,
        total: readStatuses.length,
      },
      checkin: {
        ...stats(checkinSamples),
        statuses: [...new Set(checkinStatuses)],
        total: checkinStatuses.length,
      },
      circuitBreakers: health.circuitBreakers,
      downstream: health.downstream,
    },
    null,
    2
  )
);
