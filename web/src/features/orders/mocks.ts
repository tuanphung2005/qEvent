import { http, HttpResponse } from "msw";
import { attendee, orderFixture, ticketFixture } from "../../../test/msw/fixtures";

const secondOrder = {
  ...orderFixture,
  id: "9b8c7d6e-0000-4000-8000-000000000002",
  status: "PENDING" as const,
  quantity: 1,
  totalAmount: 500000,
  ticketsCount: 1,
};

export const handlers = [
  http.get("/api/orders", () =>
    HttpResponse.json({ orders: [orderFixture, secondOrder], nextCursor: null }),
  ),
  http.get("/api/orders/:orderId", () =>
    HttpResponse.json({
      order: {
        id: orderFixture.id,
        userId: attendee.id,
        eventId: ticketFixture.eventId,
        ticketTypeId: ticketFixture.ticketTypeId,
        status: "CONFIRMED",
        quantity: 2,
        totalAmount: 1000000,
        failureCode: null,
        createdAt: orderFixture.createdAt,
        tickets: [
          {
            id: ticketFixture.id,
            status: "PAID",
            eventId: ticketFixture.eventId,
            ticketTypeId: ticketFixture.ticketTypeId,
            checkedInAt: null,
            createdAt: ticketFixture.createdAt,
          },
        ],
      },
    }),
  ),
];
