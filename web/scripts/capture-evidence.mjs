/**
 * Captures the 3 required viewport screenshots (390 / 768 / 1440) into
 * docs/evidence/ui/<feature>/<screen>-<width>.png.
 * Runs against the dev server with MSW fixtures: `?mock=1`.
 *
 *   bun run dev
 *   node scripts/capture-evidence.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.EVIDENCE_BASE ?? "http://localhost:5173";
const OUT = "../docs/evidence/ui";
const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 768, height: 1024, label: "768" },
  { width: 1440, height: 900, label: "1440" },
];

async function shoot(page, feature, screen) {
  mkdirSync(`${OUT}/${feature}`, { recursive: true });
  await page.screenshot({ path: `${OUT}/${feature}/${screen}.png` });
  console.log(`✓ ${feature}/${screen}.png`);
}

const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();

  await page.goto(`${BASE}/login?mock=1`);
  await page.getByRole("heading", { name: "Đăng nhập" }).waitFor();
  await shoot(page, "auth", `login-${viewport.label}`);

  await page.getByLabel("Email").fill("organizer@qevent.com");
  await page.getByLabel("Mật khẩu").fill("password123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.getByRole("heading", { name: "Tổng quan" }).waitFor();

  // Pick the fixture event so the dashboard shows real counters.
  const trigger = page.getByRole("combobox", { name: "Sự kiện đang chọn" });
  if (await trigger.isVisible()) {
    await trigger.click();
    const option = page.getByRole("option").first();
    if (await option.isVisible()) await option.click();
  }
  await page.getByText("Lượt soát theo cổng").waitFor();
  await shoot(page, "dashboard", `dashboard-${viewport.label}`);

  await page.goto(`${BASE}/settings?mock=1`);
  await page.getByRole("heading", { name: "Tài khoản" }).waitFor();
  await shoot(page, "settings", `settings-${viewport.label}`);

  await context.close();
}

await browser.close();
