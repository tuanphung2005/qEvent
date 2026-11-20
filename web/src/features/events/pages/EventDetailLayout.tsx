import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { toApiError } from "@/lib/api/errors";
import { formatRange } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/money";
import { statusToneClass } from "@/lib/format/status-label";
import { routes } from "@/lib/routes";
import { cn } from "cn";
import { AlertTriangle } from "lucide-react";
import { Link, Outlet, useLocation, useParams } from "react-router";
import { useEvent } from "../api";
import { EVENT_PHASE, type EventTabContext, eventPhase } from "../types";

const TABS = [
  { value: "overview", label: "Tổng quan", suffix: "" },
  { value: "rooms", label: "Phòng", suffix: "/rooms" },
  { value: "sessions", label: "Phiên", suffix: "/sessions" },
  { value: "ticket-types", label: "Loại vé", suffix: "/ticket-types" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function currentTab(pathname: string): TabValue {
  if (pathname.endsWith("/rooms")) return "rooms";
  if (pathname.endsWith("/sessions")) return "sessions";
  if (pathname.endsWith("/ticket-types")) return "ticket-types";
  return "overview";
}

export function EventDetailLayout() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const query = useEvent(eventId);

  if (!eventId) {
    return (
      <Card className="p-10">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Không tìm thấy sự kiện</EmptyTitle>
            <EmptyDescription>Đường dẫn thiếu mã sự kiện.</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="secondary" className="mt-4">
            <Link to={routes.events()}>Về danh sách sự kiện</Link>
          </Button>
        </Empty>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-[520px]" />
        <Skeleton className="h-10 w-[420px] max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = toApiError(query.error);
    if (error.status === 404) {
      return (
        <Card className="p-10">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Không tìm thấy sự kiện</EmptyTitle>
              <EmptyDescription>
                Sự kiện đã bị xoá hoặc mã chưa đúng. Quay lại danh sách để chọn sự kiện khác.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild variant="secondary" className="mt-4">
              <Link to={routes.events()}>Về danh sách sự kiện</Link>
            </Button>
          </Empty>
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {error.status === 403
              ? "Bạn không có quyền xem sự kiện này"
              : error.status >= 500
                ? "Dịch vụ tạm thời không phản hồi"
                : "Không tải được sự kiện"}
          </AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
          <Button asChild variant="ghost">
            <Link to={routes.events()}>Về danh sách</Link>
          </Button>
        </div>
      </div>
    );
  }

  const event = query.data?.event;
  if (!event) {
    return (
      <Card className="p-10">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Không tìm thấy sự kiện</EmptyTitle>
            <EmptyDescription>Dữ liệu sự kiện trống.</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="secondary" className="mt-4">
            <Link to={routes.events()}>Về danh sách sự kiện</Link>
          </Button>
        </Empty>
      </Card>
    );
  }

  const phase = eventPhase(event);
  const tab = currentTab(location.pathname);
  const context: EventTabContext = { event };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            to={routes.events()}
            className="w-fit text-sm text-muted-foreground hover:text-primary"
          >
            ← Danh sách sự kiện
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-display text-foreground">{event.name}</h1>
            <Badge variant="secondary" className={statusToneClass(EVENT_PHASE[phase].tone)}>
              {EVENT_PHASE[phase].label}
            </Badge>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{event.venue}</span>
            <span>{formatRange(event.startTime, event.endTime)}</span>
            <span>Sức chứa {formatNumber(event.maxCapacity)}</span>
          </p>
        </div>
        {user?.role === "ORGANIZER" ? (
          <Button asChild variant="secondary">
            <Link to={`${routes.event(event.id)}?edit=1`}>Sửa sự kiện</Link>
          </Button>
        ) : null}
      </header>

      {/*
        Route tabs, not an ARIA tablist: each label is a real URL, so links keep
        the keyboard contract honest (Radix tabs without panels left every
        trigger at tabindex=-1 and pointed aria-controls at nothing).
      */}
      <nav
        aria-label="Khu vực sự kiện"
        className="flex h-8 w-fit max-w-full items-center justify-start overflow-x-auto border-b border-card-border"
      >
        {TABS.map((item) => {
          const active = item.value === tab;
          return (
            <Link
              key={item.value}
              to={`${routes.event(event.id)}${item.suffix}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-[calc(100%-1px)] items-center justify-center px-3 py-1 text-sm whitespace-nowrap transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/20",
                active
                  ? "font-medium text-primary after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-primary"
                  : "text-foreground/80",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Outlet context={context} />
    </div>
  );
}
