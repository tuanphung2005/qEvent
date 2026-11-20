import { EventSelect } from "@/components/event-select";
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
import { toApiError } from "@/lib/api/errors";
import { useEventContext } from "@/lib/event-context";
import { formatDateShort } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/money";
import { statusLabel, statusTone, statusToneClass } from "@/lib/format/status-label";
import { formatTicketCode, truncateId } from "@/lib/format/ticket-code";
import { routes } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { type TicketsFilter, useTickets } from "../api";
import { TICKET_STATUSES } from "../types";

const COLUMNS = ["Mã vé", "Khách", "Trạng thái", "Đơn", "Đã soát", ""];
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id);
    toast.success("Đã copy mã vé");
  } catch {
    toast.error("Không copy được. Chọn mã và copy tay.");
  }
}

export function TicketsPage() {
  const [params, setParams] = useSearchParams();
  const { eventId, event, events, setEventId, isLoading: eventsLoading } = useEventContext();

  const status = params.get("status");
  const statusFilter = TICKET_STATUSES.find((item) => item === status);
  const cursor = params.get("cursor");
  const query = params.get("q") ?? "";
  const [search, setSearch] = useState(query);
  const searchRef = useRef<HTMLInputElement>(null);

  // Back/forward and "Xoá bộ lọc" change the URL; the input follows it.
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
      next.delete("cursor");
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, query, params, setParams]);

  const filter: TicketsFilter | null = eventId
    ? {
        eventId,
        status: statusFilter,
        q: query.trim() || undefined,
        cursor: cursor ?? undefined,
      }
    : null;

  const ticketsQuery = useTickets(filter);
  const tickets = ticketsQuery.data?.tickets ?? [];
  const nextCursor = ticketsQuery.data?.nextCursor ?? null;
  const error = ticketsQuery.isError ? toApiError(ticketsQuery.error) : null;
  const filtering = Boolean(status || query || cursor);

  const setStatus = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "ALL") next.delete("status");
    else next.set("status", value);
    next.delete("cursor");
    setParams(next);
  };

  const goCursor = (value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set("cursor", value);
    else next.delete("cursor");
    setParams(next);
  };

  const clearFilters = () => {
    setSearch("");
    const next = new URLSearchParams(params);
    next.delete("status");
    next.delete("q");
    next.delete("cursor");
    setParams(next);
  };

  if (!eventId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-display text-foreground">Vé</h1>
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Chọn sự kiện để xem vé</EmptyTitle>
              <EmptyDescription>
                Danh sách vé, trạng thái soát và người sở hữu đều tính theo sự kiện được chọn ở
                thanh trên.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {events.length > 0 ? (
                <EventSelect
                  events={events}
                  onValueChange={setEventId}
                  label="Chọn sự kiện"
                  className="h-8 w-[320px]"
                />
              ) : eventsLoading ? (
                <Skeleton className="h-8 w-[320px]" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có sự kiện nào. Tạo sự kiện trước khi xem vé.
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
          <h1 className="text-display text-foreground">Vé</h1>
          <p className="text-sm text-muted-foreground">
            {event?.name ?? "Đang tải sự kiện…"} · {formatNumber(tickets.length)} vé trong trang này
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to={routes.scan()}>Mở quét vé</Link>
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Tìm vé"
          placeholder="Tìm mã vé, email hoặc tên khách"
          value={search}
          onChange={(input) => setSearch(input.target.value)}
          ref={searchRef}
          className="sm:max-w-[360px]"
        />
        <Select value={status ?? "ALL"} onValueChange={setStatus}>
          <SelectTrigger aria-label="Lọc theo trạng thái" className="w-full sm:w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Mọi trạng thái</SelectItem>
            {TICKET_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {statusLabel(item)}
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

      {error && (error.status === 403 || error.status >= 500) ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {error.status === 403 ? "Bạn không có quyền xem vé" : "Dịch vụ tạm thời không phản hồi"}
          </AlertTitle>
          <AlertDescription>
            {error.message}{" "}
            {error.status === 403 ? null : "Danh sách vé chưa tải được, thử lại sau."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="py-0">
        <CardContent className="p-0">
          {!ticketsQuery.isLoading && !error && tickets.length === 0 ? (
            <Empty className="p-10">
              <EmptyHeader>
                <EmptyTitle>Chưa có vé để hiển thị</EmptyTitle>
                <EmptyDescription>
                  {filtering
                    ? "Không có vé nào khớp bộ lọc hiện tại. Xoá bộ lọc để xem toàn bộ vé."
                    : "Vé xuất hiện ở đây ngay khi đơn hàng được xác nhận."}
                </EmptyDescription>
              </EmptyHeader>
              {filtering ? (
                <EmptyContent>
                  <Button variant="secondary" onClick={clearFilters}>
                    Xoá bộ lọc
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <Table aria-label="Danh sách vé">
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableHead
                      key={column || "action"}
                      className="text-label uppercase text-muted-foreground"
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketsQuery.isLoading
                  ? SKELETON_ROWS.map((row) => (
                      <TableRow key={`skeleton-${row}`}>
                        {COLUMNS.map((column) => (
                          <TableCell key={column || "action"}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : null}

                {!ticketsQuery.isLoading && error ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="py-6 text-center">
                      <p className="text-sm text-destructive">
                        Không tải được vé ({error.code}). {error.message}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => void ticketsQuery.refetch()}
                      >
                        Thử lại
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : null}

                {!ticketsQuery.isLoading && !error
                  ? tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => void copyId(ticket.id)}
                            aria-label={`Copy mã vé ${formatTicketCode(ticket.id)}`}
                            className="h-auto p-0 font-mono font-semibold"
                          >
                            {formatTicketCode(ticket.id)}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">
                              {ticket.attendee.fullName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {ticket.attendee.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusToneClass(statusTone(ticket.status))}
                          >
                            {statusLabel(ticket.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={routes.order(ticket.orderId)}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            {truncateId(ticket.orderId)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ticket.checkedInAt ? formatDateShort(ticket.checkedInAt) : "Chưa soát"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={routes.ticket(ticket.id)}>Xem</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tickets.length > 0 ? `Hiển thị ${formatNumber(tickets.length)} vé` : "Chưa có vé"}
          {nextCursor ? " · còn trang sau" : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={!cursor} onClick={() => goCursor(null)}>
            Trang đầu
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!nextCursor}
            onClick={() => goCursor(nextCursor)}
          >
            Trang sau
          </Button>
        </div>
      </div>
    </div>
  );
}
