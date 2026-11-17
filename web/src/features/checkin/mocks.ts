import { http, HttpResponse } from "msw";
import { attendee, checkinFixture, ticketFixture } from "../../../test/msw/fixtures";

/**
 * Tokens are prefixed so the dev worker (and the evidence script) can reproduce
 * every row of the scan mapping table without a backend:
 *   mock-qr-token → 201, mock-already → 409, mock-invalid → 400, mock-down → 503.
 */
export const handlers = [
  http.get("/api/checkins", () =>
    HttpResponse.json({ checkins: [checkinFixture], nextCursor: null }),
  ),
  http.post("/api/checkins", async ({ request }) => {
    const body = (await request.json()) as { qrToken?: string };
    const token = body.qrToken ?? "";

    if (token.startsWith("mock-already")) {
      return HttpResponse.json(
        {
          code: "ALREADY_CHECKED_IN",
          message: "Ticket has already been checked in",
          ticket: {
            id: ticketFixture.id,
            status: "CHECKED_IN",
            checkedInAt: "2026-11-20T01:10:00.000Z",
            attendeeName: attendee.fullName,
          },
        },
        { status: 409 },
      );
    }

    if (token.startsWith("mock-invalid")) {
      return HttpResponse.json(
        { code: "INVALID_QR_TOKEN", message: "Mã QR không hợp lệ hoặc đã hết hạn." },
        { status: 400 },
      );
    }

    if (token.startsWith("mock-down")) {
      return HttpResponse.json(
        { code: "SERVICE_UNAVAILABLE", message: "Admission service is unavailable" },
        { status: 503 },
      );
    }

    return HttpResponse.json(
      {
        status: "CHECKIN_SUCCESS",
        code: "CHECKIN_SUCCESS",
        ticket: {
          id: ticketFixture.id,
          status: "CHECKED_IN",
          checkedInAt: "2026-11-20T01:15:00.000Z",
          attendeeName: attendee.fullName,
        },
        logId: checkinFixture.id,
      },
      { status: 201 },
    );
  }),
];
