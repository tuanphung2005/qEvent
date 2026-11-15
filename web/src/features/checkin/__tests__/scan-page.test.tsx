import { formatTicketCode } from "@/lib/format/ticket-code";
import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attendee, eventFixture, ticketFixture } from "../../../../test/msw/fixtures";
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

let ScanPage: ComponentType;

beforeAll(async () => {
  globalThis.Request = RelativeRequest as typeof Request;
  ({ ScanPage } = await import("../pages/ScanPage"));
});

afterAll(() => {
  globalThis.Request = NativeRequest;
});

function renderScan() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/scan?eventId=${eventFixture.id}`]}>
        <Routes>
          <Route path="/scan" element={<ScanPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

type CheckinBody = { qrToken: string; gate?: string; deviceId?: string };

describe("ScanPage", () => {
  it("dán mã: gửi gate + deviceId, hiện kết quả xanh, giữ lịch sử", async () => {
    const bodies: CheckinBody[] = [];
    server.use(
      http.post("/api/checkins", async ({ request }) => {
        bodies.push((await request.json()) as CheckinBody);
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
            logId: "log-1",
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderScan();

    await user.type(screen.getByLabelText("Dán nội dung mã QR"), "mock-qr-token");
    await user.click(screen.getByRole("button", { name: "Soát vé" }));

    const result = await screen.findByRole("status");
    expect(result).toHaveTextContent("Vé hợp lệ");
    expect(result).toHaveTextContent("Nguyễn Văn An");
    expect(screen.getByRole("button", { name: "Quét tiếp" })).toHaveFocus();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      qrToken: "mock-qr-token",
      gate: "gate-1",
      deviceId: "gate-1",
    });

    await user.click(screen.getByRole("button", { name: "Quét tiếp" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(formatTicketCode(ticketFixture.id))).toBeInTheDocument();
    expect(screen.getByLabelText("Dán nội dung mã QR")).toHaveFocus();
  });

  it("vé đã soát: hiện khối vàng", async () => {
    const user = userEvent.setup();
    renderScan();

    await user.type(screen.getByLabelText("Dán nội dung mã QR"), "mock-already");
    await user.click(screen.getByRole("button", { name: "Soát vé" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Vé đã được soát");
  });

  it("dịch vụ lỗi: hiện khối xám, chưa kết luận vé", async () => {
    const user = userEvent.setup();
    renderScan();

    await user.type(screen.getByLabelText("Dán nội dung mã QR"), "mock-down");
    await user.click(screen.getByRole("button", { name: "Soát vé" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Dịch vụ không phản hồi");
  });
});
