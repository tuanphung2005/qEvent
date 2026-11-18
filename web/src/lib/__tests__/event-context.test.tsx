import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Link, MemoryRouter, Route, Routes, useSearchParams } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eventFixture } from "../../../test/msw/fixtures";
import { server } from "../../../test/msw/server";

// Same reason as the page tests: openapi-fetch captures Request at module load.
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

const otherEvent = { ...eventFixture, id: "7c1e9a3d-0000-4000-8000-000000000002", name: "Khác" };

let useEventContext: typeof import("../event-context").useEventContext;

beforeAll(async () => {
  globalThis.Request = RelativeRequest as typeof Request;
  ({ useEventContext } = await import("../event-context"));
});

afterAll(() => {
  globalThis.Request = NativeRequest;
});

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get("/api/events", () => HttpResponse.json({ events: [eventFixture, otherEvent] })),
  );
});

function Probe({ id }: { id: string }) {
  const { eventId } = useEventContext();
  return <div data-testid={id}>{eventId ?? "none"}</div>;
}

function Url() {
  const [params] = useSearchParams();
  return <div data-testid="url">{params.toString()}</div>;
}

/** AppShell stays mounted across tabs; pages mount and unmount. Tabs drop the query string. */
function Harness() {
  const { events, setEventId } = useEventContext();
  return (
    <div>
      <Probe id="shell" />
      <Url />
      {events.map((event) => (
        <button key={event.id} type="button" onClick={() => setEventId(event.id)}>
          {event.name}
        </button>
      ))}
      <Link to="/tab">sang tab</Link>
      <Routes>
        <Route path="/home" element={<Probe id="page" />} />
        <Route path="/tab" element={<Probe id="page" />} />
      </Routes>
    </div>
  );
}

function renderAt(entry: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("useEventContext", () => {
  it("giữ sự kiện đã chọn khi đổi tab", async () => {
    renderAt("/home");
    fireEvent.click(await screen.findByRole("button", { name: otherEvent.name }));
    expect(screen.getByTestId("shell")).toHaveTextContent(otherEvent.id);

    fireEvent.click(screen.getByRole("link", { name: "sang tab" }));

    // The shell that was already mounted and the fresh page must agree.
    expect(screen.getByTestId("shell")).toHaveTextContent(otherEvent.id);
    expect(screen.getByTestId("page")).toHaveTextContent(otherEvent.id);
    expect(screen.getByTestId("url")).toHaveTextContent(`eventId=${otherEvent.id}`);
  });

  it("giữ sự kiện từ link chia sẻ khi đổi tab", async () => {
    renderAt(`/home?eventId=${otherEvent.id}`);
    await screen.findByRole("button", { name: otherEvent.name });
    expect(screen.getByTestId("shell")).toHaveTextContent(otherEvent.id);

    fireEvent.click(screen.getByRole("link", { name: "sang tab" }));

    expect(screen.getByTestId("shell")).toHaveTextContent(otherEvent.id);
    expect(screen.getByTestId("page")).toHaveTextContent(otherEvent.id);
    expect(screen.getByTestId("url")).toHaveTextContent(`eventId=${otherEvent.id}`);
  });

  it("bỏ qua sự kiện đã lưu khi sự kiện đó không còn trong danh sách", async () => {
    server.use(http.get("/api/events", () => HttpResponse.json({ events: [eventFixture] })));
    localStorage.setItem("qevent.defaultEventId", otherEvent.id);
    renderAt("/home");
    await screen.findByRole("button", { name: eventFixture.name });

    expect(screen.getByTestId("shell")).toHaveTextContent("none");
    expect(screen.getByTestId("page")).toHaveTextContent("none");
  });
});
