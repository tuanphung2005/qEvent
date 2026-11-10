import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { HttpEventClient } from "../src/services/event-client";

type Call = { method: string; pathname: string; headers: Headers; body: string };

const calls: Call[] = [];
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      calls.push({
        method: request.method,
        pathname: new URL(request.url).pathname,
        headers: request.headers,
        body: await request.text(),
      });
      if (request.method === "DELETE") {
        return Response.json({ status: "RELEASED" });
      }
      return Response.json(
        { reservationId: "reservation-1", unitPrice: 25 },
        { status: 201 }
      );
    },
  });
});

afterAll(() => {
  server.stop(true);
});

describe("HttpEventClient", () => {
  it("reserves and releases through the internal event endpoints", async () => {
    const client = new HttpEventClient(
      `http://localhost:${server.port}`,
      "service-secret"
    );

    const created = await client.createReservation({
      operationId: "operation-1",
      eventId: "event-1",
      ticketTypeId: "ticket-type-1",
      quantity: 2,
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ reservationId: "reservation-1", unitPrice: 25 });

    const released = await client.releaseReservation("operation 1/2");
    expect(released.status).toBe(200);

    expect(calls[0].method).toBe("POST");
    expect(calls[0].pathname).toBe("/internal/reservations");
    expect(calls[0].headers.get("x-service-token")).toBe("service-secret");
    expect(calls[0].headers.get("content-type")).toContain("application/json");
    expect(JSON.parse(calls[0].body)).toEqual({
      operationId: "operation-1",
      eventId: "event-1",
      ticketTypeId: "ticket-type-1",
      quantity: 2,
    });

    expect(calls[1].method).toBe("DELETE");
    expect(calls[1].pathname).toBe("/internal/reservations/operation%201%2F2");
    expect(calls[1].headers.get("x-service-token")).toBe("service-secret");
  });
});
