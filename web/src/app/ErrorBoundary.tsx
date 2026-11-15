import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isRouteErrorResponse, useRouteError } from "react-router";

/** Router error element: code + message + one way out, never a stack trace. */
export function RouteError() {
  const error = useRouteError();

  const status = isRouteErrorResponse(error) ? error.status : 0;
  const message = isRouteErrorResponse(error)
    ? status === 404
      ? "Không tìm thấy trang này."
      : error.statusText || "Không tải được trang."
    : error instanceof Error
      ? error.message
      : "Đã xảy ra lỗi khi tải trang.";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[520px] p-6">
        <p className="text-headline text-foreground">{message}</p>
        {status ? (
          <p className="mt-1 font-mono text-label text-muted-foreground">HTTP {status}</p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          Thử tải lại trang. Nếu vẫn lỗi, quay về tổng quan và tiếp tục từ đó.
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => window.location.reload()}>Tải lại</Button>
          <Button variant="secondary" onClick={() => window.location.assign("/dashboard")}>
            Về tổng quan
          </Button>
        </div>
      </Card>
    </main>
  );
}
