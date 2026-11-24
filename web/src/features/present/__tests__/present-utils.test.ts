import { describe, expect, it } from "vitest";
import { defaultPresentSettings, parsePresentSettings } from "../present-settings";
import { secondsLeft } from "../present-utils";

describe("presenter settings", () => {
  it("uses defaults for an empty or broken entry", () => {
    expect(parsePresentSettings(null)).toEqual(defaultPresentSettings);
    expect(parsePresentSettings("{not json")).toEqual(defaultPresentSettings);
  });

  it("keeps valid fields and repairs unknown ones", () => {
    const parsed = parsePresentSettings(
      JSON.stringify({ theme: "dark", font: "huge", accent: "neon", showLogo: false }),
    );
    expect(parsed).toEqual({ theme: "dark", font: "huge", accent: "primary", showLogo: false });
  });
});

describe("quiz countdown", () => {
  const start = "2026-11-24T10:00:00.000Z";

  it("returns null before the question starts", () => {
    expect(secondsLeft(null, 30, Date.parse(start))).toBeNull();
  });

  it("counts down and never goes below zero", () => {
    const at = (sec: number) => Date.parse(start) + sec * 1000;
    expect(secondsLeft(start, 30, at(0))).toBe(30);
    expect(secondsLeft(start, 30, at(12))).toBe(18);
    expect(secondsLeft(start, 30, at(99))).toBe(0);
  });
});
