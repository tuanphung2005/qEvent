import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ComponentType, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { attendeeUser } from "../../../test/msw/fixtures";
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

let RequireRole: ComponentType<{ children: ReactNode }>;
let AuthProvider: ComponentType<{ children: ReactNode }>;
let readToken: typeof import("../../lib/api/token").readToken;
let writeToken: typeof import("../../lib/api/token").writeToken;
let clearToken: typeof import("../../lib/api/token").clearToken;

beforeAll(async () => {
  globalThis.Request = RelativeRequest as typeof Request;
  ({ RequireRole } = await import("../RequireRole"));
  ({ AuthProvider } = await import("../../features/auth/auth-context"));
  ({ readToken, writeToken, clearToken } = await import("../../lib/api/token"));
});

afterAll(() => {
  globalThis.Request = NativeRequest;
});

afterEach(() => {
  clearToken();
});

function renderRestricted() {
  writeToken("attendee-token");
  server.use(http.get("/api/auth/me", () => HttpResponse.json({ user: attendeeUser })));

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/restricted"]}>
          <Routes>
            <Route
              path="/restricted"
              element={
                <RequireRole>
                  <div>bảng điều khiển</div>
                </RequireRole>
              }
            />
            <Route path="/login" element={<div>form đăng nhập</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("ForbiddenScreen", () => {
  it("đăng xuất thì xoá token và về trang đăng nhập", async () => {
    renderRestricted();
    expect(await screen.findByText("Không có quyền truy cập")).toBeInTheDocument();
    expect(readToken()).toBe("attendee-token");

    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

    expect(await screen.findByText("form đăng nhập")).toBeInTheDocument();
    // Without this the next `/login` load still sees a session and bounces back.
    expect(readToken()).toBeNull();
  });
});
