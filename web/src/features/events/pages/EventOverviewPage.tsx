import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { toApiError } from "@/lib/api/errors";
import { formatDate, formatRange } from "@/lib/format/date";
import { formatNumber, formatPercent } from "@/lib/format/money";
import { routes } from "@/lib/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { type UpdateEventInput, useUpdateEvent } from "../api";
import { type EventTabContext, eventErrorText, fromDateTimeInput, toDateTimeInput } from "../types";

const schema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên sự kiện"),
    venue: z.string().trim().min(1, "Nhập địa điểm"),
    startTime: z.string().min(1, "Chọn giờ bắt đầu"),
    endTime: z.string().min(1, "Chọn giờ kết thúc"),
    maxCapacity: z
      .number({ invalid_type_error: "Nhập sức chứa" })
      .int("Sức chứa là số nguyên")
      .min(1, "Sức chứa tối thiểu 1"),
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

export function EventOverviewPage() {
  const { event } = useOutletContext<EventTabContext>();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const updateEvent = useUpdateEvent(event.id);
  const [formError, setFormError] = useState<string | null>(null);
  const editing = user?.role === "ORGANIZER" && params.get("edit") === "1";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      name: event.name,
      venue: event.venue,
      startTime: toDateTimeInput(event.startTime),
      endTime: toDateTimeInput(event.endTime),
      maxCapacity: event.maxCapacity,
    },
  });

  useEffect(() => {
    form.reset({
      name: event.name,
      venue: event.venue,
      startTime: toDateTimeInput(event.startTime),
      endTime: toDateTimeInput(event.endTime),
      maxCapacity: event.maxCapacity,
    });
  }, [event, form]);

  const stopEditing = () => {
    const next = new URLSearchParams(params);
    next.delete("edit");
    setParams(next, { replace: true });
    setFormError(null);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const patch: UpdateEventInput = {};
    if (values.name.trim() !== event.name) patch.name = values.name.trim();
    if (values.venue.trim() !== event.venue) patch.venue = values.venue.trim();
    if (values.startTime !== toDateTimeInput(event.startTime))
      patch.startTime = fromDateTimeInput(values.startTime);
    if (values.endTime !== toDateTimeInput(event.endTime))
      patch.endTime = fromDateTimeInput(values.endTime);
    if (values.maxCapacity !== event.maxCapacity) patch.maxCapacity = values.maxCapacity;

    if (Object.keys(patch).length === 0) {
      stopEditing();
      return;
    }

    if (patch.startTime && Date.parse(patch.startTime) < Date.now()) {
      form.setError("startTime", { message: "Giờ bắt đầu không được ở quá khứ" });
      return;
    }

    try {
      await updateEvent.mutateAsync(patch);
      toast.success("Đã lưu thay đổi sự kiện");
      stopEditing();
    } catch (cause) {
      const error = toApiError(cause);
      if (error.code === "CAPACITY_BELOW_RESERVED") {
        form.setError("maxCapacity", { message: eventErrorText(error.code, error.message) });
        return;
      }
      setFormError(eventErrorText(error.code, error.message));
    }
  });

  const roomsCapacity = event.rooms.reduce((sum, room) => sum + room.capacity, 0);
  const liveSessions = event.sessions.filter((session) => session.isLive).length;
  const soldTickets = event.ticketTypes.reduce((sum, type) => sum + type.soldCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-label uppercase text-muted-foreground">Sức chứa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{formatNumber(event.maxCapacity)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Đã giữ chỗ {formatNumber(event.reservedCount)} ·{" "}
              {formatPercent(event.reservedCount, event.maxCapacity)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-label uppercase text-muted-foreground">Phòng</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{formatNumber(event.rooms.length)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng {formatNumber(roomsCapacity)} chỗ
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-label uppercase text-muted-foreground">Phiên</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{formatNumber(event.sessions.length)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(liveSessions)} đang diễn ra
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-label uppercase text-muted-foreground">Vé đã bán</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{formatNumber(soldTickets)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(event.ticketTypes.length)} loại vé
            </p>
          </CardContent>
        </Card>
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-headline">Sửa thông tin sự kiện</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                {formError ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>Chưa lưu được thay đổi</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <Field data-invalid={Boolean(form.formState.errors.name)}>
                    <FieldLabel htmlFor="event-name">Tên sự kiện</FieldLabel>
                    <Input
                      id="event-name"
                      aria-invalid={Boolean(form.formState.errors.name)}
                      {...form.register("name")}
                    />
                    <FieldError>{form.formState.errors.name?.message}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(form.formState.errors.venue)}>
                    <FieldLabel htmlFor="event-venue">Địa điểm</FieldLabel>
                    <Input
                      id="event-venue"
                      aria-invalid={Boolean(form.formState.errors.venue)}
                      {...form.register("venue")}
                    />
                    <FieldError>{form.formState.errors.venue?.message}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(form.formState.errors.startTime)}>
                    <FieldLabel htmlFor="event-start">Bắt đầu</FieldLabel>
                    <Input
                      id="event-start"
                      type="datetime-local"
                      aria-invalid={Boolean(form.formState.errors.startTime)}
                      {...form.register("startTime")}
                    />
                    <FieldError>{form.formState.errors.startTime?.message}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(form.formState.errors.endTime)}>
                    <FieldLabel htmlFor="event-end">Kết thúc</FieldLabel>
                    <Input
                      id="event-end"
                      type="datetime-local"
                      aria-invalid={Boolean(form.formState.errors.endTime)}
                      {...form.register("endTime")}
                    />
                    <FieldError>{form.formState.errors.endTime?.message}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(form.formState.errors.maxCapacity)}>
                    <FieldLabel htmlFor="event-capacity">Sức chứa</FieldLabel>
                    <Input
                      id="event-capacity"
                      type="number"
                      min={1}
                      aria-invalid={Boolean(form.formState.errors.maxCapacity)}
                      {...form.register("maxCapacity", { valueAsNumber: true })}
                    />
                    <FieldError>{form.formState.errors.maxCapacity?.message}</FieldError>
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={updateEvent.isPending}>
                    {updateEvent.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={stopEditing}>
                    Huỷ
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-title">Thông tin sự kiện</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[160px_1fr]">
                <dt className="text-muted-foreground">Địa điểm</dt>
                <dd className="text-foreground">{event.venue}</dd>
                <dt className="text-muted-foreground">Thời gian</dt>
                <dd className="text-foreground">{formatRange(event.startTime, event.endTime)}</dd>
                <dt className="text-muted-foreground">Tạo lúc</dt>
                <dd className="text-foreground">{formatDate(event.createdAt)}</dd>
                <dt className="text-muted-foreground">Mã sự kiện</dt>
                <dd className="font-mono text-xs text-foreground">{event.id}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title">Cấu trúc</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <Link to={routes.eventRooms(event.id)} className="text-primary hover:underline">
                    Phòng
                  </Link>
                  <span className="text-muted-foreground">
                    {formatNumber(event.rooms.length)} phòng · {formatNumber(roomsCapacity)} chỗ
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <Link
                    to={routes.eventSessions(event.id)}
                    className="text-primary hover:underline"
                  >
                    Phiên
                  </Link>
                  <span className="text-muted-foreground">
                    {formatNumber(event.sessions.length)} phiên · {formatNumber(liveSessions)} live
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <Link
                    to={routes.eventTicketTypes(event.id)}
                    className="text-primary hover:underline"
                  >
                    Loại vé
                  </Link>
                  <span className="text-muted-foreground">
                    {formatNumber(event.ticketTypes.length)} loại · {formatNumber(soldTickets)} đã
                    bán
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
