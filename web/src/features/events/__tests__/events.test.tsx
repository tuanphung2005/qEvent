import { writeToken } from "@/lib/api/token";
import type { EventSummary } from "@/lib/api/types";
import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ComponentType, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eventFixture } from "../../../../test/msw/fixtures";
import { server } from "../../../../test/msw/server";

// The api client builds `new Request("/api/...")`; Node's Request needs an absolute
// URL and jsdom only supplies the origin. openapi-fetch captures Request at module
// load, so patch the global before importing the pages.
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

// Radix measures the checkbox with ResizeObserver, which jsdom does not ship.
class ResizeObserverStub {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

let EventsPage: ComponentType;
let EventNewPage: ComponentType;
let AuthProvider: ComponentType<{ children: ReactNode }>;

beforeAll(async () => {
  globalThis.Request = RelativeRequest as typeof Request;
  ({ AuthProvider } = await import("@/features/auth/auth-context"));
  ({ EventsPage } = await import("../pages/EventsPage"));
  ({ EventNewPage } = await import("../pages/EventNewPage"));
});

afterAll(() => {
  globalThis.Request = NativeRequest;
});

beforeEach(() => {
  writeToken("test-token");
});

function renderAt(path: string, element: ReactNode) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={element} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("EventsPage", () => {
  it("hiển thị sự kiện trả về từ API", async () => {
    renderAt("/events", <EventsPage />);

    expect(await screen.findByRole("table", { name: "Danh sách sự kiện" })).toBeInTheDocument();
    expect((await screen.findAllByText("Tech Summit Vietnam 2026")).length).toBeGreaterThan(0);
    expect(screen.getByText("Saigon Exhibition and Convention Center")).toBeInTheDocument();
  });

  it("hiện empty state dạy cách dùng khi chưa có sự kiện", async () => {
    server.use(http.get("/api/events", () => HttpResponse.json({ events: [] })));
    renderAt("/events", <EventsPage />);

    expect(await screen.findByText("Chưa có sự kiện nào")).toBeInTheDocument();
    expect(screen.getByText(/Tạo sự kiện đầu tiên/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lọc tại chỗ sau debounce 300ms, không gọi API mỗi ký tự", async () => {
    const second: EventSummary = {
      ...eventFixture,
      id: "7c1e9a3d-0000-4000-8000-000000000002",
      name: "Founder Night",
      venue: "Hanoi Opera House",
    };
    let calls = 0;
    server.use(
      http.get("/api/events", () => {
        calls += 1;
        return HttpResponse.json({ events: [eventFixture, second] });
      }),
    );
    renderAt("/events", <EventsPage />);
    await screen.findByRole("table", { name: "Danh sách sự kiện" });
    await screen.findByText("Tech Summit Vietnam 2026");

    const user = userEvent.setup({ delay: 40 });
    await user.type(screen.getByLabelText("Tìm sự kiện"), "founder");

    expect(await screen.findByText("Founder Night")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Tech Summit Vietnam 2026")).toBeNull(), {
      timeout: 2000,
    });
    // Filtering is client-side because GET /api/events has no query contract.
    expect(calls).toBe(1);
  });
});

describe("EventNewPage", () => {
  it("báo lỗi tại field khi submit form trống", async () => {
    renderAt("/events/new", <EventNewPage />);
    await screen.findByRole("heading", { name: "Tạo sự kiện" });

    await userEvent.setup().click(screen.getByRole("button", { name: "Tạo sự kiện" }));

    expect(await screen.findByText("Nhập tên sự kiện")).toBeInTheDocument();
    expect(screen.getByText("Nhập địa điểm")).toBeInTheDocument();
    expect(screen.getByText("Chọn giờ bắt đầu")).toBeInTheDocument();
  });

  it("thêm dòng phòng và phiên trong cùng form", async () => {
    renderAt("/events/new", <EventNewPage />);
    await screen.findByRole("heading", { name: "Tạo sự kiện" });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Thêm phòng" }));
    await user.click(screen.getByRole("button", { name: "Thêm phiên" }));

    expect(screen.getByLabelText("Tên phòng")).toBeInTheDocument();
    expect(screen.getByLabelText("Tiêu đề")).toBeInTheDocument();
    expect(screen.getByLabelText("Diễn giả")).toBeInTheDocument();
  });
});
