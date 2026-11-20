import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toApiError } from "@/lib/api/errors";
import { useEventContext } from "@/lib/event-context";
import { formatTime } from "@/lib/format/date";
import { formatNumber, formatPercent } from "@/lib/format/money";
import { statusLabel, statusTone, statusToneClass } from "@/lib/format/status-label";
import { formatTicketCode } from "@/lib/format/ticket-code";
import { routes } from "@/lib/routes";
import { AlertTriangle, Pause, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAdmissionStats, useCheckinFeed } from "../api";

const COLUMNS = ["Giờ", "Mã vé", "Khách", "Cổng", "Đồng bộ", "Trạng thái vé"];
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

export function CheckinsPage() {
  const [params, setParams] = useSearchParams();
  const { eventId, event, events, setEventId, isLoading: eventsLoading } = useEventContext();
  const gate = params.get("gate") ?? "";
  const [paused, setPaused] = useState(false);

  const feedQuery = useCheckinFeed(eventId, gate, paused);
  const statsQuery = useAdmissionStats(eventId, paused);

  const checkins = feedQuery.data?.checkins ?? [];
  const stats = statsQuery.data;
  const feedError = feedQuery.isError ? toApiError(feedQuery.error) : null;
  const statsError = statsQuery.isError ? toApiError(statsQuery.error) : null;

  const gates = useMemo(() => {
    const fromStats = (stats?.byGate ?? []).map((row) => row.gate);
    const fromFeed = checkins
      .map((row) => row.deviceId)
      .filter((value): value is string => Boolean(value));
    // Keep a gate from the URL selectable even before it has any check-in.
    return [...new Set([...fromStats, ...fromFeed, ...(gate ? [gate] : [])])];
  }, [stats, checkins, gate]);

  const setGate = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "ALL") next.delete("gate");
    else next.set("gate", value);
    setParams(next);
  };

  const refresh = () => {
    void feedQuery.refetch();
    void statsQuery.refetch();
  };

  const updatedAt = feedQuery.dataUpdatedAt
    ? formatTime(new Date(feedQuery.dataUpdatedAt).toISOString())
    : "—";

  if (!eventId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-display text-foreground">Check-in</h1>
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Chọn sự kiện để theo dõi check-in</EmptyTitle>
              <EmptyDescription>
                Lượt soát, số vé còn lại và thống kê theo cổng đều tính theo sự kiện được chọn ở
                thanh trên.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {events.length > 0 ? (
                <Select onValueChange={(value) => value && setEventId(value)}>
                  <SelectTrigger aria-label="Chọn sự kiện" className="h-8 w-[320px]">
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
                <Skeleton className="h-8 w-[320px]" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có sự kiện nào. Tạo sự kiện trước khi theo dõi check-in.
                </p>
              )}
            </EmptyContent>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display text-foreground">Check-in</h1>
          <p className="text-sm text-muted-foreground">
            {event?.name ?? "Đang tải sự kiện…"} · cập nhật lúc {updatedAt}
            {paused ? " · đang tạm dừng" : " · tự cập nhật mỗi 3 giây"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {paused ? "Tiếp tục" : "Tạm dừng"}
          </Button>
          <Button asChild variant="secondary">
            <Link to={routes.scan()}>Quét vé</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to={routes.sync()}>Đồng bộ</Link>
          </Button>
        </div>
      </header>

      {paused ? (
        <Alert>
          <AlertTitle>Đang tạm dừng cập nhật</AlertTitle>
          <AlertDescription>
            Bảng không tự tải thêm lượt soát mới. Bấm "Tiếp tục" để theo dõi lại, hoặc "Làm mới" để
            tải một lần.
          </AlertDescription>
        </Alert>
      ) : null}

      {statsError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Không tải được số liệu</AlertTitle>
          <AlertDescription>
            {statsError.code} · {statsError.message} Bảng lượt soát vẫn hoạt động bình thường.
          </AlertDescription>
        </Alert>
      ) : null}

      {statsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {stats ? (
        <section aria-label="Số liệu soát vé" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-label uppercase text-muted-foreground">Đã soát</p>
              <p className="text-display tabular-nums text-foreground">
                {formatNumber(stats.tickets.checkedIn)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatPercent(stats.tickets.checkedIn, stats.tickets.total)} tổng vé
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-label uppercase text-muted-foreground">Tổng vé</p>
              <p className="text-display tabular-nums text-foreground">
                {formatNumber(stats.tickets.total)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-label uppercase text-muted-foreground">Còn lại</p>
              <p className="text-display tabular-nums text-foreground">
                {formatNumber(stats.tickets.remaining)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1">
              <p className="text-label uppercase text-muted-foreground">Đơn đang xử lý</p>
              <p className="text-display tabular-nums text-warning">
                {formatNumber(stats.orders.pending)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats.orders.confirmed)} đơn đã xác nhận
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {stats && stats.byGate.length > 0 ? (
        <section aria-label="Lượt soát theo cổng" className="flex flex-wrap items-center gap-2">
          <span className="text-label uppercase text-muted-foreground">Theo cổng</span>
          {stats.byGate.map((row) => (
            <Badge key={row.gate} variant="secondary" className="tabular-nums">
              {row.gate} · {formatNumber(row.count)}
            </Badge>
          ))}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={gate || "ALL"} onValueChange={setGate}>
          <SelectTrigger aria-label="Lọc theo cổng" className="w-full sm:w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Mọi cổng</SelectItem>
            {gates.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={refresh}>
          Làm mới
        </Button>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {!feedQuery.isLoading && !feedError && checkins.length === 0 ? (
            <Empty className="p-10">
              <EmptyHeader>
                <EmptyTitle>Chưa có lượt soát nào</EmptyTitle>
                <EmptyDescription>
                  {gate
                    ? "Cổng này chưa ghi nhận lượt soát. Chọn cổng khác hoặc bỏ lọc."
                    : "Mở màn hình quét vé ở cổng để bắt đầu ghi nhận lượt vào."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="secondary">
                  <Link to={routes.scan()}>Mở quét vé</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table aria-label="Lượt soát vé">
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableHead key={column} className="text-label uppercase text-muted-foreground">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedQuery.isLoading
                  ? SKELETON_ROWS.map((row) => (
                      <TableRow key={`skeleton-${row}`}>
                        {COLUMNS.map((column) => (
                          <TableCell key={column}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : null}

                {!feedQuery.isLoading && feedError ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="py-6 text-center">
                      <p className="text-sm text-destructive">
                        Không tải được lượt soát ({feedError.code}). {feedError.message}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => void feedQuery.refetch()}
                      >
                        Thử lại
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : null}

                {!feedQuery.isLoading && !feedError
                  ? checkins.map((row) => (
                      <TableRow
                        key={row.id}
                        className={
                          row.syncStatus === "CONFLICT" || row.isOffline
                            ? "bg-warning-subtle"
                            : undefined
                        }
                      >
                        <TableCell className="tabular-nums">{formatTime(row.scannedAt)}</TableCell>
                        <TableCell>
                          <Link
                            to={routes.ticket(row.ticketId)}
                            className="font-mono text-sm font-semibold text-primary hover:underline"
                          >
                            {formatTicketCode(row.ticketId)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">
                              {row.attendee.fullName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {row.attendee.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.deviceId ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge
                              variant="secondary"
                              className={statusToneClass(statusTone(row.syncStatus))}
                            >
                              {statusLabel(row.syncStatus)}
                            </Badge>
                            {row.isOffline ? (
                              <Badge variant="secondary" className="bg-warning-subtle text-warning">
                                Ngoại tuyến
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusToneClass(statusTone(row.ticketStatus))}
                          >
                            {statusLabel(row.ticketStatus)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {formatNumber(checkins.length)} lượt gần nhất · bảng mới nhất ở trên
        {paused ? " · đang tạm dừng" : ""}
      </p>
    </div>
  );
}
