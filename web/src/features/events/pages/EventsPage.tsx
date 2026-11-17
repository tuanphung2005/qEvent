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
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/features/auth/auth-context";
import { toApiError } from "@/lib/api/errors";
import { useEvents } from "@/lib/event-context";
import { formatDateShort, formatTime } from "@/lib/format/date";
import { formatNumber, formatPercent } from "@/lib/format/money";
import { statusToneClass } from "@/lib/format/status-label";
import { routes } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EVENT_PHASE, type EventPhase, eventPhase } from "../types";

type Column = { key: string; label: string; className?: string };

const COLUMNS: Column[] = [
  { key: "name", label: "Sự kiện", className: "w-[24%]" },
  { key: "time", label: "Thời gian", className: "w-[20%]" },
  { key: "status", label: "Trạng thái", className: "w-[18%]" },
  { key: "capacity", label: "Sức chứa", className: "w-[18%]" },
  { key: "structure", label: "Cấu trúc", className: "w-[12%]" },
  { key: "action", label: "", className: "w-[8%] text-right" },
];

function headClass(column: Column) {
  return ["text-label uppercase text-muted-foreground", column.className].filter(Boolean).join(" ");
}

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];
const PHASES = Object.keys(EVENT_PHASE) as EventPhase[];

export function EventsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const listQuery = useEvents();

  const query = params.get("q") ?? "";
  const phaseParam = params.get("phase");
  const phaseFilter = PHASES.find((item) => item === phaseParam);
  const [search, setSearch] = useState(query);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  // "/" jumps to search, the console-wide shortcut from DESIGN.md §8.12.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (search === query) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, query, params, setParams]);

  const events = listQuery.data?.events ?? [];
  const needle = query.trim().toLocaleLowerCase("vi");
  const filtered = events.filter((event) => {
    if (phaseFilter && eventPhase(event) !== phaseFilter) return false;
    if (!needle) return true;
    return (
      event.name.toLocaleLowerCase("vi").includes(needle) ||
      event.venue.toLocaleLowerCase("vi").includes(needle)
    );
  });

  const error = listQuery.isError ? toApiError(listQuery.error) : null;
  const filtering = Boolean(query || phaseFilter);
  const canCreate = user?.role === "ORGANIZER";

  const setPhase = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "ALL") next.delete("phase");
    else next.set("phase", value);
    setParams(next);
  };

  const clearFilters = () => {
    setSearch("");
    const next = new URLSearchParams(params);
    next.delete("q");
    next.delete("phase");
    setParams(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display text-foreground">Sự kiện</h1>
          <p className="text-sm text-muted-foreground">
            {events.length > 0
              ? `${formatNumber(filtered.length)} / ${formatNumber(events.length)} sự kiện`
              : "Danh sách sự kiện đang vận hành"}
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link to="/events/new">Tạo sự kiện</Link>
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Tìm sự kiện"
          placeholder="Tìm theo tên hoặc địa điểm"
          value={search}
          onChange={(input) => setSearch(input.target.value)}
          ref={searchRef}
          className="h-11 sm:max-w-[360px]"
        />
        <Select value={phaseFilter ?? "ALL"} onValueChange={setPhase}>
          <SelectTrigger aria-label="Lọc theo trạng thái" className="h-11 w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Mọi trạng thái</SelectItem>
            {PHASES.map((phase) => (
              <SelectItem key={phase} value={phase}>
                {EVENT_PHASE[phase].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtering ? (
          <Button variant="ghost" onClick={clearFilters}>
            Xoá bộ lọc
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {error.status === 403
              ? "Bạn không có quyền xem sự kiện"
              : error.status >= 500
                ? "Dịch vụ tạm thời không phản hồi"
                : "Không tải được danh sách sự kiện"}
          </AlertTitle>
          <AlertDescription>{error.message} Sự kiện chưa tải được, thử lại sau.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="min-w-0 py-0 [contain:inline-size]">
        <CardContent className="p-0">
          {!listQuery.isLoading && !error && filtered.length === 0 ? (
            <Empty className="p-10">
              <EmptyHeader>
                <EmptyTitle>
                  {filtering ? "Không có sự kiện khớp bộ lọc" : "Chưa có sự kiện nào"}
                </EmptyTitle>
                <EmptyDescription>
                  {filtering
                    ? "Thử từ khoá khác hoặc xoá bộ lọc để xem toàn bộ sự kiện."
                    : canCreate
                      ? "Tạo sự kiện đầu tiên, kèm phòng, phiên và loại vé để bắt đầu bán vé."
                      : "Ban tổ chức cần tạo sự kiện trước khi nhân sự soát vé có thể xem dữ liệu."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {filtering ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Xoá bộ lọc
                  </Button>
                ) : canCreate ? (
                  <Button asChild>
                    <Link to="/events/new">Tạo sự kiện</Link>
                  </Button>
                ) : null}
              </EmptyContent>
            </Empty>
          ) : (
            <Table aria-label="Danh sách sự kiện">
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableHead key={column.key} className={headClass(column)}>
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading
                  ? SKELETON_ROWS.map((row) => (
                      <TableRow key={`skeleton-${row}`}>
                        {COLUMNS.map((column) => (
                          <TableCell key={column.key}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : null}

                {!listQuery.isLoading && error ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="py-6 text-center">
                      <p className="text-sm text-destructive">
                        Không tải được sự kiện ({error.code}).
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => void listQuery.refetch()}
                      >
                        Thử lại
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : null}

                {!listQuery.isLoading && !error
                  ? filtered.map((event) => {
                      const phase = eventPhase(event);
                      return (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div className="flex max-w-[200px] flex-col lg:max-w-none">
                              <Link
                                to={routes.event(event.id)}
                                className="truncate font-semibold text-foreground hover:text-primary"
                              >
                                {event.name}
                              </Link>
                              <span className="truncate text-xs text-muted-foreground">
                                {event.venue}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{formatDateShort(event.startTime)}</span>
                              <span className="text-xs">
                                {formatTime(event.startTime)} – {formatTime(event.endTime)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={statusToneClass(EVENT_PHASE[phase].tone)}
                            >
                              {EVENT_PHASE[phase].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span>{formatNumber(event.reservedCount)}</span>
                            <span className="text-muted-foreground">
                              {" / "}
                              {formatNumber(event.maxCapacity)}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {formatPercent(event.reservedCount, event.maxCapacity)}
                              <span className="hidden lg:inline"> đã giữ chỗ</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex flex-col text-xs">
                              <span>{formatNumber(event.rooms.length)} phòng</span>
                              <span>{formatNumber(event.sessions.length)} phiên</span>
                              <span>{formatNumber(event.ticketTypes.length)} loại vé</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link to={routes.event(event.id)}>Xem</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {filtered.length > 0
          ? `Hiển thị ${formatNumber(filtered.length)} sự kiện`
          : "Chưa có sự kiện để hiển thị"}
      </p>
    </div>
  );
}
