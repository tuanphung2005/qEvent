import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatTicketCode, truncateId } from "@/lib/format/ticket-code";
import { routes } from "@/lib/routes";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { useQrToken, useTicket } from "../api";

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const ticketQuery = useTicket(ticketId);
  const qr = useQrToken(ticketId);
  const [qrOpen, setQrOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);

  // The token is valid for `expiresIn` seconds; the dialog closes itself at zero.
  useEffect(() => {
    if (!qrOpen) return;
    if (remaining <= 0) {
      setQrOpen(false);
      qr.reset();
      return;
    }
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [qrOpen, remaining, qr.reset]);

  const detail = ticketQuery.data;
  const ticket = detail?.ticket;
  const error = ticketQuery.isError ? toApiError(ticketQuery.error) : null;
  const qrError = qr.isError ? toApiError(qr.error) : null;

  const revealQr = () => {
    qr.mutate(undefined, {
      onSuccess: (data) => {
        setRemaining(data.expiresIn);
        setQrOpen(true);
      },
    });
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Đã copy mã QR");
    } catch {
      toast.error("Không copy được. Chọn mã và copy tay.");
    }
  };

  const back = (
    <Link
      to={routes.tickets()}
      className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Danh sách vé
    </Link>
  );

  if (ticketQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Card key={item}>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-32" />
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

  if (error?.status === 404 || !ticketId) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          <Empty className="p-10">
            <EmptyHeader>
              <EmptyTitle>Không tìm thấy vé</EmptyTitle>
              <EmptyDescription>
                Vé có thể đã bị huỷ hoặc mã vé không đúng. Mở danh sách để chọn vé khác.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="secondary">
                <Link to={routes.tickets()}>Về danh sách vé</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </div>
    );
  }

  if (error || !ticket || !detail) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Không tải được vé</AlertTitle>
          <AlertDescription>
            {error?.status === 403
              ? "Bạn không có quyền xem vé này."
              : `${error?.code ?? "UNKNOWN"} · ${error?.message ?? "Thử lại."}`}
          </AlertDescription>
        </Alert>
        <div>
          <Button variant="secondary" onClick={() => void ticketQuery.refetch()}>
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
          <h1 className="text-display text-foreground">Chi tiết vé</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatTicketCode(ticket.id)}
            </span>
            <Badge variant="secondary" className={statusToneClass(statusTone(ticket.status))}>
              {statusLabel(ticket.status)}
            </Badge>
          </div>
        </div>
        <Button onClick={revealQr} disabled={qr.isPending}>
          {qr.isPending ? "Đang tạo mã…" : "Hiện mã QR"}
        </Button>
      </header>

      {qrError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Chưa tạo được mã QR</AlertTitle>
          <AlertDescription>
            {qrError.message}{" "}
            {qrError.status === 409 ? "Vé này không dùng được để vào cổng." : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Thông tin vé" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-title">Người sở hữu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-title text-foreground">{ticket.attendee.fullName}</p>
            <p className="text-sm text-muted-foreground">{ticket.attendee.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title">Soát vé</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-title text-foreground">
              {ticket.checkedInAt ? "Đã soát" : "Chưa soát"}
            </p>
            <p className="text-sm text-muted-foreground">
              {ticket.checkedInAt ? formatDate(ticket.checkedInAt) : "Vé chưa qua cổng nào."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title">Đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <Link
              to={routes.order(detail.order.id)}
              className="font-mono text-sm font-semibold text-primary hover:underline"
            >
              {truncateId(detail.order.id)}
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant="secondary"
                className={statusToneClass(statusTone(detail.order.status))}
              >
                {statusLabel(detail.order.status)}
              </Badge>
              <span>{formatNumber(detail.order.quantity)} vé</span>
              <span>{formatMoney(detail.order.totalAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tạo lúc {formatDate(detail.order.createdAt)}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="py-0">
        <CardHeader className="pb-4 pt-4">
          <CardTitle className="text-title">Lịch sử soát vé</CardTitle>
          <CardDescription>
            {detail.checkinLogs.length > 0
              ? `${formatNumber(detail.checkinLogs.length)} lượt ghi nhận cho vé này`
              : "Vé chưa được soát lần nào"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {detail.checkinLogs.length === 0 ? (
            <Empty className="p-8">
              <EmptyHeader>
                <EmptyTitle>Chưa có lượt soát</EmptyTitle>
                <EmptyDescription>
                  Mở màn hình quét vé ở cổng để soát vé này. Lượt soát sẽ xuất hiện ngay tại đây.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="secondary">
                  <Link to={routes.scan()}>Mở quét vé</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table aria-label="Lịch sử soát vé">
              <TableHeader>
                <TableRow>
                  {["Thời điểm", "Cổng", "Hình thức", "Đồng bộ", "Người soát"].map((column) => (
                    <TableHead key={column} className="text-label uppercase text-muted-foreground">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.checkinLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDateShort(log.scannedAt)}</TableCell>
                    <TableCell className="font-mono text-sm">{log.deviceId ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.isOffline ? "Ngoại tuyến" : "Trực tuyến"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusToneClass(statusTone(log.syncStatus))}
                      >
                        {statusLabel(log.syncStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {truncateId(log.scannedBy)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          setQrOpen(open);
          if (!open) qr.reset();
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Mã QR vào cổng</DialogTitle>
            <DialogDescription>
              Mã tự ẩn sau {remaining} giây. Không chụp màn hình hoặc chia sẻ mã này.
            </DialogDescription>
          </DialogHeader>
          {/*
            shortcut: token is shown as text, not a QR image — PR1 ships no encoder
            dependency; upgrade when package.json owner adds one.
          */}
          <p className="break-all rounded-lg bg-secondary p-3 font-mono text-xs text-foreground">
            {qr.data?.qrToken}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatTicketCode(ticket.id)} · {ticket.attendee.fullName}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => qr.data && void copyToken(qr.data.qrToken)}>
              Copy mã
            </Button>
            <Button
              onClick={() => {
                setQrOpen(false);
                qr.reset();
              }}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
