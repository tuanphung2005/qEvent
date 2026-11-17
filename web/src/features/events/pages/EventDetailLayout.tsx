import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { toApiError } from "@/lib/api/errors";
import { formatRange } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/money";
import { statusToneClass } from "@/lib/format/status-label";
import { routes } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router";
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
  const navigate = useNavigate();
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
      <div className="flex flex-col gap-6">
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

  const goTab = (value: string) => {
    const target = TABS.find((item) => item.value === value);
    if (!target) return;
    navigate(`${routes.event(event.id)}${target.suffix}`);
  };

  return (
    <div className="flex flex-col gap-6">
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

      <Tabs value={tab} onValueChange={goTab}>
        <TabsList
          variant="line"
          className="h-11 w-fit max-w-full justify-start overflow-x-auto group-data-horizontal/tabs:h-11"
        >
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="px-3">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet context={context} />
    </div>
  );
}
