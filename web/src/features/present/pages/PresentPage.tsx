import "@fontsource-variable/geist";
import { ForbiddenScreen } from "@/app/RequireRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import {
  useEndGame,
  useGameLeaderboard,
  useNextGameQuestion,
  usePolls,
  useQuestions,
  useRestartGame,
  useRevealGameAnswer,
  useSessionGame,
  useStartGame,
  useUpdateGameDisplay,
  useUpdatePoll,
} from "@/features/engagement/api";
import type { Poll } from "@/features/engagement/types";
import { readDefaultEventId, useEvents } from "@/lib/event-context";
import { useRealtime } from "@/lib/realtime/useRealtime";
import { routes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  Maximize2,
  Minimize2,
  Moon,
  Play,
  SlidersHorizontal,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  ACCENT_VAR,
  FONT_PX,
  type PresentAccent,
  type PresentFont,
  type PresentSettings,
  type PresentTheme,
  defaultPresentSettings,
  readPresentSettings,
  writePresentSettings,
} from "../present-settings";
import { secondsLeft } from "../present-utils";

type SlideKind = "cover" | "qa" | "poll" | "quiz" | "leaderboard";

type Slide = {
  key: string;
  label: string;
  kind: SlideKind;
  poll?: Poll;
};

const THEMES: Array<{ value: PresentTheme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
];

const FONTS: Array<{ value: PresentFont; label: string }> = [
  { value: "standard", label: "Chuẩn" },
  { value: "large", label: "Lớn" },
  { value: "huge", label: "Rất lớn" },
];

const ACCENTS: Array<{ value: PresentAccent; label: string }> = [
  { value: "primary", label: "Xanh dương" },
  { value: "success", label: "Xanh lá" },
  { value: "warning", label: "Hổ phách" },
];

function EmptySlide({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <p className="text-[1.6em] font-semibold">{title}</p>
      <p className="max-w-xl text-[0.95em] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function PresentPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { user, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: eventsData, isLoading: eventsLoading } = useEvents();

  const [settings, setSettings] = useState<PresentSettings>(readPresentSettings);
  const [slideKey, setSlideKey] = useState("cover");
  const [panelOpen, setPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const pairs = useMemo(
    () =>
      (eventsData?.events ?? []).flatMap((event) =>
        event.sessions.map((session) => ({ event, session })),
      ),
    [eventsData],
  );
  const requested = sessionId ? pairs.find((pair) => pair.session.id === sessionId) : undefined;
  // The console's event picker is the default; otherwise prefer a live session.
  const defaultEventId = readDefaultEventId();
  const defaultPair = defaultEventId
    ? (pairs.find((pair) => pair.event.id === defaultEventId && pair.session.isLive) ??
      pairs.find((pair) => pair.event.id === defaultEventId))
    : undefined;
  const fallback = defaultPair ?? pairs.find((pair) => pair.session.isLive) ?? pairs[0];
  const active = sessionId ? (requested ?? null) : (fallback ?? null);
  const activeId = active?.session.id;

  // The bare /present URL picks the live session once; the id then stays on screen.
  useEffect(() => {
    if (!sessionId && fallback) {
      navigate(routes.present(fallback.session.id), { replace: true });
    }
  }, [sessionId, fallback, navigate]);

  useEffect(() => {
    writePresentSettings(settings);
  }, [settings]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const update = (patch: Partial<PresentSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  const toggleTheme = () => update({ theme: settings.theme === "dark" ? "light" : "dark" });

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Browsers refuse fullscreen outside a user gesture; the screen stays usable.
    }
  }, []);

  const queryClient = useQueryClient();
  const invalidateEngagement = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["engagement"] });
    queryClient.invalidateQueries({ queryKey: ["game"] });
  }, [queryClient]);

  const qaRealtime = useRealtime(activeId ? { channel: "qa", sessionId: activeId } : null, {
    onMessage: invalidateEngagement,
    onReconnect: invalidateEngagement,
  });
  const realtimeDown = qaRealtime.status === "fallback" || qaRealtime.status === "offline";
  const polling = realtimeDown ? 5000 : false;

  const questionsQuery = useQuestions(activeId, polling);
  const pollsQuery = usePolls(activeId, polling);
  const gameQuery = useSessionGame(activeId, polling);
  const game = gameQuery.data?.game ?? null;
  useRealtime(game ? { channel: "game", gameId: game.id } : null, {
    onMessage: invalidateEngagement,
    onReconnect: invalidateEngagement,
  });
  const leaderboardQuery = useGameLeaderboard(game?.id, polling);

  const questions = useMemo(
    () =>
      [...(questionsQuery.data?.questions ?? [])].sort((a, b) => {
        if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [questionsQuery.data],
  );
  const polls = useMemo(() => pollsQuery.data?.polls ?? [], [pollsQuery.data]);
  const leaderboard = leaderboardQuery.data?.leaderboard ?? [];

  const updatePoll = useUpdatePoll(activeId ?? "");
  const startGame = useStartGame(activeId ?? "");
  const updateDisplay = useUpdateGameDisplay(activeId ?? "", game?.id ?? "");
  const revealAnswer = useRevealGameAnswer(activeId ?? "");
  const nextQuestion = useNextGameQuestion(activeId ?? "");
  const endGame = useEndGame(activeId ?? "");
  const restartGame = useRestartGame(activeId ?? "");

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [
      { key: "cover", label: "Mở đầu", kind: "cover" },
      { key: "qa", label: "Hỏi & Đáp", kind: "qa" },
    ];
    if (polls.length === 0) {
      list.push({ key: "polls-empty", label: "Bình chọn", kind: "poll" });
    } else {
      for (const poll of polls) {
        list.push({ key: `poll:${poll.id}`, label: poll.title, kind: "poll", poll });
      }
    }
    list.push({ key: "quiz", label: "Quiz", kind: "quiz" });
    list.push({ key: "leaderboard", label: "Xếp hạng", kind: "leaderboard" });
    return list;
  }, [polls]);

  const foundIndex = slides.findIndex((slide) => slide.key === slideKey);
  const slideIndex = foundIndex >= 0 ? foundIndex : 0;
  const slide = slides[slideIndex];

  useEffect(() => {
    if (foundIndex < 0) setSlideKey("cover");
  }, [foundIndex]);

  const goTo = useCallback(
    (index: number) => {
      const target = slides[(index + slides.length) % slides.length];
      if (target) setSlideKey(target.key);
    },
    [slides],
  );
  const next = useCallback(() => goTo(slideIndex + 1), [goTo, slideIndex]);
  const previous = useCallback(() => goTo(slideIndex - 1), [goTo, slideIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      // Let form controls and focused buttons handle Space/Enter themselves.
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (target?.closest("button, a") && (event.key === " " || event.key === "Enter")) return;

      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        previous();
      } else if (event.key === "f" || event.key === "F") {
        void toggleFullscreen();
      } else if (event.key === "l" || event.key === "L") {
        update({ showLogo: !settings.showLogo });
      } else if (event.key === "t" || event.key === "T") {
        toggleTheme();
      } else if (event.key === "Escape") {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (game?.status !== "QUESTION_ACTIVE") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [game?.status]);

  if (status === "loading" || eventsLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </main>
    );
  }

  if (status === "anonymous") {
    return (
      <Navigate to={routes.login()} replace state={{ from: location.pathname + location.search }} />
    );
  }

  if (user?.role !== "HOST" && user?.role !== "ORGANIZER") {
    return <ForbiddenScreen />;
  }

  if (!active) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="max-w-[560px] text-center">
          <p className="text-display text-foreground">
            {sessionId ? "Không tìm thấy phiên" : "Chưa có phiên để trình chiếu"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {sessionId
              ? "Phiên này không tồn tại hoặc đã bị xoá. Chọn một phiên khác của sự kiện."
              : "Sự kiện chưa có phiên thuyết trình. Tạo phiên trong mục Quản lý sự kiện trước."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild variant="secondary">
              <Link to={routes.present()}>Về màn trình chiếu</Link>
            </Button>
            <Button asChild>
              <Link to={routes.dashboard()}>Về console</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const session = active.session;
  const event = active.event;
  const currentQuestion = game?.questions?.[game.currentQuestionIndex ?? 0] ?? null;
  const revealed = game?.status === "ROUND_REVEALED";
  const remaining = secondsLeft(
    currentQuestion?.questionStartedAt,
    currentQuestion?.timeLimitSec,
    now,
  );
  const accent = ACCENT_VAR[settings.accent];
  const dark = settings.theme === "dark";
  const questionLimit = currentQuestion?.timeLimitSec ?? 30;
  const timeRatio = remaining === null ? 1 : remaining / questionLimit;
  const realtimeLabel = realtimeDown
    ? "Polling"
    : qaRealtime.status === "open"
      ? "Trực tiếp"
      : "Đang kết nối";

  const pollTarget = polls[0] ? `poll:${polls[0].id}` : "polls-empty";
  const activeGroup =
    slide.key.startsWith("poll:") || slide.key === "polls-empty" ? pollTarget : slide.key;
  const groups: Array<{ key: string; label: string }> = [
    { key: "cover", label: "Mở đầu" },
    { key: "qa", label: "Hỏi đáp" },
    { key: pollTarget, label: "Bình chọn" },
    { key: "quiz", label: "Quiz" },
    { key: "leaderboard", label: "Xếp hạng" },
  ];

  const togglePoll = () => {
    const poll = slide.poll;
    if (!poll) return;
    updatePoll.mutate(
      { pollId: poll.id, isActive: !poll.isActive },
      {
        onSuccess: () => toast.success(poll.isActive ? "Đã đóng bình chọn" : "Đã mở bình chọn"),
        onError: () => toast.error("Không đổi được trạng thái bình chọn"),
      },
    );
  };

  const quizControls = game ? (
    <>
      {game.status === "WAITING" ? (
        <Button
          size="sm"
          disabled={startGame.isPending || (game.questions?.length ?? 0) === 0}
          onClick={() =>
            startGame.mutate(game.id, {
              onSuccess: () => toast.success("Đã bắt đầu quiz"),
              onError: () => toast.error("Không bắt đầu được quiz"),
            })
          }
        >
          <Play className="size-4" />
          Bắt đầu
        </Button>
      ) : null}
      {game.status === "QUESTION_ACTIVE" ? (
        <Button
          size="sm"
          disabled={revealAnswer.isPending}
          onClick={() =>
            revealAnswer.mutate(game.id, {
              onSuccess: () => toast.success("Đã công bố đáp án"),
              onError: () => toast.error("Không công bố được đáp án"),
            })
          }
        >
          <Eye className="size-4" />
          Công bố đáp án
        </Button>
      ) : null}
      {game.status === "ROUND_REVEALED" ? (
        <>
          <Button
            size="sm"
            disabled={nextQuestion.isPending}
            onClick={() =>
              nextQuestion.mutate(game.id, {
                onSuccess: () => toast.success("Đã sang câu tiếp theo"),
                onError: () => toast.error("Không chuyển được câu"),
              })
            }
          >
            <ChevronRight className="size-4" />
            Câu tiếp
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={endGame.isPending}
            onClick={() =>
              endGame.mutate(game.id, {
                onSuccess: () => toast.success("Đã kết thúc quiz"),
                onError: () => toast.error("Không kết thúc được quiz"),
              })
            }
          >
            Kết thúc
          </Button>
        </>
      ) : null}
      {game.status === "FINISHED" ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={restartGame.isPending || startGame.isPending}
          onClick={() =>
            restartGame.mutate(game.id, {
              onSuccess: () => startGame.mutate(game.id),
              onError: () => toast.error("Không chơi lại được quiz"),
            })
          }
        >
          Chơi lại
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <main
      className={`${dark ? "present-dark" : ""} relative flex min-h-dvh flex-col bg-background text-foreground`}
      style={{
        fontSize: FONT_PX[settings.font],
        fontFamily: '"Geist Variable", system-ui, Roboto, sans-serif',
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <header className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm md:px-6">
        <div className="min-w-0">
          <Select value={session.id} onValueChange={(id) => navigate(routes.present(id))}>
            <SelectTrigger
              aria-label="Chọn phiên trình chiếu"
              className="h-7 w-fit max-w-[360px] border-0 bg-transparent px-0 text-sm font-semibold shadow-none hover:text-primary"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[360px]">
              {Array.from(new Map(pairs.map((pair) => [pair.event.id, pair.event])).values()).map(
                (eventOption) => {
                  const eventPairs = pairs.filter((pair) => pair.event.id === eventOption.id);
                  if (eventPairs.length === 0) return null;
                  return (
                    <SelectGroup key={eventOption.id}>
                      <SelectLabel>{eventOption.name}</SelectLabel>
                      {eventPairs.map((pair) => (
                        <SelectItem key={pair.session.id} value={pair.session.id}>
                          {pair.session.title}
                          {pair.session.isLive ? " · LIVE" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                },
              )}
            </SelectContent>
          </Select>
          <p className="truncate text-xs text-muted-foreground">
            {event.name} · {session.speaker}
          </p>
        </div>

        <nav aria-label="Chuyển slide" className="ml-auto flex flex-wrap items-center gap-1">
          {groups.map((group) => {
            const active = activeGroup === group.key;
            return (
              <button
                key={group.key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setSlideKey(group.key)}
                className={`relative rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {group.label}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full transition-opacity"
                  style={{ backgroundColor: active ? accent : "transparent" }}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Badge
            variant="secondary"
            className={session.isLive ? "bg-success-subtle text-success" : "text-muted-foreground"}
          >
            {session.isLive ? (
              <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
            ) : null}
            {session.isLive ? "LIVE" : "Sắp diễn ra"}
          </Badge>
          <Badge
            variant="secondary"
            className={realtimeDown ? "text-warning" : "text-muted-foreground"}
            title={
              realtimeDown ? "Đang dùng chế độ làm mới định kỳ" : "Đang nhận cập nhật trực tiếp"
            }
          >
            {realtimeDown ? "Polling" : realtimeLabel}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Tuỳ chỉnh trình chiếu"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            <SlidersHorizontal />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Thoát trình chiếu" asChild>
            <Link to={routes.engagement(session.id)}>
              <X />
            </Link>
          </Button>
        </div>
      </header>

      <div className="h-0.5 w-full overflow-hidden bg-card-border">
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{
            width: `${((slideIndex + 1) / slides.length) * 100}%`,
            backgroundColor: accent,
          }}
        />
      </div>

      {panelOpen ? (
        <aside
          aria-label="Tuỳ chỉnh trình chiếu"
          className="absolute top-16 right-4 z-30 w-[300px] rounded-xl border border-card-border bg-card p-4 shadow-float"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Tuỳ chỉnh</p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Đóng tuỳ chỉnh"
              onClick={() => setPanelOpen(false)}
            >
              <X />
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Nền</p>
              <div className="flex gap-1">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={settings.theme === value ? "default" : "secondary"}
                    aria-pressed={settings.theme === value}
                    onClick={() => update({ theme: value })}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-muted-foreground">Cỡ chữ</p>
              <div className="flex gap-1">
                {FONTS.map(({ value, label }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={settings.font === value ? "default" : "secondary"}
                    aria-pressed={settings.font === value}
                    onClick={() => update({ font: value })}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-muted-foreground">Màu nhấn</p>
              <div className="flex gap-1">
                {ACCENTS.map(({ value, label }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={settings.accent === value ? "default" : "secondary"}
                    aria-pressed={settings.accent === value}
                    onClick={() => update({ accent: value })}
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full"
                      style={{ backgroundColor: ACCENT_VAR[value] }}
                    />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2">
              <span>Logo qEvent góc phải</span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={settings.showLogo}
                onChange={(event) => update({ showLogo: event.target.checked })}
              />
            </label>

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setSettings(defaultPresentSettings)}
            >
              Khôi phục mặc định
            </Button>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to={routes.engagement(session.id)}>Sửa Q&amp;A / bình chọn / quiz</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Phím tắt: ← → đổi slide · F toàn màn hình · L logo · T nền sáng/tối
          </p>
        </aside>
      ) : null}

      <section
        aria-live="polite"
        className="flex flex-1 flex-col overflow-y-auto px-6 py-8 md:px-12 md:py-10"
      >
        <div
          key={slide.key}
          className="present-slide mx-auto flex w-full max-w-[1180px] flex-1 flex-col"
        >
          {slide.kind === "cover" ? (
            <div className="flex flex-1 flex-col justify-center gap-5">
              <h1 className="max-w-[24ch] text-[3.4em] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
                {session.title}
              </h1>
              <div className="space-y-1">
                <p className="text-[1.3em]">{session.speaker}</p>
                <p className="text-[0.9em] text-muted-foreground">
                  {event.name} · {event.venue}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={session.isLive ? "bg-success-subtle text-success" : ""}
                >
                  {session.isLive ? (
                    <span
                      className="size-1.5 animate-pulse rounded-full bg-success"
                      aria-hidden="true"
                    />
                  ) : null}
                  {session.isLive ? "LIVE" : "Sắp bắt đầu"}
                </Badge>
                <span className="text-[0.8em] text-muted-foreground">
                  {questions.length} câu hỏi · {polls.length} bình chọn
                </span>
              </div>
            </div>
          ) : null}

          {slide.kind === "qa" ? (
            <div className="flex flex-1 flex-col">
              <div className="mb-6 flex items-center gap-3">
                <HelpCircle className="size-[1.4em]" style={{ color: accent }} />
                <h2 className="text-[2em] font-semibold tracking-[-0.02em]">Câu hỏi từ khán giả</h2>
                <Badge variant="secondary" className="ml-auto text-[0.75em]">
                  {questions.length} câu hỏi
                </Badge>
              </div>
              {questions.length === 0 ? (
                <EmptySlide
                  title="Chưa có câu hỏi"
                  hint="Khán giả gửi câu hỏi trong phiên; câu hỏi nhiều bình chọn nhất sẽ ở đầu."
                />
              ) : (
                <ol className="border-y border-card-border">
                  {questions.slice(0, 7).map((question, index) => (
                    <li
                      key={question.id}
                      className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-4 border-b border-card-border py-4 last:border-b-0"
                    >
                      <span className="text-[1.35em] font-semibold text-muted-foreground tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="text-[1.2em] leading-snug text-balance">{question.content}</p>
                      <span
                        className="mt-1 shrink-0 rounded-md px-2.5 py-1 text-[0.78em] font-semibold"
                        style={{ color: accent, backgroundColor: "var(--accent)" }}
                      >
                        ▲ {question.upvotes}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}

          {slide.kind === "poll" ? (
            slide.poll ? (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mb-3 flex items-center gap-3">
                  <Activity className="size-[1.4em]" style={{ color: accent }} />
                  <Badge variant="secondary" className="text-[0.75em]">
                    {slide.poll.isActive ? "Đang mở" : "Đã đóng"}
                  </Badge>
                </div>
                <h2 className="mb-2 max-w-[26ch] text-[2.6em] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">
                  {slide.poll.title}
                </h2>
                <p className="mb-10 text-[0.9em] text-muted-foreground">
                  {slide.poll.options.reduce((sum, option) => sum + option.voteCount, 0)} lượt bình
                  chọn
                </p>
                <PollBars poll={slide.poll} accent={accent} />
              </div>
            ) : (
              <EmptySlide
                title="Chưa có bình chọn"
                hint="Tạo khảo sát trong mục Tương tác để chiếu kết quả trực tiếp tại đây."
              />
            )
          ) : null}

          {slide.kind === "quiz" ? (
            game && currentQuestion ? (
              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="text-[0.85em] font-medium text-muted-foreground">
                    Câu {game.currentQuestionIndex + 1} / {game.questions?.length ?? 0}
                  </span>
                  {game.status === "QUESTION_ACTIVE" ? (
                    <Badge variant="secondary" className="bg-warning-subtle text-warning">
                      Đang trả lời
                    </Badge>
                  ) : null}
                  {revealed ? (
                    <Badge variant="secondary" className="bg-success-subtle text-success">
                      Đã công bố đáp án
                    </Badge>
                  ) : null}
                  {game.status === "FINISHED" ? <Badge variant="outline">Đã kết thúc</Badge> : null}
                  <span
                    className={`ml-auto rounded-md px-2 py-1 text-[1.1em] font-semibold tabular-nums ${
                      remaining !== null && remaining <= 5
                        ? "bg-destructive-subtle text-destructive animate-pulse"
                        : ""
                    }`}
                  >
                    {remaining !== null ? `${remaining}s` : `${questionLimit}s`}
                  </span>
                </div>
                <div className="mb-6 h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                    style={{
                      width: `${Math.max(0, Math.min(100, timeRatio * 100))}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
                <h2 className="mb-8 max-w-[30ch] text-[2.4em] leading-[1.12] font-semibold tracking-[-0.025em] text-balance">
                  {currentQuestion.content}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {currentQuestion.options.map((option, index) => {
                    const correct = revealed && currentQuestion.correctOption === index;
                    return (
                      <div
                        key={`${currentQuestion.id}-${index}`}
                        className={`flex items-center gap-3 rounded-lg border p-4 text-[1.12em] ${
                          correct
                            ? "border-success bg-success-subtle font-semibold text-success"
                            : "border-card-border bg-card"
                        }`}
                      >
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-md text-[0.8em] font-semibold"
                          style={
                            correct
                              ? undefined
                              : { color: accent, backgroundColor: "var(--accent)" }
                          }
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="flex-1">{option}</span>
                        {correct ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptySlide
                title={game ? "Quiz chưa có câu hỏi" : "Chưa có quiz"}
                hint={
                  game
                    ? "Thêm câu hỏi trong mục Tương tác → Quiz trước khi bắt đầu."
                    : "Khởi tạo quiz trong mục Tương tác → Quiz để trình chiếu tại đây."
                }
              />
            )
          ) : null}

          {slide.kind === "leaderboard" ? (
            <div className="flex flex-1 flex-col justify-center">
              <div className="mb-6 flex items-center gap-3">
                <Trophy className="size-[1.4em]" style={{ color: accent }} />
                <h2 className="text-[2em] font-bold">Bảng xếp hạng</h2>
              </div>
              {leaderboard.length === 0 ? (
                <EmptySlide
                  title="Chưa có điểm"
                  hint="Khán giả trả lời đúng sẽ xuất hiện ở đây khi quiz bắt đầu."
                />
              ) : (
                <ol className="border-y border-card-border">
                  {leaderboard.slice(0, 7).map((entry) => (
                    <li
                      key={entry.userId}
                      className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-4 border-b border-card-border py-4 last:border-b-0"
                    >
                      <span
                        className="text-[1.5em] font-semibold tabular-nums"
                        style={{ color: entry.rank === 1 ? accent : "var(--muted-foreground)" }}
                      >
                        {String(entry.rank).padStart(2, "0")}
                      </span>
                      <span className="text-[1.15em]">
                        Người tham gia ···{entry.userId.slice(-6)}
                      </span>
                      <span className="text-[0.9em] text-muted-foreground">
                        {entry.correctCount} câu đúng
                      </span>
                      <span
                        className="text-[1.35em] font-semibold tabular-nums"
                        style={{ color: accent }}
                      >
                        {entry.totalScore}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-2 border-t border-card-border px-4 py-2 text-sm md:px-6">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {slides.map((item, index) => (
            <button
              key={item.key}
              type="button"
              aria-label={`Slide ${index + 1}: ${item.label}`}
              aria-current={index === slideIndex ? "true" : undefined}
              onClick={() => setSlideKey(item.key)}
              className={`h-2.5 shrink-0 rounded-full transition-all ${
                index === slideIndex ? "w-8" : "w-2.5 bg-border hover:bg-muted-foreground"
              }`}
              style={index === slideIndex ? { backgroundColor: accent } : undefined}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {slide.kind === "poll" && slide.poll ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={updatePoll.isPending}
              onClick={togglePoll}
            >
              {slide.poll.isActive ? "Đóng bình chọn" : "Mở bình chọn"}
            </Button>
          ) : null}
          {slide.kind === "quiz" && game ? (
            <div className="flex items-center gap-1 rounded-md bg-secondary p-0.5">
              <span className="px-1.5 text-xs text-muted-foreground">Điện thoại</span>
              <Button
                size="sm"
                variant={(game.displayMode ?? "FULL") === "FULL" ? "default" : "ghost"}
                aria-pressed={(game.displayMode ?? "FULL") === "FULL"}
                disabled={updateDisplay.isPending}
                onClick={() =>
                  updateDisplay.mutate("FULL", {
                    onSuccess: () => toast.success("Điện thoại hiện đầy đủ câu hỏi"),
                    onError: () => toast.error("Không đổi được chế độ hiển thị"),
                  })
                }
              >
                Đầy đủ
              </Button>
              <Button
                size="sm"
                variant={game.displayMode === "LETTERS" ? "default" : "ghost"}
                aria-pressed={game.displayMode === "LETTERS"}
                disabled={updateDisplay.isPending}
                onClick={() =>
                  updateDisplay.mutate("LETTERS", {
                    onSuccess: () => toast.success("Điện thoại chỉ hiện A B C D"),
                    onError: () => toast.error("Không đổi được chế độ hiển thị"),
                  })
                }
              >
                A B C D
              </Button>
            </div>
          ) : null}
          {slide.kind === "quiz" ? quizControls : null}

          <Button variant="secondary" size="icon" aria-label="Slide trước" onClick={previous}>
            <ChevronLeft />
          </Button>
          <span className="min-w-12 text-center text-xs text-muted-foreground tabular-nums">
            {slideIndex + 1} / {slides.length}
          </span>
          <Button variant="secondary" size="icon" aria-label="Slide sau" onClick={next}>
            <ChevronRight />
          </Button>
        </div>
      </footer>

      {settings.showLogo ? (
        <div
          data-testid="present-logo"
          className="pointer-events-none absolute right-6 bottom-16 flex items-center gap-2 opacity-80"
        >
          <img src="/icon-64.png" alt="" width={28} height={28} className="rounded-md" />
          <span className="text-sm font-semibold tracking-tight">qEvent</span>
        </div>
      ) : null}
    </main>
  );
}

function PollBars({ poll, accent }: { poll: Poll; accent: string }) {
  const total = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  return (
    <div className="space-y-5">
      {poll.options.map((option) => {
        const percent = total > 0 ? Math.round((option.voteCount / total) * 100) : 0;
        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <span className="text-[1.15em] font-medium">{option.content}</span>
              <span className="text-[1em] font-bold tabular-nums" style={{ color: accent }}>
                {percent}%
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${percent}%`, backgroundColor: accent }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
