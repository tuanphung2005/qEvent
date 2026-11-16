import { http, HttpResponse } from "msw";
import { attendeeUser, organizer, staff } from "../../../test/msw/fixtures";

export const handlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const user =
      body.email === organizer.email
        ? organizer
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

    return HttpResponse.json({ token: "test-token", user });
  }),
  http.get("/api/auth/me", () => HttpResponse.json({ user: organizer })),
];
