import { expect, test } from "@playwright/test";
import { pickEvent, seedBase, signInWithToken } from "./fixtures";

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

async function apiGet<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

/** The engagement shell picks `sessions[0]`; the dashboard picks the live one first. */
async function eventWithQuiz(token: string): Promise<{ eventId: string; sessionId: string }> {
  const body = await apiGet<{ events: Array<{ id: string; sessions: Array<{ id: string }> }> }>(
    "/api/events",
    token,
  );
  for (const event of body?.events ?? []) {
    const session = event.sessions[0];
    if (!session) continue;
    if (await apiGet(`/api/sessions/${session.id}/game`, token)) {
      return { eventId: event.id, sessionId: session.id };
    }
  }
  throw new Error("Không có phiên nào có quiz — chạy `bun run seed:engagement`.");
}

test.describe("tổng quan", () => {
  test("số liệu theo sự kiện đã chọn và lối tắt sang đơn hàng", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId, eventName } = await pickEvent(organizerToken);
    await signInWithToken(page, organizerToken);
    await page.goto(`/dashboard?eventId=${eventId}`);

    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
    await expect(page.getByText(eventName, { exact: true }).first()).toBeVisible();

    const stats = page.getByRole("region", { name: "Số liệu soát vé" });
    await expect(stats).toBeVisible();
    for (const label of ["Vé đã bán", "Đã soát", "Còn lại", "Tỉ lệ soát"]) {
      await expect(stats.getByText(label, { exact: true })).toBeVisible();
    }

    await page.getByRole("button", { name: "Xem đơn hàng" }).click();
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.getByRole("heading", { name: "Đơn hàng" })).toBeVisible();
  });

  test("nút chi tiết mở đúng trang sự kiện", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId, eventName } = await pickEvent(organizerToken);
    await signInWithToken(page, organizerToken);
    await page.goto(`/dashboard?eventId=${eventId}`);

    await page.getByRole("button", { name: "Chi tiết sự kiện" }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}`));
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
  });

  test("xem tab Quiz rồi quay lại tổng quan không vỡ", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId, sessionId } = await eventWithQuiz(organizerToken);
    await signInWithToken(page, organizerToken);

    // Load the quiz tab first so its payload owns the cache entry, then navigate
    // in-app (a reload would clear the cache and hide the bug).
    await page.goto(`/engagement/${sessionId}/quiz?eventId=${eventId}`);
    await expect(page.getByRole("heading", { name: "Tương tác trực tiếp" })).toBeVisible();
    await expect(page.getByText("Trò chơi Trắc nghiệm trực tiếp")).toBeVisible();

    await page.getByRole("link", { name: "Tổng quan" }).click();
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
    await expect(page.getByText(/Thử tải lại trang/)).toHaveCount(0);
  });
});
