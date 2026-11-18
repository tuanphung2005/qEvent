import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { toApiError } from "@/lib/api/errors";
import type { Session } from "@/lib/api/types";
import { formatDateShort, formatTime } from "@/lib/format/date";
import { statusToneClass } from "@/lib/format/status-label";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useOutletContext } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateSession, useUpdateSession } from "../api";
import { type EventTabContext, eventErrorText, fromDateTimeInput, toDateTimeInput } from "../types";

const schema = z
  .object({
    title: z.string().trim().min(1, "Nhập tiêu đề phiên"),
    speaker: z.string().trim().min(1, "Nhập tên diễn giả"),
    startTime: z.string().min(1, "Chọn giờ bắt đầu"),
    endTime: z.string().min(1, "Chọn giờ kết thúc"),
    isLive: z.boolean(),
  })
  .refine(
    (values) =>
      !values.startTime ||
      !values.endTime ||
      Date.parse(fromDateTimeInput(values.startTime)) <
        Date.parse(fromDateTimeInput(values.endTime)),
    { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] },
  );

type FormValues = z.infer<typeof schema>;

function SessionDialog({
  eventId,
  session,
  open,
  onOpenChange,
}: {
  eventId: string;
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createSession = useCreateSession(eventId);
  const updateSession = useUpdateSession(eventId);
  const [formError, setFormError] = useState<string | null>(null);
  const pending = createSession.isPending || updateSession.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      title: session?.title ?? "",
      speaker: session?.speaker ?? "",
      startTime: toDateTimeInput(session?.startTime),
      endTime: toDateTimeInput(session?.endTime),
      isLive: session?.isLive ?? false,
    },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    form.reset({
      title: session?.title ?? "",
      speaker: session?.speaker ?? "",
      startTime: toDateTimeInput(session?.startTime),
      endTime: toDateTimeInput(session?.endTime),
      isLive: session?.isLive ?? false,
    });
  }, [open, session, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const body = {
      title: values.title.trim(),
      speaker: values.speaker.trim(),
      startTime: fromDateTimeInput(values.startTime),
      endTime: fromDateTimeInput(values.endTime),
    };
    try {
      if (session) {
        await updateSession.mutateAsync({ sessionId: session.id, body });
        toast.success("Đã cập nhật phiên");
      } else {
        await createSession.mutateAsync({ ...body, isLive: values.isLive });
        toast.success("Đã thêm phiên");
      }
      onOpenChange(false);
    } catch (cause) {
      const error = toApiError(cause);
      if (error.code === "INVALID_SESSION_TIME") {
        form.setError("endTime", { message: eventErrorText(error.code, error.message) });
        return;
      }
      setFormError(eventErrorText(error.code, error.message));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session ? "Sửa phiên" : "Thêm phiên"}</DialogTitle>
          <DialogDescription>
            Phiên là nơi host Q&A, poll và quiz. Bật live khi phiên bắt đầu.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {formError ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={Boolean(form.formState.errors.title)}>
              <FieldLabel htmlFor="session-title">Tiêu đề</FieldLabel>
              <Input
                id="session-title"
                placeholder="Opening Keynote"
                aria-invalid={Boolean(form.formState.errors.title)}
                {...form.register("title")}
              />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.speaker)}>
              <FieldLabel htmlFor="session-speaker">Diễn giả</FieldLabel>
              <Input
                id="session-speaker"
                placeholder="Alex Nguyen"
                aria-invalid={Boolean(form.formState.errors.speaker)}
                {...form.register("speaker")}
              />
              <FieldError>{form.formState.errors.speaker?.message}</FieldError>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.startTime)}>
                <FieldLabel htmlFor="session-start">Bắt đầu</FieldLabel>
                <Input
                  id="session-start"
                  type="datetime-local"
                  aria-invalid={Boolean(form.formState.errors.startTime)}
                  {...form.register("startTime")}
                />
                <FieldError>{form.formState.errors.startTime?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.endTime)}>
                <FieldLabel htmlFor="session-end">Kết thúc</FieldLabel>
                <Input
                  id="session-end"
                  type="datetime-local"
                  aria-invalid={Boolean(form.formState.errors.endTime)}
                  {...form.register("endTime")}
                />
                <FieldError>{form.formState.errors.endTime?.message}</FieldError>
              </Field>
            </div>
            {session ? null : (
              <Label
                htmlFor="session-live"
                className="flex h-8 items-center gap-2 text-sm text-foreground"
              >
                <Checkbox
                  id="session-live"
                  checked={form.watch("isLive")}
                  onCheckedChange={(checked) =>
                    form.setValue("isLive", checked === true, { shouldDirty: true })
                  }
                />
                Bật live ngay
              </Label>
            )}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : session ? "Lưu thay đổi" : "Thêm phiên"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SessionsTab() {
  const { event } = useOutletContext<EventTabContext>();
  const { user } = useAuth();
  const canEdit = user?.role === "ORGANIZER";
  const updateSession = useUpdateSession(event.id);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Session | null>(null);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (session: Session) => {
    setEditing(session);
    setOpen(true);
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    const next = !toggleTarget.isLive;
    try {
      await updateSession.mutateAsync({ sessionId: toggleTarget.id, body: { isLive: next } });
      toast.success(next ? "Phiên đã bật live" : "Phiên đã tắt live");
      setToggleTarget(null);
    } catch (cause) {
      const error = toApiError(cause);
      toast.error(eventErrorText(error.code, error.message));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-headline text-foreground">Phiên</h2>
          <p className="text-sm text-muted-foreground">
            {event.sessions.length} phiên ·{" "}
            {event.sessions.filter((session) => session.isLive).length} đang live
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate}>
            <Plus />
            Thêm phiên
          </Button>
        ) : null}
      </header>

      <Card className="min-w-0 py-0 [contain:inline-size]">
        <CardContent className="p-0">
          {event.sessions.length === 0 ? (
            <Empty className="p-10">
              <EmptyHeader>
                <EmptyTitle>Chưa có phiên</EmptyTitle>
                <EmptyDescription>
                  Thêm phiên để host Q&A, poll và quiz với người tham dự.
                </EmptyDescription>
              </EmptyHeader>
              {canEdit ? (
                <Button variant="secondary" className="mt-2" onClick={openCreate}>
                  Thêm phiên đầu tiên
                </Button>
              ) : null}
            </Empty>
          ) : (
            <Table aria-label="Danh sách phiên">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-label uppercase text-muted-foreground">
                    Phiên
                  </TableHead>
                  <TableHead className="text-label uppercase text-muted-foreground">
                    Diễn giả
                  </TableHead>
                  <TableHead className="text-label uppercase text-muted-foreground">
                    Thời gian
                  </TableHead>
                  <TableHead className="text-label uppercase text-muted-foreground">
                    Trạng thái
                  </TableHead>
                  {canEdit ? <TableHead className="w-40" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-semibold text-foreground">{session.title}</TableCell>
                    <TableCell className="text-muted-foreground">{session.speaker}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateShort(session.startTime)} · {formatTime(session.endTime)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          session.isLive ? statusToneClass("success") : statusToneClass("neutral")
                        }
                      >
                        {session.isLive ? "Đang diễn ra" : "Chưa live"}
                      </Badge>
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(session)}>
                            Sửa
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setToggleTarget(session)}
                          >
                            {session.isLive ? "Tắt live" : "Bật live"}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <SessionDialog eventId={event.id} session={editing} open={open} onOpenChange={setOpen} />
      ) : null}

      <AlertDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(value) => (value ? undefined : setToggleTarget(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.isLive ? "Tắt live phiên này?" : "Bật live phiên này?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.isLive
                ? "Người tham dự sẽ không gửi được Q&A, vote poll hay chơi quiz cho tới khi bật lại."
                : "Q&A, poll và quiz của phiên sẽ mở cho người đã check-in vào sự kiện."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              variant={toggleTarget?.isLive ? "destructive" : "default"}
              disabled={updateSession.isPending}
              onClick={() => void confirmToggle()}
            >
              {toggleTarget?.isLive ? "Tắt live" : "Bật live"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
