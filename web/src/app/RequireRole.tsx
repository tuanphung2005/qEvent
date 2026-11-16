import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { statusLabel } from "@/lib/format/status-label";
import { routes } from "@/lib/routes";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="flex">
        <div className="hidden h-dvh w-[240px] shrink-0 bg-card md:block" />
        <div className="flex-1 px-4 py-6 md:px-5 lg:px-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <Card key={item} className="h-[104px]" />
              ))}
            </div>
            <Card className="h-[280px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 403 keeps the session: the role is wrong, the login is not. */
export function ForbiddenScreen({ role }: { role: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[480px] p-6">
        <p className="text-display text-foreground">Không có quyền truy cập</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tài khoản {statusLabel(role)} không dùng được console vận hành. Đăng nhập bằng tài khoản
          STAFF hoặc ORGANIZER để soát vé và theo dõi sự kiện.
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={() => window.location.assign(routes.login())}>
            Đăng nhập tài khoản khác
          </Button>
        </div>
      </Card>
    </main>
  );
}

/**
 * Route-level gate. The server still enforces every permission; this only keeps
 * wrong-role screens out of reach.
 */
export function RequireRole({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <ShellSkeleton />;

  if (status === "anonymous") {
    return (
      <Navigate
        to={routes.login()}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (user?.role === "ATTENDEE") return <ForbiddenScreen role={user.role} />;

  return <>{children}</>;
}
