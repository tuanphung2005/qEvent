import { fail, type ErrorBody } from "./http";

type HeaderBag = Record<string, string | undefined>;

export function requireOrganizer(
  headers: HeaderBag,
  set: { status?: number | string }
): ErrorBody | null {
  if (headers["x-user-role"] !== "ORGANIZER") {
    return fail(set, 403, "FORBIDDEN", "Organizer role is required");
  }
  return null;
}

export function requireServiceToken(
  headers: HeaderBag,
  set: { status?: number | string },
  expected: string
): ErrorBody | null {
  if (headers["x-service-token"] !== expected) {
    return fail(set, 401, "UNAUTHORIZED_SERVICE", "Valid service token is required");
  }
  return null;
}
