import { expect, test } from "@playwright/test";
import { createEvent, seedBase, signInWithToken } from "./fixtures";

test("organizer assigns a HOST to an event and removes the assignment", async ({ page }) => {
  const { organizerToken } = await seedBase();
  const created = await createEvent(organizerToken);
  await signInWithToken(page, organizerToken);

  await page.goto(`/events/${created.eventId}/hosts`);
  await expect(page.getByText("Người dẫn được phân công")).toBeVisible();

  await page.getByLabel("Chọn tài khoản host").click();
  await page.getByRole("option", { name: /Alex Nguyen/ }).click();
  await page.getByRole("button", { name: "Phân công" }).click();

  await expect(page.getByText("Alex Nguyen (Host)")).toBeVisible();
  await expect(page.getByText("Bỏ phân công")).toBeVisible();

  await page.getByRole("button", { name: "Bỏ phân công" }).click();
  await page.getByRole("button", { name: "Bỏ phân công" }).last().click();
  await expect(page.getByText("Chưa phân công host")).toBeVisible();
});
