import { expect, test } from "@playwright/test";
import { pickEvent, requireSession, seedBase, signIn, signInWithToken } from "./fixtures";

test.describe("màn trình chiếu", () => {
  test("host đăng nhập vào thẳng màn trình chiếu của phiên đang diễn ra", async ({ page }) => {
    await signIn(page, "host");
    await page.goto("/present");

    await expect(page).toHaveURL(/\/present\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hỏi đáp" })).toBeVisible();
    await expect(page.getByTestId("present-logo")).toBeVisible();
  });

  test("đổi slide, mở quiz và bật/tắt logo", async ({ page }) => {
    await signIn(page, "host");
    await page.goto("/present");
    await page.getByRole("button", { name: "Quiz", exact: true }).click();
    await expect(page.getByRole("button", { name: "Quiz", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const lettersOnly = page.getByRole("button", { name: "A B C D", exact: true });
    await lettersOnly.click();
    await expect(lettersOnly).toHaveAttribute("aria-pressed", "true");
    const full = page.getByRole("button", { name: "Đầy đủ", exact: true });
    await full.click();
    await expect(full).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Tuỳ chỉnh trình chiếu" }).click();
    const logo = page.getByLabel("Logo qEvent góc phải");
    await logo.uncheck();
    await expect(page.getByTestId("present-logo")).toHaveCount(0);
    await logo.check();
    await expect(page.getByTestId("present-logo")).toBeVisible();
  });

  test("phiên không tồn tại hiện thông báo thay vì màn hình trắng", async ({ page }) => {
    await signIn(page, "host");
    await page.goto("/present/khong-co-phien-nay");

    await expect(page.getByText("Không tìm thấy phiên")).toBeVisible();
    await expect(page.getByRole("link", { name: "Về màn trình chiếu" })).toBeVisible();
  });

  test("host chọn được phiên của sự kiện thứ hai", async ({ page }) => {
    await signIn(page, "host");
    await page.goto("/present");

    await page.getByLabel("Chọn phiên trình chiếu").click();
    await page.getByRole("option", { name: /Chống gian lận QR/ }).click();

    await expect(page).toHaveURL(/33333333-3333-4333-8333-333333333344/);
    await expect(page.getByText("AI & Vé thông minh 2026").first()).toBeVisible();
  });

  test("host sửa được nội dung của sự kiện được phân công", async ({ page }) => {
    const { hostToken } = await seedBase();
    const event = await pickEvent(hostToken, { withSession: true });
    const sessionId = requireSession(event);
    await signInWithToken(page, hostToken);

    await page.goto(`/engagement/${sessionId}/polls`);
    await expect(page.getByRole("button", { name: "Tạo khảo sát mới" })).toBeVisible();
  });
});
