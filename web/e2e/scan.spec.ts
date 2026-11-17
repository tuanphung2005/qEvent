import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedBase, signInWithToken } from "./fixtures";

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

async function api<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

type OrderBody = {
  order: { id: string; status: string; tickets: Array<{ id: string }> };
};

async function post<T>(
  path: string,
  token: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; data: T | null }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

/** Buys one fresh ticket through the real saga so the scan test is repeatable. */
async function createPaidTicket(
  attendeeToken: string,
  staffToken: string,
  eventId: string,
): Promise<string | null> {
  const detail = await api<{ event: { ticketTypes: Array<{ id: string }> } }>(
    `/api/events/${eventId}`,
    staffToken,
  );
  const ticketTypeId = detail?.event.ticketTypes[0]?.id;
  if (!ticketTypeId) return null;

  const created = await post<OrderBody>(
    "/api/orders",
    attendeeToken,
    { eventId, ticketTypeId, quantity: 1 },
    { "idempotency-key": `e2e-scan-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}` },
  );
  let order = created.data?.order;
  if (created.status === 202 && order) {
    for (let attempt = 0; attempt < 20 && order.status === "PENDING"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      order = (await api<OrderBody>(`/api/orders/${order.id}`, attendeeToken))?.order ?? order;
    }
  }
  return order?.status === "CONFIRMED" ? (order.tickets[0]?.id ?? null) : null;
}

test.describe("quét vé", () => {
  test("mã rác: khối đỏ kèm lý do", async ({ page }) => {
    const { staffToken } = await seedBase();
    await signInWithToken(page, staffToken);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "Quét vé" })).toBeVisible();

    await page.getByLabel("Dán nội dung mã QR").fill("khong-phai-ma-qr");
    await page.getByRole("button", { name: "Soát vé" }).click();

    const result = page.getByRole("status");
    await expect(result).toContainText("Mã QR không hợp lệ");
    await expect(result).toContainText("hết hạn");
  });

  test("vé PAID: xanh, rồi vàng khi quét lại cùng vé", async ({ page }) => {
    const { staffToken, attendeeToken } = await seedBase();
    const events = await api<{ events: Array<{ id: string }> }>("/api/events", staffToken);
    if (!events?.events.length) {
      throw new Error("Chưa có sự kiện trong DB seed — chạy `bun run seed`.");
    }

    const eventId = events.events[0].id;
    await signInWithToken(page, staffToken);
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "Quét vé" })).toBeVisible();

    // AppShell currently nests <main> inside SidebarInset's <main>; scan the feature
    // content only. Widen to "main" once the shell renders a single main landmark.
    const results = await new AxeBuilder({ page }).include("main main").analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);

    const ticketId = await createPaidTicket(attendeeToken, staffToken, eventId);
    if (!ticketId) {
      throw new Error("Không tạo được vé PAID qua API — kiểm tra quota và saga.");
    }

    // Fetch the 30s token right before scanning so the second scan stays inside its window.
    const qr = await api<{ qrToken: string }>(`/api/tickets/${ticketId}/qr-token`, staffToken);
    expect(qr?.qrToken).toBeTruthy();

    const input = page.getByLabel("Dán nội dung mã QR");
    await input.fill(qr?.qrToken ?? "");
    await page.getByRole("button", { name: "Soát vé" }).click();
    await expect(page.getByRole("status")).toContainText("Vé hợp lệ");
    await page.getByRole("button", { name: "Quét tiếp" }).click();

    // The scanner ignores the same code for 3s; waiting it out must yield 409 → amber.
    await page.waitForTimeout(3200);
    await input.fill(qr?.qrToken ?? "");
    await page.getByRole("button", { name: "Soát vé" }).click();
    await expect(page.getByRole("status")).toContainText("Vé đã được soát");
  });
});
