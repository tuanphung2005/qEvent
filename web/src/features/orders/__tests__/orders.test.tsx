import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventFixture, orderFixture } from "../../../../test/msw/fixtures";
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

let OrdersPage: ComponentType;

beforeAll(async () => {
  globalThis.Request = RelativeRequest as typeof Request;
  ({ OrdersPage } = await import("../pages/OrdersPage"));
});

afterAll(() => {
  globalThis.Request = NativeRequest;
});

function renderOrders() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/orders?eventId=${eventFixture.id}`]}>
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrdersPage", () => {
  it("hiển thị đơn trả về từ API", async () => {
    renderOrders();

    expect(await screen.findByRole("table", { name: "Danh sách đơn hàng" })).toBeInTheDocument();
    expect(await screen.findByText("1.000.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("Đang xử lý")).toBeInTheDocument();
  });

  it("hiện empty state dạy cách dùng khi không có đơn", async () => {
    server.use(http.get("/api/orders", () => HttpResponse.json({ orders: [], nextCursor: null })));
    renderOrders();

    expect(await screen.findByText("Chưa có đơn hàng để hiển thị")).toBeInTheDocument();
    expect(screen.getByText(/Đơn hàng xuất hiện ở đây ngay khi khách đặt vé/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("gõ tìm kiếm chỉ gọi API một lần sau debounce 300ms", async () => {
    const queries: Array<string | null> = [];
    server.use(
      http.get("/api/orders", ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("q"));
        return HttpResponse.json({ orders: [orderFixture], nextCursor: null });
      }),
    );
    renderOrders();
    await screen.findByText("Nguyễn Văn An");

    const user = userEvent.setup({ delay: 40 });
    await user.type(screen.getByLabelText("Tìm đơn hàng"), "abc");

    await waitFor(() => expect(queries).toContain("abc"), { timeout: 2000 });
    expect(queries.filter((query) => query === "abc")).toHaveLength(1);
    expect(queries).not.toContain("a");
    expect(queries).not.toContain("ab");
  });
});
