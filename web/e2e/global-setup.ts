const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

export const CREDENTIALS = {
  organizer: { email: "organizer@qevent.com", password: "password123" },
  staff: { email: "staff1@qevent.com", password: "password123" },
  attendee: { email: "attendee@qevent.com", password: "password123" },
} as const;

export type Role = keyof typeof CREDENTIALS;

/** Fails fast with an actionable message instead of a wall of timeouts. */
export default async function globalSetup(): Promise<void> {
  let health: Response;
  try {
    health = await fetch(`${API_BASE}/health`);
  } catch {
    throw new Error(
      `Không kết nối được gateway tại ${API_BASE}. Chạy \`docker compose up -d\` trước khi chạy e2e.`,
    );
  }

  if (!health.ok) {
    throw new Error(`Gateway trả ${health.status} cho /health. Kiểm tra \`docker compose ps\`.`);
  }
}
