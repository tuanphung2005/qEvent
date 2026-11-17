import { expect, test } from "@playwright/test";
import { scanA11y, seedBase, signInWithToken } from "./fixtures";

function futureLocal(days: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

test.describe("sự kiện", () => {
  test("organizer tạo sự kiện rồi mở trang chi tiết", async ({ page }) => {
    const { organizerToken } = await seedBase();
    await signInWithToken(page, organizerToken);
    await page.goto("/events");

    await expect(page.getByRole("heading", { name: "Sự kiện" })).toBeVisible();
    await page.getByRole("link", { name: "Tạo sự kiện" }).click();

    const name = `E2E Event ${Date.now()}`;
    await page.getByLabel("Tên sự kiện").fill(name);
    await page.getByLabel("Địa điểm").fill("E2E Convention Center");
    await page.getByLabel("Bắt đầu").fill(futureLocal(30, 9));
    await page.getByLabel("Kết thúc").fill(futureLocal(30, 17));
    await page.getByLabel("Sức chứa").fill("120");

    await page.getByRole("button", { name: "Thêm phòng" }).click();
    await page.getByLabel("Tên phòng").fill("Main Hall");
    await page.getByLabel("Sức chứa").last().fill("120");

    await page.getByRole("button", { name: "Tạo sự kiện" }).click();

    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Sắp diễn ra")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sửa sự kiện" })).toBeVisible();
    await expect(page.getByText("E2E Convention Center").first()).toBeVisible();
  });

  test("staff chỉ xem, không thấy nút tạo hoặc sửa", async ({ page }) => {
    const { staffToken } = await seedBase();
    await signInWithToken(page, staffToken);
    await page.goto("/events");

    await expect(page.getByRole("heading", { name: "Sự kiện" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Danh sách sự kiện" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tạo sự kiện" })).toHaveCount(0);

    await page.getByRole("link", { name: "Xem" }).first().click();
    await expect(page.getByRole("link", { name: "Sửa sự kiện" })).toHaveCount(0);

    await page.getByRole("tab", { name: "Phòng" }).click();
    await expect(page.getByRole("heading", { name: "Phòng" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm phòng" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sửa" })).toHaveCount(0);
  });

  test("danh sách sự kiện không có vi phạm axe nghiêm trọng", async ({ page }) => {
    const { staffToken } = await seedBase();
    await signInWithToken(page, staffToken);
    await page.goto("/events");
    await expect(page.getByRole("table", { name: "Danh sách sự kiện" })).toBeVisible();

    const results = await scanA11y(page);
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
