import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventContext } from "@/lib/event-context";
import { useRealtime } from "@/lib/realtime/useRealtime";
import { routes } from "@/lib/routes";
import { Activity, AlertTriangle, CheckCircle2, HelpCircle, Radio } from "lucide-react";
import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router";

export function EngagementShell() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { event, isLoading: eventLoading } = useEventContext();

  const sessions = event?.sessions ?? [];
  const activeSession = sessions.find((s) => s.id === sessionId) ?? sessions[0] ?? null;

  // Realtime hook for the active session
  const { status: realtimeStatus } = useRealtime(
    activeSession ? { channel: "qa", sessionId: activeSession.id } : null,
  );

  // Sync route param when activeSession changes or is missing
  useEffect(() => {
    if (!sessionId && activeSession) {
      navigate(routes.engagement(activeSession.id, "qa"), { replace: true });
    }
  }, [sessionId, activeSession, navigate]);

  const currentTab = location.pathname.endsWith("/polls")
    ? "polls"
    : location.pathname.endsWith("/quiz")
      ? "quiz"
      : "qa";

  if (eventLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-11 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Chưa có phiên tương tác</EmptyTitle>
            <EmptyDescription>
              Sự kiện này chưa có phiên thuyết trình nào được thiết lập. Hãy tạo phiên trong quản lý
              sự kiện.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Top Header & Session Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tương tác trực tiếp</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý Q&amp;A, Khảo sát và Quiz theo thời gian thực
          </p>
        </div>

        {/* Realtime Status Banner */}
        <div className="flex items-center gap-2">
          {realtimeStatus === "open" && (
            <Badge variant="outline" className="h-9 gap-1.5 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>Realtime đã kết nối</span>
            </Badge>
          )}
          {(realtimeStatus === "connecting" || realtimeStatus === "reconnecting") && (
            <Badge variant="outline" className="h-9 gap-1.5 bg-amber-50 text-amber-700">
              <Radio className="size-4 animate-pulse text-amber-600" />
              <span>Đang kết nối lại...</span>
            </Badge>
          )}
          {(realtimeStatus === "fallback" || realtimeStatus === "offline") && (
            <Badge variant="outline" className="h-9 gap-1.5 bg-rose-50 text-rose-700">
              <AlertTriangle className="size-4 text-rose-600" />
              <span>Chuyển sang Polling</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Session Switcher Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">Phiên:</span>
        {sessions.map((s) => {
          const isSelected = s.id === activeSession?.id;
          return (
            <Button
              key={s.id}
              variant={isSelected ? "default" : "secondary"}
              size="sm"
              className="h-9 shrink-0 gap-2"
              asChild
            >
              <Link to={routes.engagement(s.id, currentTab)}>
                {s.isLive && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
                <span className="truncate max-w-[200px]">{s.title}</span>
              </Link>
            </Button>
          );
        })}
      </div>

      {/* Session Info Card */}
      {activeSession && (
        <Card className="bg-card shadow-sm">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{activeSession.title}</span>
                {activeSession.isLive ? (
                  <Badge variant="default" className="bg-emerald-600">
                    Đang diễn ra
                  </Badge>
                ) : (
                  <Badge variant="secondary">Chưa bắt đầu</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Diễn giả: {activeSession.speaker}</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 rounded-lg bg-secondary p-1">
              <Button
                variant={currentTab === "qa" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                asChild
              >
                <Link to={routes.engagement(activeSession.id, "qa")}>
                  <HelpCircle className="size-4" />
                  <span>Hỏi &amp; Đáp</span>
                </Link>
              </Button>
              <Button
                variant={currentTab === "polls" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                asChild
              >
                <Link to={routes.engagement(activeSession.id, "polls")}>
                  <Activity className="size-4" />
                  <span>Bình chọn</span>
                </Link>
              </Button>
              <Button
                variant={currentTab === "quiz" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1.5"
                asChild
              >
                <Link to={routes.engagement(activeSession.id, "quiz")}>
                  <Radio className="size-4" />
                  <span>Quiz Trắc nghiệm</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Content Outlet */}
      <div>
        <Outlet context={{ activeSession, realtimeStatus }} />
      </div>
    </div>
  );
}
