import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { routes } from "@/lib/routes";
import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 py-16">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Không tìm thấy trang này</EmptyTitle>
          <EmptyDescription>
            Đường dẫn có thể đã đổi hoặc bạn không còn quyền xem màn hình đó.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => window.history.back()}>
          Quay lại
        </Button>
        <Button asChild>
          <Link to={routes.dashboard()}>Về tổng quan</Link>
        </Button>
      </div>
    </div>
  );
}
