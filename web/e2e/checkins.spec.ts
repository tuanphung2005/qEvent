import { expect, test } from "@playwright/test";
import { pickEvent, seedBase, signInWithToken } from "./fixtures";

test.describe("check-in", () => {
  test("số liệu, bảng lượt soát và tạm dừng tự cập nhật", async ({ page }) => {
    const { staffToken } = await seedBase();
    const { eventId, eventName } = await pickEvent(staffToken);
    await signInWithToken(page, staffToken);
    await page.goto(`/checkins?eventId=${eventId}`);

    await expect(page.getByRole("heading", { name: "Check-in" })).toBeVisible();
    await expect(page.getByText(eventName, { exact: false }).first()).toBeVisible();

    const stats = page.getByRole("region", { name: "Số liệu soát vé" });
    await expect(stats).toBeVisible();
    for (const label of ["Đã soát", "Tổng vé", "Còn lại", "Đơn đang xử lý"]) {
      await expect(stats.getByText(label, { exact: true })).toBeVisible();
    }

    await expect(page.getByRole("table", { name: "Lượt soát vé" })).toBeVisible();

    await page.getByRole("button", { name: "Tạm dừng" }).click();
    await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeVisible();
    await expect(page.getByText(/Bảng không tự tải thêm lượt soát mới/)).toBeVisible();

    await page.getByRole("button", { name: "Làm mới" }).click();
    await expect(page.getByRole("table", { name: "Lượt soát vé" })).toBeVisible();
  });
});
