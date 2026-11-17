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

async function openOrders(page: Parameters<typeof signInWithToken>[0]) {
  const { staffToken } = await seedBase();
  const events = await api<{ events: Array<{ id: string }> }>("/api/events", staffToken);
  if (!events?.events.length) {
    throw new Error("Chưa có sự kiện trong DB seed — chạy `bun run seed`.");
  }

  const eventId = events.events[0].id;
  await signInWithToken(page, staffToken);
  await page.goto(`/orders?eventId=${eventId}`);
  await expect(page.getByRole("heading", { name: "Đơn hàng" })).toBeVisible();
  return { staffToken, eventId };
}

test.describe("đơn hàng", () => {
  test("staff xem danh sách đơn, không có vi phạm axe nghiêm trọng", async ({ page }) => {
    await openOrders(page);

    await expect(page.getByLabel("Tìm đơn hàng")).toBeVisible();
    await expect(
      page
        .getByRole("table", { name: "Danh sách đơn hàng" })
        .or(page.getByText("Chưa có đơn hàng để hiển thị")),
    ).toBeVisible();

    // AppShell currently nests <main> inside SidebarInset's <main>; scan the feature
    // content only. Widen to "main" once the shell renders a single main landmark.
    const results = await new AxeBuilder({ page }).include("main main").analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("phím / đưa focus vào ô tìm kiếm", async ({ page }) => {
    await openOrders(page);

    await page.keyboard.press("/");
    await expect(page.getByLabel("Tìm đơn hàng")).toBeFocused();
  });
});
