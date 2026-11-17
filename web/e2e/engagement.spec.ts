import { expect, test } from "@playwright/test";
import { scanA11y, seedBase, signInWithToken } from "./fixtures";

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

type EventWithSessions = {
  events: Array<{ id: string; sessions: Array<{ id: string; title: string }> }>;
};

async function openSession(page: Parameters<typeof signInWithToken>[0], tab: string) {
  const { organizerToken } = await seedBase();
  const response = await fetch(`${API_BASE}/api/events`, {
    headers: { authorization: `Bearer ${organizerToken}` },
  });
  const body = (await response.json()) as EventWithSessions;
  const event = body.events.find((item) => item.sessions.length > 0);
  if (!event) throw new Error("Chưa có sự kiện kèm phiên trong DB seed — chạy `bun run seed`.");

  const sessionId = event.sessions[0].id;
  await signInWithToken(page, organizerToken);
  await page.goto(`/engagement/${sessionId}${tab}?eventId=${event.id}`);
  await expect(page.getByRole("heading", { name: "Tương tác trực tiếp" })).toBeVisible();
  return { event, sessionId };
}

test.describe("tương tác", () => {
  test("Q&A hiển thị câu hỏi và không có vi phạm axe nghiêm trọng", async ({ page }) => {
    await openSession(page, "/qa");
    await expect(page.getByText(/phiếu bình chọn/).first()).toBeAttached();

    const serious = (await scanA11y(page)).violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("khảo sát hiển thị kết quả bằng Progress của shadcn", async ({ page }) => {
    await openSession(page, "/polls");
    await expect(page.getByRole("progressbar").first()).toBeVisible();

    const serious = (await scanA11y(page)).violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("form tạo khảo sát có label liên kết và không vi phạm axe", async ({ page }) => {
    await openSession(page, "/polls");
    await page.getByRole("button", { name: "Tạo khảo sát mới" }).click();

    await expect(page.getByLabel("Nội dung khảo sát")).toBeVisible();
    await expect(page.getByLabel("Lựa chọn 1")).toBeVisible();

    const serious = (await scanA11y(page)).violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("Quiz hiển thị trạng thái game và không có vi phạm axe nghiêm trọng", async ({ page }) => {
    await openSession(page, "/quiz");
    await expect(page.getByRole("heading", { name: "Tương tác trực tiếp" })).toBeVisible();

    const serious = (await scanA11y(page)).violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });
});
