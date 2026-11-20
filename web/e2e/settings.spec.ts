import { expect, test } from "@playwright/test";
import { pickEvent, seedBase, signInWithToken } from "./fixtures";

test.describe("tài khoản", () => {
  test("hiện đúng hồ sơ và đăng xuất về trang đăng nhập", async ({ page }) => {
    const { organizerToken } = await seedBase();
    await signInWithToken(page, organizerToken);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible();
    await expect(page.getByText("organizer@qevent.com")).toBeVisible();
    await expect(page.getByText("Ban tổ chức")).toBeVisible();

    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("chọn sự kiện mặc định được ghi nhớ cho lần sau", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId } = await pickEvent(organizerToken);
    await signInWithToken(page, organizerToken);
    // Start on a deep link so the context has a selection to compare against.
    await page.goto(`/settings?eventId=${eventId}`);

    const select = page.getByRole("combobox", { name: "Sự kiện mặc định" });
    await expect(select).toBeVisible();
    const current = (await select.textContent())?.trim() ?? "";

    await select.click();
    const options = page.getByRole("option");
    const target = options.filter({ hasNotText: current }).first();
    const targetName = (await target.textContent())?.trim() ?? "";
    await target.click();

    await expect(select).toHaveText(targetName);
    const stored = await page.evaluate(() => localStorage.getItem("qevent.defaultEventId"));
    expect(stored).toBeTruthy();

    // Reload without ?eventId: the stored default must drive the selection.
    await page.goto("/settings");
    await expect(page.getByRole("combobox", { name: "Sự kiện mặc định" })).toHaveText(targetName);
  });
});
