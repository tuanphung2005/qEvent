import { expect, test } from "@playwright/test";
import { scanA11y, seedBase, signInWithToken } from "./fixtures";

const API_BASE = process.env.E2E_API_BASE ?? "http://localhost:8000";

type SessionRef = { eventId: string; sessionRef: string };

type EventWithSessions = {
  events: Array<{ id: string; sessions: Array<{ id: string; title: string }> }>;
};

async function apiGet<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

/**
 * Sessions are listed in seed order, but other specs create sessions on the same
 * event, so "sessions[0]" is not stable. Probe for a session that already has
 * the data the assertion needs.
 */
async function findSession(token: string, kind: "qa" | "polls"): Promise<SessionRef> {
  const body = await apiGet<EventWithSessions>("/api/events", token);
  for (const event of body?.events ?? []) {
    for (const session of event.sessions) {
      const data =
        kind === "qa"
          ? await apiGet<{ questions: unknown[] }>(`/api/sessions/${session.id}/questions`, token)
          : await apiGet<{ polls: unknown[] }>(`/api/sessions/${session.id}/polls`, token);
      const rows =
        kind === "qa"
          ? (data as { questions?: unknown[] })?.questions
          : (data as { polls?: unknown[] })?.polls;
      if (rows?.length) return { eventId: event.id, sessionRef: session.id };
    }
  }
  throw new Error(
    `Không có phiên nào có ${kind === "qa" ? "câu hỏi" : "khảo sát"} — chạy \`bun run seed\` và \`bun run demo:seed\`.`,
  );
}

async function findQuizSession(token: string, status?: string): Promise<SessionRef> {
  const body = await apiGet<EventWithSessions>("/api/events", token);
  for (const event of body?.events ?? []) {
    for (const session of event.sessions) {
      const game = await apiGet<{ game: { status: string } }>(
        `/api/sessions/${session.id}/game`,
        token,
      );
      if (game && (!status || game.game.status === status)) {
        return { eventId: event.id, sessionRef: session.id };
      }
    }
  }
  throw new Error(`Không có quiz ${status ?? ""} — chạy \`bun run seed:engagement\`.`);
}

async function openSession(page: Parameters<typeof signInWithToken>[0], tab: string) {
  const { organizerToken } = await seedBase();
  const kind = tab === "/polls" ? "polls" : "qa";
  const { eventId, sessionRef } = await findSession(organizerToken, kind);

  await signInWithToken(page, organizerToken);
  await page.goto(`/engagement/${sessionRef}${tab}?eventId=${eventId}`);
  await expect(page.getByRole("heading", { name: "Tương tác trực tiếp" })).toBeVisible();
  return { eventId, sessionId: sessionRef };
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

  test("xoá câu hỏi Quiz thì khôi phục lại được", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId, sessionRef } = await findQuizSession(organizerToken, "WAITING");
    await signInWithToken(page, organizerToken);
    await page.goto(`/engagement/${sessionRef}/quiz?eventId=${eventId}`);
    await expect(page.getByRole("heading", { name: "Tương tác trực tiếp" })).toBeVisible();

    // The whole game is not deletable — only individual questions.
    await expect(page.getByRole("button", { name: "Xoá game" })).toHaveCount(0);

    const listTitle = page.getByText(/Danh sách câu hỏi \(\d+\)/);
    await expect(listTitle).toBeVisible();
    const before = Number(/\((\d+)\)/.exec((await listTitle.textContent()) ?? "")?.[1]);
    expect(before).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Xoá câu hỏi 1" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Xoá câu hỏi Quiz?" });
    await dialog.getByRole("button", { name: "Xoá câu hỏi" }).click();

    await expect(page.getByText("Câu hỏi đã xoá (1)")).toBeVisible();
    await expect(page.getByText(`Danh sách câu hỏi (${before - 1})`)).toBeVisible();

    await page.getByRole("button", { name: "Khôi phục" }).click();
    await expect(page.getByText(`Danh sách câu hỏi (${before})`)).toBeVisible();
    await expect(page.getByText("Câu hỏi đã xoá (1)")).toHaveCount(0);
  });

  test("xoá câu hỏi Q&A thì khôi phục lại được", async ({ page }) => {
    await openSession(page, "/qa");
    await expect(page.getByRole("button", { name: "Xoá câu hỏi" }).first()).toBeVisible();
    const before = await page.getByRole("button", { name: "Xoá câu hỏi" }).count();
    expect(before).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Xoá câu hỏi" }).first().click();
    const dialog = page.getByRole("alertdialog", { name: "Xác nhận xoá câu hỏi?" });
    await dialog.getByRole("button", { name: "Xác nhận xoá" }).click();

    await expect(page.getByText("Câu hỏi đã xoá (1)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Xoá câu hỏi" })).toHaveCount(before - 1);

    await page.getByRole("button", { name: "Khôi phục" }).click();
    await expect(page.getByText("Câu hỏi đã xoá (1)")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Xoá câu hỏi" })).toHaveCount(before);
  });

  test("xoá khảo sát thì khôi phục lại được", async ({ page }) => {
    await openSession(page, "/polls");
    const pollDelete = page.getByRole("button", { name: /^Xoá khảo sát / });
    await expect(pollDelete.first()).toBeVisible();
    const before = await pollDelete.count();
    expect(before).toBeGreaterThan(0);

    await pollDelete.first().click();
    const dialog = page.getByRole("alertdialog", { name: "Xoá khảo sát?" });
    await dialog.getByRole("button", { name: "Xoá khảo sát" }).click();

    await expect(page.getByText("Khảo sát đã xoá (1)")).toBeVisible();
    await expect(pollDelete).toHaveCount(before - 1);

    await page.getByRole("button", { name: "Khôi phục" }).click();
    await expect(page.getByText("Khảo sát đã xoá (1)")).toHaveCount(0);
    await expect(pollDelete).toHaveCount(before);
  });

  test("chơi lại được quiz đã kết thúc", async ({ page }) => {
    const { organizerToken } = await seedBase();
    const { eventId, sessionRef } = await findQuizSession(organizerToken, "FINISHED");
    await signInWithToken(page, organizerToken);
    await page.goto(`/engagement/${sessionRef}/quiz?eventId=${eventId}`);
    await expect(page.getByText("Đã kết thúc")).toBeVisible();

    await page.getByRole("button", { name: "Chơi lại" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Chơi lại Quiz game?" });
    await dialog.getByRole("button", { name: "Xác nhận" }).click();

    // Restart + start in one action: the first question is live again.
    await expect(page.getByText("Đang trả lời")).toBeVisible();
    await expect(page.getByText(/Câu hiện tại: 1 \//)).toBeVisible();

    // Put the demo game back in the state the test found it in.
    await page.getByRole("button", { name: "Công bố đáp án" }).click();
    await page.getByRole("button", { name: "Kết thúc Game" }).click();
    await page
      .getByRole("alertdialog", { name: "Kết thúc trò chơi Quiz?" })
      .getByRole("button", { name: "Xác nhận" })
      .click();
    await expect(page.getByText("Đã kết thúc")).toBeVisible();
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
