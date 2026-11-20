import { expect, test } from "@playwright/test";
import { pickEvent, seedBase, signInWithToken } from "./fixtures";

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

type TicketRow = { id: string; status: string };

async function api<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

test.describe("vé", () => {
  test("danh sách vé mở được chi tiết và lịch sử soát", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId } = await pickEvent(organizerToken);
    await signInWithToken(page, organizerToken);
    await page.goto(`/tickets?eventId=${eventId}`);

    await expect(page.getByRole("heading", { name: "Vé" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Danh sách vé" })).toBeVisible();

    await page.getByRole("link", { name: "Xem" }).first().click();

    await expect(page.getByRole("heading", { name: "Chi tiết vé" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Thông tin vé" })).toBeVisible();
    await expect(page.getByText("Người sở hữu")).toBeVisible();
    // The first ticket in the list may not have been scanned yet.
    await expect(
      page.getByRole("table", { name: "Lịch sử soát vé" }).or(page.getByText("Chưa có lượt soát")),
    ).toBeVisible();
  });

  test("tìm kiếm không khớp hiện empty state và xoá được bộ lọc", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId } = await pickEvent(organizerToken);
    await signInWithToken(page, organizerToken);
    await page.goto(`/tickets?eventId=${eventId}`);

    await page.getByLabel("Tìm vé").fill("zzz-khong-co-ve-nao");
    await expect(page.getByText("Chưa có vé để hiển thị")).toBeVisible();
    await expect(page.getByText(/khớp bộ lọc hiện tại/)).toBeVisible();

    await page.getByRole("button", { name: "Xoá bộ lọc" }).first().click();
    await expect(page.getByRole("table", { name: "Danh sách vé" })).toBeVisible();
  });

  test("mã QR vào cổng tự ẩn sau vài giây", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId } = await pickEvent(organizerToken);
    const tickets = await api<{ tickets: TicketRow[] }>(
      `/api/tickets?eventId=${eventId}`,
      organizerToken,
    );
    if (!tickets?.tickets.length) {
      throw new Error("Chưa có vé trong DB seed — chạy `bun run seed`.");
    }

    await signInWithToken(page, organizerToken);
    await page.goto(`/tickets/${tickets.tickets[0].id}`);
    await expect(page.getByRole("heading", { name: "Chi tiết vé" })).toBeVisible();

    await page.getByRole("button", { name: "Hiện mã QR" }).click();
    const dialog = page.getByRole("dialog", { name: "Mã QR vào cổng" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Copy mã" })).toBeVisible();

    // "Mã tự ẩn sau N giây" is a promise: the countdown must actually tick down.
    // A token issued seconds ago comes back with expiresIn = 1, so the first
    // reading can already be at the last second — accept any finite value.
    const countdown = dialog.getByText(/Mã tự ẩn sau \d+ giây/);
    const readSeconds = async () => {
      const value = (await countdown.textContent()) ?? "";
      const match = /(\d+) giây/.exec(value);
      return match ? Number(match[1]) : Number.NaN;
    };
    const tick = async () => ((await dialog.count()) === 0 ? -1 : readSeconds());

    const start = await readSeconds();
    expect(Number.isFinite(start)).toBe(true);
    await expect.poll(tick, { timeout: 25_000 }).toBeLessThan(start);

    if (await dialog.count()) {
      await dialog.getByRole("button", { name: "Đóng" }).click();
    }
    await expect(dialog).toHaveCount(0);
  });
});
