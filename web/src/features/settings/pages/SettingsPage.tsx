import { EventSelect } from "@/components/event-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useEventContext } from "@/lib/event-context";
import { statusLabel, statusTone, statusToneClass } from "@/lib/format/status-label";
import { routes } from "@/lib/routes";
import { Link } from "react-router";

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { eventId, setEventId, events, isLoading } = useEventContext();

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <h1 className="text-display text-foreground">Tài khoản</h1>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-label text-muted-foreground uppercase">Họ tên</dt>
              <dd className="text-sm text-foreground">{user?.fullName ?? "—"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-label text-muted-foreground uppercase">Email</dt>
              <dd className="text-sm text-foreground">{user?.email ?? "—"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-label text-muted-foreground uppercase">Vai trò</dt>
              <dd>
                {user ? (
                  <Badge variant="secondary" className={statusToneClass(statusTone(user.role))}>
                    {statusLabel(user.role)}
                  </Badge>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <div>
            <Button variant="secondary" onClick={logout}>
              Đăng xuất
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-title">Sự kiện mặc định</CardTitle>
          <CardDescription>Mở console ở sự kiện này mỗi lần đăng nhập.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="w-full max-w-[420px]" />
          ) : (
            <EventSelect
              events={events}
              value={eventId}
              onValueChange={setEventId}
              label="Sự kiện mặc định"
              className="w-full max-w-[420px]"
            />
          )}
        </CardContent>
      </Card>

      <Link to={routes.dashboard()} className="text-sm font-semibold text-primary hover:underline">
        Về tổng quan
      </Link>
    </div>
  );
}
