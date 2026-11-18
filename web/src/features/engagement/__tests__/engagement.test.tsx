import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor(_url: string) {
    setTimeout(() => this.onopen?.(), 10);
  }
  send(_data: unknown) {}
  close() {
    this.onclose?.();
  }
}

let EngagementShell: ComponentType;
let QaPage: ComponentType;
let PollsPage: ComponentType;
let QuizPage: ComponentType;
let AuthProvider: ComponentType<{ children: React.ReactNode }>;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded in beforeAll to preserve Request patch
let QueryClientProvider: ComponentType<{ client: any; children: React.ReactNode }>;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let createQueryClient: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let eventFixture: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let organizer: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let sessionFixture: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let render: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let screen: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let waitFor: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let userEvent: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let cleanup: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let server: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let http: any;
// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded
let HttpResponse: any;

beforeAll(async () => {
  Object.defineProperty(globalThis, "Request", {
    value: RelativeRequest,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "WebSocket", {
    value: MockWebSocket,
    configurable: true,
    writable: true,
  });

  const mswMod = await import("msw");
  http = mswMod.http;
  HttpResponse = mswMod.HttpResponse;

  const testLib = await import("@testing-library/react");
  render = testLib.render;
  screen = testLib.screen;
  waitFor = testLib.waitFor;
  cleanup = testLib.cleanup;

  const userLib = await import("@testing-library/user-event");
  userEvent = userLib.default;

  const tokenMod = await import("@/lib/api/token");
  tokenMod.writeToken("test-staff-token");

  const qcMod = await import("@/lib/query/client");
  createQueryClient = qcMod.createQueryClient;

  const tqMod = await import("@tanstack/react-query");
  QueryClientProvider = tqMod.QueryClientProvider;

  const authMod = await import("@/features/auth/auth-context");
  AuthProvider = authMod.AuthProvider;

  const fixtures = await import("../../../../test/msw/fixtures");
  eventFixture = fixtures.eventFixture;
  organizer = fixtures.organizer;
  sessionFixture = fixtures.sessionFixture;

  const serverMod = await import("../../../../test/msw/server");
  server = serverMod.server;

  const shellMod = await import("../pages/EngagementShell");
  EngagementShell = shellMod.EngagementShell;

  const qaMod = await import("../pages/QaPage");
  QaPage = qaMod.QaPage;

  const pollsMod = await import("../pages/PollsPage");
  PollsPage = pollsMod.PollsPage;

  const quizMod = await import("../pages/QuizPage");
  QuizPage = quizMod.QuizPage;
});

afterAll(() => {
  globalThis.Request = NativeRequest;
});

afterEach(() => {
  cleanup?.();
});

function createTestClient() {
  const qc = createQueryClient();
  qc.setQueryData(["events", "list", {}], { events: [eventFixture] });
  qc.setQueryData(["me"], { user: organizer });
  return qc;
}

function renderQa(sessionId = sessionFixture.id) {
  return render(
    <QueryClientProvider client={createTestClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/engagement/${sessionId}/qa?eventId=${eventFixture.id}`]}>
          <Routes>
            <Route path="/engagement/:sessionId" element={<EngagementShell />}>
              <Route index element={<QaPage />} />
              <Route path="qa" element={<QaPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function renderPolls(sessionId = sessionFixture.id) {
  return render(
    <QueryClientProvider client={createTestClient()}>
      <AuthProvider>
        <MemoryRouter
          initialEntries={[`/engagement/${sessionId}/polls?eventId=${eventFixture.id}`]}
        >
          <Routes>
            <Route path="/engagement/:sessionId" element={<EngagementShell />}>
              <Route path="polls" element={<PollsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function renderQuiz(sessionId = sessionFixture.id) {
  return render(
    <QueryClientProvider client={createTestClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/engagement/${sessionId}/quiz?eventId=${eventFixture.id}`]}>
          <Routes>
            <Route path="/engagement/:sessionId" element={<EngagementShell />}>
              <Route path="quiz" element={<QuizPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("Q&A Feature (G2)", () => {
  it("hien thi danh sach cau hoi Q&A tu API sap xep theo upvote", async () => {
    renderQa();

    expect(await screen.findByText(/WebSocket/)).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText(/Circuit Breaker/)).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("cho phep toggle upvote cau hoi", async () => {
    const user = userEvent.setup();
    renderQa();

    const upvoteButton = await screen.findByRole("button", {
      name: /15/,
    });
    expect(upvoteButton).toBeInTheDocument();

    await user.click(upvoteButton);
    expect(await screen.findByText("16")).toBeInTheDocument();
  });

  it("cho phep sua noi dung cau hoi", async () => {
    const user = userEvent.setup();
    renderQa();

    await screen.findByText(/WebSocket/);
    const editButtons = await screen.findAllByRole("button", { name: "Sửa câu hỏi" });
    await user.click(editButtons[0]);

    const field = await screen.findByRole("textbox", { name: "Nội dung câu hỏi" });
    await user.clear(field);
    await user.type(field, "Câu hỏi đã sửa");
    await user.click(screen.getByRole("button", { name: "Lưu câu hỏi" }));

    expect(await screen.findByText("Câu hỏi đã sửa")).toBeInTheDocument();
  });

  it("hien thi empty state khi khong co cau hoi nao", async () => {
    server.use(
      http.get("/api/sessions/:sessionId/questions", () =>
        HttpResponse.json({ sessionId: sessionFixture.id, questions: [] }),
      ),
    );
    renderQa();

    expect(await screen.findByText(/câu hỏi nào/)).toBeInTheDocument();
  });
});

describe("Polls Feature (G3)", () => {
  it("hien thi danh sach khao sat va ty le binh chon", async () => {
    renderPolls();

    expect(await screen.findByText(/nội dung bài diễn thuyết/)).toBeInTheDocument();
    expect(screen.getByText(/xuất sắc/)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("cho phep dong mo khao sat", async () => {
    const user = userEvent.setup();
    renderPolls();

    const toggleButton = await screen.findByRole("button", { name: /Đóng/ });
    expect(toggleButton).toBeInTheDocument();

    await user.click(toggleButton);
    expect(await screen.findByRole("button", { name: /Mở lại/ })).toBeInTheDocument();
  });

  it("cho phep sua va xoa khao sat", async () => {
    const user = userEvent.setup();
    renderPolls();

    await screen.findByText(/nội dung bài diễn thuyết/);
    await user.click(screen.getByRole("button", { name: "Sửa" }));

    const title = await screen.findByRole("textbox", { name: "Nội dung khảo sát" });
    await user.clear(title);
    await user.type(title, "Khảo sát đã sửa");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(await screen.findByText("Khảo sát đã sửa")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Xoá khảo sát/ }));
    await user.click(await screen.findByRole("button", { name: "Xoá khảo sát" }));

    await waitFor(() => expect(screen.queryByText("Khảo sát đã sửa")).toBeNull());
  });
});

describe("Quiz Game Feature (G4)", () => {
  it("hien thi Quiz Game dang o trang thai WAITING va danh sach cau hoi", async () => {
    const { container } = renderQuiz();

    await waitFor(
      () => {
        expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
      },
      { timeout: 4000 },
    );

    expect(screen.getByText(/Trò chơi Trắc nghiệm/)).toBeInTheDocument();
    expect(screen.getByText(/chuẩn bị/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Bắt đầu Game" })[0]).toBeInTheDocument();
    expect(screen.getByText("Bảng xếp hạng trực tiếp")).toBeInTheDocument();
  });

  it("thuc hien luong bat dau game", async () => {
    const user = userEvent.setup();
    const { container } = renderQuiz();

    await waitFor(
      () => {
        expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
      },
      { timeout: 4000 },
    );

    const startButtons = screen.getAllByRole("button", { name: "Bắt đầu Game" });
    await user.click(startButtons[0]);

    expect(await screen.findByText(/trả lời/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Công bố/ })).toBeInTheDocument();
  });
});
