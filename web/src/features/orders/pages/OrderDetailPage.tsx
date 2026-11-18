import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { formatDate, formatDateShort } from "@/lib/format/date";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { statusLabel, statusTone, statusToneClass } from "@/lib/format/status-label";
import { formatTicketCode } from "@/lib/format/ticket-code";
import { routes } from "@/lib/routes";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { useOrder } from "../api";

async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id);
    toast.success("Đã copy mã đơn");
  } catch {
    toast.error("Không copy được. Chọn mã và copy tay.");
  }
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const orderQuery = useOrder(orderId);
  const order = orderQuery.data?.order;
  const error = orderQuery.isError ? toApiError(orderQuery.error) : null;

  const back = (
    <Link
      to={routes.orders()}
      className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Danh sách đơn hàng
    </Link>
  );

  if (orderQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error?.status === 404 || !orderId) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          <Empty className="p-10">
            <EmptyHeader>
              <EmptyTitle>Không tìm thấy đơn hàng</EmptyTitle>
              <EmptyDescription>
                Đơn có thể đã bị xoá hoặc mã đơn không đúng. Mở danh sách để chọn đơn khác.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="secondary">
                <Link to={routes.orders()}>Về danh sách đơn hàng</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Không tải được đơn hàng</AlertTitle>
          <AlertDescription>
            {error?.status === 403
              ? "Bạn không có quyền xem đơn hàng này."
              : `${error?.code ?? "UNKNOWN"} · ${error?.message ?? "Thử lại."}`}
          </AlertDescription>
        </Alert>
        <div>
          <Button variant="secondary" onClick={() => void orderQuery.refetch()}>
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {back}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display text-foreground">Chi tiết đơn</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => void copyId(order.id)}
              aria-label={`Copy mã đơn ${order.id}`}
              className="h-auto p-0 font-mono font-semibold"
            >
              {order.id}
            </Button>
            <Badge variant="secondary" className={statusToneClass(statusTone(order.status))}>
              {statusLabel(order.status)}
            </Badge>
          </div>
        </div>
      </header>

      {order.failureCode ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Đơn gặp lỗi khi xử lý</AlertTitle>
          <AlertDescription>
            Mã lỗi {order.failureCode}. Vé của đơn này có thể chưa dùng được để soát.
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Thông tin đơn" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="text-label uppercase text-muted-foreground">Số vé</p>
            <p className="text-headline tabular-nums text-foreground">
              {formatNumber(order.quantity)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(order.tickets.length)} vé đã phát hành
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="text-label uppercase text-muted-foreground">Tổng tiền</p>
            <p className="text-headline tabular-nums text-foreground">
              {formatMoney(order.totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="text-label uppercase text-muted-foreground">Tạo lúc</p>
            <p className="text-title text-foreground">{formatDate(order.createdAt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="text-label uppercase text-muted-foreground">Loại vé</p>
            <p className="font-mono text-sm text-foreground">{order.ticketTypeId}</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-title">Tiến trình</CardTitle>
            <CardDescription>Mốc thời gian backend trả về cho đơn.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-4">
              <li className="flex gap-3">
                <span
                  className="mt-1 size-2.5 shrink-0 rounded-pill bg-primary"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground">Đơn được tạo</p>
                  <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span
                  className={`mt-1 size-2.5 shrink-0 rounded-pill ${statusTone(order.status) === "success" ? "bg-success" : statusTone(order.status) === "error" ? "bg-destructive" : "bg-warning"}`}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground">Trạng thái hiện tại</p>
                  <Badge
                    variant="secondary"
                    className={`w-fit ${statusToneClass(statusTone(order.status))}`}
                  >
                    {statusLabel(order.status)}
                  </Badge>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="pb-4 pt-4">
            <CardTitle className="text-title">Vé trong đơn</CardTitle>
            <CardDescription>
              {formatNumber(order.tickets.length)} vé · soát vé bằng mã QR của từng vé
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {order.tickets.length === 0 ? (
              <Empty className="p-8">
                <EmptyHeader>
                  <EmptyTitle>Đơn chưa có vé</EmptyTitle>
                  <EmptyDescription>
                    Vé được phát hành khi đơn được xác nhận. Đơn đang xử lý sẽ có vé sau.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table aria-label="Vé trong đơn">
                <TableHeader>
                  <TableRow>
                    {["Mã vé", "Trạng thái", "Đã soát", ""].map((column) => (
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
                  {order.tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm text-foreground">
                        {formatTicketCode(ticket.id)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusToneClass(statusTone(ticket.status))}
                        >
                          {statusLabel(ticket.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ticket.checkedInAt ? formatDateShort(ticket.checkedInAt) : "Chưa soát"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={routes.ticket(ticket.id)}>Xem vé</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
