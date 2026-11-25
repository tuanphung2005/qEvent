import { describe, expect, it } from "bun:test";
import { call, makeTestApp } from "./helpers";

const organizer = { "x-user-id": "user-host-mode", "x-user-role": "ORGANIZER" };
const attendee = { "x-user-id": "user-attendee-mode", "x-user-role": "ATTENDEE" };

async function activeGame(app: ReturnType<typeof makeTestApp>["app"]) {
  const game = await call(app, "/api/sessions/session-mode/game", {
    method: "POST",
    headers: organizer,
  });
  const gameId = game.data.game.id;
  await call(app, `/api/game/${gameId}/question`, {
    method: "POST",
    headers: organizer,
    body: {
      content: "Which header identifies the user?",
      options: ["x-user-id", "x-role", "authorization", "cookie"],
      correctOption: 0,
      timeLimitSec: 30,
    },
  });
  await call(app, `/api/game/${gameId}/start`, { method: "POST", headers: organizer });
  return gameId;
}

describe("quiz attendee display mode", () => {
  it("defaults to FULL and shows the question text with options", async () => {
    const { app } = makeTestApp();
    const gameId = await activeGame(app);

    const view = await call(app, `/api/game/${gameId}`, { headers: attendee });
    expect(view.status).toBe(200);
    expect(view.data.game.displayMode).toBe("FULL");
    expect(view.data.game.currentQuestion.content).toBe("Which header identifies the user?");
    expect(view.data.game.currentQuestion.options).toEqual([
      "x-user-id",
      "x-role",
      "authorization",
      "cookie",
    ]);
    expect(view.data.game.currentQuestion.correctOption).toBeUndefined();
  });

  it("LETTERS hides the question text and keeps only A/B/C/D", async () => {
    const { app } = makeTestApp();
    const gameId = await activeGame(app);

    const saved = await call(app, `/api/game/${gameId}/settings`, {
      method: "PATCH",
      headers: organizer,
      body: { displayMode: "LETTERS" },
    });
    expect(saved.status).toBe(200);
    expect(saved.data.game.displayMode).toBe("LETTERS");

    const view = await call(app, `/api/game/${gameId}`, { headers: attendee });
    expect(view.data.game.currentQuestion.content).toBeUndefined();
    expect(view.data.game.currentQuestion.options).toEqual(["A", "B", "C", "D"]);
  });

  it("reveals the correct letter without leaking it before reveal", async () => {
    const { app } = makeTestApp();
    const gameId = await activeGame(app);
    await call(app, `/api/game/${gameId}/settings`, {
      method: "PATCH",
      headers: organizer,
      body: { displayMode: "LETTERS" },
    });

    const before = await call(app, `/api/game/${gameId}`, { headers: attendee });
    expect(before.data.game.currentQuestion.correctLetter).toBeUndefined();

    await call(app, `/api/game/${gameId}/reveal`, { method: "POST", headers: organizer });
    const after = await call(app, `/api/game/${gameId}`, { headers: attendee });
    expect(after.data.game.currentQuestion.correctLetter).toBe("A");
  });
});
