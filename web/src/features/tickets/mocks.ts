import { http, HttpResponse } from "msw";
import { attendee, checkinFixture, orderFixture, ticketFixture } from "../../../test/msw/fixtures";

const checkedInTicket = {
  ...ticketFixture,
  id: "9f8e7d6c-0000-4000-8000-000000000002",
  status: "CHECKED_IN" as const,
  checkedInAt: "2026-11-20T01:15:00.000Z",
};

export const handlers = [
  http.get("/api/tickets", () =>
    HttpResponse.json({ tickets: [ticketFixture, checkedInTicket], nextCursor: null }),
  ),
  http.get("/api/tickets/:ticketId", () =>
    HttpResponse.json({
      ticket: ticketFixture,
      order: {
        id: orderFixture.id,
        status: "CONFIRMED",
        quantity: 2,
        totalAmount: 1000000,
        createdAt: orderFixture.createdAt,
      },
      checkinLogs: [
        {
          id: checkinFixture.id,
          scannedBy: attendee.id,
          scannedAt: checkinFixture.scannedAt,
          isOffline: false,
          deviceId: "gate-1",
          syncStatus: "SYNCED",
        },
      ],
    }),
  ),
  http.get("/api/tickets/:ticketId/qr-token", () =>
    HttpResponse.json({
      ticketId: ticketFixture.id,
      qrToken: "eyJhbGciOiJSUzI1NiJ9.mock-token.signature",
      expiresIn: 30,
      status: "PAID",
      checkedInAt: null,
    }),
  ),
];
