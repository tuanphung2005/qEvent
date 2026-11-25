import { http, HttpResponse } from "msw";
import { attendeeUser, host, organizer, staff } from "../../../test/msw/fixtures";

export const handlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const user =
      body.email === organizer.email
        ? organizer
        : body.email === host.email
          ? host
          : body.email === staff.email
            ? staff
            : body.email === attendeeUser.email
              ? attendeeUser
              : null;

    if (!user || body.password !== "password123") {
      return HttpResponse.json(
        { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" },
        { status: 401 },
      );
    }

    // The presenter route needs a real HOST session; other demo users share one token.
    const token = user.role === "HOST" ? "host-token" : "test-token";
    return HttpResponse.json({ token, user });
  }),
  http.get("/api/auth/me", ({ request }) => {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    return HttpResponse.json({ user: token === "host-token" ? host : organizer });
  }),
];
