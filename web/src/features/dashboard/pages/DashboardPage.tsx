import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiError } from "@/lib/api/errors";
import { useEventContext } from "@/lib/event-context";
import { formatDateShort, formatRange } from "@/lib/format/date";
import { formatNumber, formatPercent } from "@/lib/format/money";
import { statusLabel } from "@/lib/format/status-label";
import { routes } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { pickSession, useCheckinStats, useEventDetail, useSessionStats } from "../api";

const CHART_CONFIG = {
  count: { label: "Đã soát", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    eventId,
    event: selectedEvent,
    events,
    setEventId,
    isLoading: eventsLoading,
  } = useEventContext();

  const detailQuery = useEventDetail(eventId);
  const event = detailQuery.data?.event ?? selectedEvent;
  const session = pickSession(event);

  const statsQuery = useCheckinStats(eventId);
  const sessionStatsQuery = useSessionStats(session?.id ?? null);

  if (!eventId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-display text-foreground">Tổng quan</h1>
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Chọn sự kiện để xem số liệu</EmptyTitle>
              <EmptyDescription>
                Số vé, lượt soát và hoạt động của phiên đang diễn ra đều tính theo sự kiện được
                chọn.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {events.length > 0 ? (
                <Select onValueChange={(value) => value && setEventId(value)}>
                  <SelectTrigger aria-label="Chọn sự kiện" className="h-11 w-[320px] bg-secondary">
                    <SelectValue placeholder="Chọn sự kiện" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : eventsLoading ? (
                <Skeleton className="h-11 w-[320px]" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có sự kiện nào. Tạo sự kiện trước khi xem số liệu.
                </p>
              )}
            </EmptyContent>
          </Empty>
        </Card>
      </div>
    );
  }

  const stats = statsQuery.data;
  const sessionStats = sessionStatsQuery.data;
  const failures = [
    detailQuery.isError ? `thông tin sự kiện (${toApiError(detailQuery.error).code})` : null,
    statsQuery.isError ? `số liệu soát vé (${toApiError(statsQuery.error).code})` : null,
    sessionStatsQuery.isError
      ? `dịch vụ tương tác (${toApiError(sessionStatsQuery.error).code})`
      : null,
  ].filter((item): item is string => item !== null);

  const retryFailed = () => {
    if (detailQuery.isError) void detailQuery.refetch();
    if (statsQuery.isError) void statsQuery.refetch();
    if (sessionStatsQuery.isError) void sessionStatsQuery.refetch();
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display text-foreground">Tổng quan</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="text-foreground">{event?.name ?? "Đang tải sự kiện…"}</span>
            {event ? <span>{event.venue}</span> : null}
            {event ? <span>{formatRange(event.startTime, event.endTime)}</span> : null}
            {event ? <span>Sức chứa {formatNumber(event.maxCapacity)}</span> : null}
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate(routes.event(eventId))}>
          Chi tiết sự kiện
        </Button>
      </header>

      {failures.length > 0 ? (
        <Alert className="bg-destructive/5 text-destructive">
          <AlertTriangle />
          <AlertTitle>Một số dữ liệu chưa tải được</AlertTitle>
          <AlertDescription className="text-destructive/80">
            {failures.join(" · ")}. Các phần còn lại vẫn hiển thị bình thường.
          </AlertDescription>
          <div className="col-start-2 mt-2">
            <Button variant="secondary" size="sm" onClick={retryFailed}>
              Thử lại
            </Button>
          </div>
        </Alert>
      ) : null}

      {statsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {stats ? (
        <section aria-label="Số liệu soát vé" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-label text-muted-foreground uppercase">Vé đã bán</p>
                <p className="text-display tabular-nums text-foreground">
                  {formatNumber(stats.tickets.total)}
                </p>
                <p className="text-label font-normal text-muted-foreground">
                  {formatNumber(stats.orders.confirmed)} đơn đã xác nhận
                </p>{" "}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-label text-muted-foreground uppercase">Đã soát</p>
                <p className="text-display tabular-nums text-foreground">
                  {formatNumber(stats.tickets.checkedIn)}
                </p>
                <p className="text-label font-normal text-muted-foreground">
                  {stats.lastCheckinAt
                    ? `Lượt gần nhất ${formatDateShort(stats.lastCheckinAt)}`
                    : "Chưa có lượt soát"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-label text-muted-foreground uppercase">Còn lại</p>
                <p className="text-display tabular-nums text-foreground">
                  {formatNumber(stats.tickets.remaining)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-label text-muted-foreground uppercase">Tỉ lệ soát</p>
                <p className="text-display tabular-nums text-foreground">
                  {formatPercent(stats.tickets.checkedIn, stats.tickets.total)}
                </p>
                <p className="text-label font-normal text-muted-foreground">
                  {formatNumber(stats.orders.pending)} đơn đang xử lý
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-title">Lượt soát theo cổng</CardTitle>
                <CardDescription>
                  {formatNumber(stats.byGate.reduce((total, gate) => total + gate.count, 0))} lượt
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.byGate.length > 0 ? (
                  <ChartContainer config={CHART_CONFIG} className="h-[220px] w-full">
                    <BarChart
                      accessibilityLayer
                      data={stats.byGate.map((row) => ({ gate: row.gate, count: row.count }))}
                      margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="gate" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        fill="var(--color-count)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={56}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <Empty className="p-6">
                    <EmptyHeader>
                      <EmptyTitle>Chưa có lượt soát nào</EmptyTitle>
                      <EmptyDescription>
                        Mở màn hình quét vé để bắt đầu ghi nhận lượt vào cổng.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button variant="secondary" onClick={() => navigate(routes.scan())}>
                        Mở quét vé
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-title">Đơn hàng</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {[
                  { label: "Tổng đơn", value: stats.orders.total, tone: "text-foreground" },
                  { label: "Đã xác nhận", value: stats.orders.confirmed, tone: "text-success" },
                  { label: "Đang xử lý", value: stats.orders.pending, tone: "text-warning" },
                  { label: "Thất bại", value: stats.orders.failed, tone: "text-destructive" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`text-title tabular-nums ${row.tone}`}>
                      {formatNumber(row.value)}
                    </span>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate(routes.orders({ eventId }))}
                >
                  Xem đơn hàng
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      ) : null}

      <section aria-label="Phiên đang diễn ra">
        <Card>
          <CardHeader>
            <CardTitle className="text-title">Phiên đang diễn ra</CardTitle>
            {session ? (
              <CardDescription>{formatDateShort(session.startTime)}</CardDescription>
            ) : null}
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {!session ? (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyTitle>Sự kiện chưa có phiên nào</EmptyTitle>
                  <EmptyDescription>
                    Thêm phiên trong trang chi tiết sự kiện để điều khiển Q&A, poll và quiz.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(routes.eventSessions(eventId))}
                  >
                    Thêm phiên
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-title text-foreground">{session.title}</p>
                  <p className="text-sm text-muted-foreground">{session.speaker}</p>
                  <Badge
                    variant="secondary"
                    className={
                      session.isLive
                        ? "bg-success/10 text-success"
                        : "bg-secondary text-secondary-foreground"
                    }
                  >
                    {session.isLive ? "Đang live" : "Chưa live"}
                  </Badge>
                </div>

                {sessionStatsQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}

                {sessionStats ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-label text-muted-foreground uppercase">Câu hỏi</p>
                      <p className="text-headline tabular-nums text-foreground">
                        {formatNumber(sessionStats.questions.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sessionStats.questions.topQuestion
                          ? `Nổi bật: ${sessionStats.questions.topQuestion.content}`
                          : "Chưa có câu hỏi nào"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-label text-muted-foreground uppercase">Poll đang mở</p>
                      <p className="text-headline text-foreground">
                        {sessionStats.activePoll ? sessionStats.activePoll.title : "Không có"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sessionStats.activePoll
                          ? `${formatNumber(sessionStats.activePoll.totalVotes)} lượt bình chọn`
                          : "Tạo poll khi cần khảo sát nhanh"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-label text-muted-foreground uppercase">Quiz</p>
                      <p className="text-headline text-foreground">
                        {sessionStats.game ? statusLabel(sessionStats.game.status) : "Chưa mở"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sessionStats.game
                          ? `Câu ${sessionStats.game.currentQuestionIndex + 1} / ${sessionStats.game.totalQuestions}`
                          : "Điều khiển quiz trong màn hình tương tác"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>

          {session ? (
            <CardFooter>
              <Button variant="secondary" onClick={() => navigate(routes.engagement(session.id))}>
                Điều khiển tương tác
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
