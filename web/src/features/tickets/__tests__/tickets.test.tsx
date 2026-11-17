import { formatTicketCode } from "@/lib/format/ticket-code";
import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventFixture, ticketFixture } from "../../../../test/msw/fixtures";
import { server } from "../../../../test/msw/server";

// The api client builds `new Request("/api/...")`; Node's Request needs an absolute
// URL and jsdom only supplies the origin. openapi-fetch captures Request at module
// load, so patch the global before importing the page.
const NativeRequest = globalThis.Request;
const origin = window.location.origin;

class RelativeRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(
      typeof input === "string" && input.startsWith("/") ? new URL(input, origin) : input,
      init,
    );
  }
}

let TicketsPage: ComponentType;

beforeAll(async () => {
  globalThis.Request = RelativeRequest as typeof Request;
  ({ TicketsPage } = await import("../pages/TicketsPage"));
});

afterAll(() => {
  globalThis.Request = NativeRequest;
});

function renderTickets() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/tickets?eventId=${eventFixture.id}`]}>
        <Routes>
          <Route path="/tickets" element={<TicketsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TicketsPage", () => {
  it("hiển thị mã vé và trạng thái từ API", async () => {
    renderTickets();

    expect(await screen.findByRole("table", { name: "Danh sách vé" })).toBeInTheDocument();
    expect(await screen.findByText(formatTicketCode(ticketFixture.id))).toBeInTheDocument();
    expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Đã soát" })).toBeInTheDocument();
  });

  it("hiện empty state khi không có vé", async () => {
    server.use(
      http.get("/api/tickets", () => HttpResponse.json({ tickets: [], nextCursor: null })),
    );
    renderTickets();

    expect(await screen.findByText("Chưa có vé để hiển thị")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
