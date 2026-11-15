import { ApiRequestError, errorMessage, toApiError } from "@/lib/api/errors";
import { describe, expect, it } from "vitest";

describe("error mapping", () => {
  it("maps a gateway code to Vietnamese copy", () => {
    expect(errorMessage("ALREADY_CHECKED_IN")).toBe("Vé đã được soát.");
    expect(errorMessage("QUOTA_BELOW_SOLD")).toContain("quota");
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(errorMessage("SOMETHING_NEW")).toBe(errorMessage("UNKNOWN"));
    expect(errorMessage(null)).toBe(errorMessage("UNKNOWN"));
  });

  it("treats a fetch failure as a network error", () => {
    const apiError = toApiError(new TypeError("Failed to fetch"));
    expect(apiError.code).toBe("NETWORK");
    expect(apiError.status).toBe(0);
  });

  it("keeps the thrown status and code", () => {
    const cause = new ApiRequestError({
      code: "FORBIDDEN",
      message: "Bạn không có quyền",
      status: 403,
    });
    expect(toApiError(cause)).toEqual({
      code: "FORBIDDEN",
      message: "Bạn không có quyền",
      status: 403,
    });
  });
});
