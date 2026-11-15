import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="flex max-w-[720px] flex-col gap-6">
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
            <Skeleton className="h-11 w-full max-w-[420px]" />
          ) : (
            <Select
              value={eventId ?? ""}
              onValueChange={(value) => value && setEventId(value)}
              disabled={events.length === 0}
            >
              <SelectTrigger
                aria-label="Sự kiện mặc định"
                className="h-11 w-full max-w-[420px] bg-secondary"
              >
                <SelectValue
                  placeholder={events.length === 0 ? "Chưa có sự kiện" : "Chọn sự kiện"}
                />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Link to={routes.dashboard()} className="text-sm font-semibold text-primary hover:underline">
        Về tổng quan
      </Link>
    </div>
  );
}
