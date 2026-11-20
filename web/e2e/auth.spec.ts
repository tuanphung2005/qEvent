import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { CREDENTIALS, signIn } from "./fixtures";

test.describe("đăng nhập", () => {
  test("organizer vào được tổng quan và thấy điều hướng", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();

    await page.getByLabel("Email").fill(CREDENTIALS.organizer.email);
    await page.getByLabel("Mật khẩu").fill(CREDENTIALS.organizer.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tổng quan" }).first()).toBeVisible();
    await expect(page.getByLabel("Sự kiện đang chọn")).toBeVisible();
  });

  test("sai mật khẩu hiện lỗi tại form", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CREDENTIALS.staff.email);
    await page.getByLabel("Mật khẩu").fill("sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu không đúng");
    await expect(page).toHaveURL(/\/login/);
  });

  test("attendee bị chặn ngay tại form đăng nhập", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(CREDENTIALS.attendee.email);
    await page.getByLabel("Mật khẩu").fill(CREDENTIALS.attendee.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "Tài khoản khách tham dự không có quyền dùng giao diện nhân sự",
    );
    await expect(page).toHaveURL(/\/login/);
    // Console shell (sidebar) must not render for an attendee.
    await expect(page.getByRole("link", { name: "Tổng quan" })).toHaveCount(0);
  });

  test("phiên hết hạn đưa về /login kèm thông báo", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("qevent.token", "token-khong-hop-le");
    });
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Phiên đã hết hạn")).toBeVisible();
  });

  test("staff đăng nhập bằng token có sẵn", async ({ page }) => {
    await signIn(page, "staff");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  });

  test("trang đăng nhập không có vi phạm axe nghiêm trọng", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
