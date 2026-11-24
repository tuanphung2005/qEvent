import { describe, expect, it } from "vitest";
import { loginLanding } from "../landing";

describe("login landing", () => {
  it("sends a host to the presenter screen", () => {
    expect(loginLanding("HOST", "/dashboard")).toBe("/present");
  });

  it("keeps an explicit deep link for a host", () => {
    expect(loginLanding("HOST", "/engagement/session-1")).toBe("/engagement/session-1");
  });

  it("keeps the dashboard for organizers and staff", () => {
    expect(loginLanding("ORGANIZER", "/dashboard")).toBe("/dashboard");
    expect(loginLanding("STAFF", "/dashboard")).toBe("/dashboard");
  });
});
