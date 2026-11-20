import { expect, test } from "@playwright/test";
import { createEvent, seedBase, signInWithToken } from "./fixtures";

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

function futureLocal(days: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

async function maxCapacity(eventId: string, token: string): Promise<number> {
  const response = await fetch(`${API_BASE}/api/events/${eventId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Không tải được sự kiện: HTTP ${response.status}`);
  const body = (await response.json()) as { event: { maxCapacity: number } };
  return body.event.maxCapacity;
}

test.describe("cấu trúc sự kiện", () => {
  // One disposable event for the whole file: seeding rooms/sessions/types into a
  // seeded demo event would leave "E2E ..." rows on real data.
  let eventId = "";

  test.beforeAll(async () => {
    const { organizerToken } = await seedBase();
    ({ eventId } = await createEvent(organizerToken));
  });

  test("thêm phòng rồi sửa sức chứa", async ({ page }) => {
    const { organizerToken } = await seedBase();
    await signInWithToken(page, organizerToken);
    await page.goto(`/events/${eventId}/rooms?eventId=${eventId}`);

    await expect(page.getByRole("heading", { name: "Phòng" })).toBeVisible();

    const name = `E2E Room ${Date.now()}`;
    await page.getByRole("button", { name: "Thêm phòng", exact: true }).click();

    const create = page.getByRole("dialog", { name: "Thêm phòng" });
    await create.getByLabel("Tên phòng").fill(name);
    await create.getByLabel("Sức chứa").fill("42");
    await create.getByRole("button", { name: "Thêm phòng" }).click();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("42");

    await row.getByRole("button", { name: "Sửa" }).click();
    const edit = page.getByRole("dialog", { name: "Sửa phòng" });
    await edit.getByLabel("Sức chứa").fill("64");
    await edit.getByRole("button", { name: "Lưu thay đổi" }).click();

    await expect(row).toContainText("64");
  });

  test("thêm phiên rồi bật/tắt live", async ({ page }) => {
    const { organizerToken } = await seedBase();
    await signInWithToken(page, organizerToken);
    await page.goto(`/events/${eventId}/sessions?eventId=${eventId}`);

    await expect(page.getByRole("heading", { name: "Phiên" })).toBeVisible();

    const title = `E2E Session ${Date.now()}`;
    await page.getByRole("button", { name: "Thêm phiên", exact: true }).click();

    const create = page.getByRole("dialog", { name: "Thêm phiên" });
    await create.getByLabel("Tiêu đề").fill(title);
    await create.getByLabel("Diễn giả").fill("E2E Speaker");
    await create.getByLabel("Bắt đầu").fill(futureLocal(40, 9));
    await create.getByLabel("Kết thúc").fill(futureLocal(40, 10));
    await create.getByRole("button", { name: "Thêm phiên" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Chưa live");

    await row.getByRole("button", { name: "Bật live" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Bật live phiên này?" });
    await confirm.getByRole("button", { name: "Bật live" }).click();

    await expect(row).toContainText("Đang diễn ra");

    await row.getByRole("button", { name: "Tắt live" }).click();
    await page
      .getByRole("alertdialog", { name: "Tắt live phiên này?" })
      .getByRole("button", { name: "Tắt live" })
      .click();
    await expect(row).toContainText("Chưa live");
  });

  test("cảnh báo quota vượt sức chứa trước khi lưu loại vé", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const capacity = await maxCapacity(eventId, organizerToken);
    await signInWithToken(page, organizerToken);
    await page.goto(`/events/${eventId}/ticket-types?eventId=${eventId}`);

    await expect(page.getByRole("heading", { name: "Loại vé" })).toBeVisible();

    const name = `E2E Type ${Date.now()}`;
    await page.getByRole("button", { name: "Thêm loại vé", exact: true }).click();

    const create = page.getByRole("dialog", { name: "Thêm loại vé" });
    await create.getByLabel("Tên loại vé").fill(name);
    await create.getByLabel("Giá (₫)").fill("100000");
    await create.getByLabel("Quota").fill(String(capacity + 50));

    await expect(create.getByText(/vượt sức chứa sự kiện/)).toBeVisible();
    await create.getByRole("button", { name: "Thêm loại vé" }).click();

    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByText("Có loại vé vượt sức chứa sự kiện")).toBeVisible();
  });
});
