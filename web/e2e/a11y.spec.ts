import { type Page, expect, test } from "@playwright/test";
import { pickEvent, requireSession, scanA11y, seedBase, signInWithToken } from "./fixtures";

/**
 * One sweep over every screen an organizer can reach. It catches the class of
 * regression the per-feature specs miss: a shared primitive (badge, input,
 * table) changing colour or an uncaught error on a screen nobody opens daily.
 */

type Ids = { eventId: string; eventName: string; sessionId: string };

type Screen = {
  name: string;
  path: (ids: Ids) => string;
  ready: (page: Page, ids: Ids) => Promise<unknown>;
};

const screens: Screen[] = [
  {
    name: "tổng quan",
    path: (ids) => `/dashboard?eventId=${ids.eventId}`,
    ready: (page) => expect(page.getByText("Vé đã bán")).toBeVisible(),
  },
  {
    name: "danh sách sự kiện",
    path: () => "/events",
    ready: (page) => expect(page.getByRole("table", { name: "Danh sách sự kiện" })).toBeVisible(),
  },
  {
    name: "chi tiết sự kiện",
    path: (ids) => `/events/${ids.eventId}?eventId=${ids.eventId}`,
    ready: (page, ids) => expect(page.getByRole("heading", { name: ids.eventName })).toBeVisible(),
  },
  {
    name: "phòng",
    path: (ids) => `/events/${ids.eventId}/rooms?eventId=${ids.eventId}`,
    ready: (page) => expect(page.getByRole("heading", { name: "Phòng" })).toBeVisible(),
  },
  {
    name: "phiên",
    path: (ids) => `/events/${ids.eventId}/sessions?eventId=${ids.eventId}`,
    ready: (page) => expect(page.getByRole("heading", { name: "Phiên" })).toBeVisible(),
  },
  {
    name: "loại vé",
    path: (ids) => `/events/${ids.eventId}/ticket-types?eventId=${ids.eventId}`,
    ready: (page) => expect(page.getByRole("heading", { name: "Loại vé" })).toBeVisible(),
  },
  {
    name: "đơn hàng",
    path: (ids) => `/orders?eventId=${ids.eventId}`,
    ready: (page) => expect(page.getByRole("heading", { name: "Đơn hàng" })).toBeVisible(),
  },
  {
    name: "vé",
    path: (ids) => `/tickets?eventId=${ids.eventId}`,
    ready: (page) => expect(page.getByRole("heading", { name: "Vé" })).toBeVisible(),
  },
  {
    name: "check-in",
    path: (ids) => `/checkins?eventId=${ids.eventId}`,
    ready: (page) => expect(page.getByRole("region", { name: "Số liệu soát vé" })).toBeVisible(),
  },
  {
    name: "quét vé",
    path: () => "/scan",
    ready: (page) => expect(page.getByRole("heading", { name: "Quét vé" })).toBeVisible(),
  },
  {
    name: "đồng bộ",
    path: () => "/sync",
    ready: (page) => expect(page.getByRole("heading", { name: "Đồng bộ" })).toBeVisible(),
  },
  {
    name: "tương tác",
    path: (ids) => `/engagement/${ids.sessionId}?eventId=${ids.eventId}`,
    ready: (page) =>
      expect(page.getByRole("heading", { name: "Tương tác trực tiếp" })).toBeVisible(),
  },
  {
    name: "tài khoản",
    path: () => "/settings",
    ready: (page) => expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible(),
  },
];

/** Uncaught render errors surface as console errors; the UI still looks "fine". */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test.describe("a11y + lỗi runtime toàn bộ màn hình", () => {
  for (const screen of screens) {
    test(`màn hình ${screen.name}`, async ({ page }) => {
      const { organizerToken } = await seedBase();
      const pick = await pickEvent(organizerToken, { withSession: true });
      const ids = {
        eventId: pick.eventId,
        eventName: pick.eventName,
        sessionId: requireSession(pick),
      };

      const consoleErrors = watchConsole(page);
      await signInWithToken(page, organizerToken);
      await page.goto(screen.path(ids));
      await screen.ready(page, ids);

      expect(consoleErrors, `Lỗi console trên màn hình ${screen.name}`).toEqual([]);

      const serious = (await scanA11y(page)).violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious.map((violation) => `${violation.id}: ${violation.help}`),
        `Vi phạm axe trên màn hình ${screen.name}`,
      ).toEqual([]);
    });
  }
});
