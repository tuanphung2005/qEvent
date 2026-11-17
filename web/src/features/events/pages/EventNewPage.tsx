import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { toApiError } from "@/lib/api/errors";
import { routes } from "@/lib/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateEvent } from "../api";
import { eventErrorText, fromDateTimeInput } from "../types";

const roomSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên phòng"),
  capacity: z
    .number({ invalid_type_error: "Nhập sức chứa" })
    .int("Sức chứa là số nguyên")
    .min(1, "Sức chứa tối thiểu 1"),
});

const sessionSchema = z
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

const ticketTypeSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên loại vé"),
  price: z.number({ invalid_type_error: "Nhập giá vé" }).min(0, "Giá vé không được âm"),
  quota: z
    .number({ invalid_type_error: "Nhập quota" })
    .int("Quota là số nguyên")
    .min(1, "Quota tối thiểu 1"),
});

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
    rooms: z.array(roomSchema),
    sessions: z.array(sessionSchema),
    ticketTypes: z.array(ticketTypeSchema),
  })
  .refine(
    (values) =>
      !values.startTime ||
      !values.endTime ||
      Date.parse(fromDateTimeInput(values.startTime)) <
        Date.parse(fromDateTimeInput(values.endTime)),
    { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] },
  )
  .refine(
    (values) => !values.startTime || Date.parse(fromDateTimeInput(values.startTime)) >= Date.now(),
    { message: "Giờ bắt đầu không được ở quá khứ", path: ["startTime"] },
  );

type FormValues = z.infer<typeof schema>;

export function EventNewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createEvent = useCreateEvent();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      venue: "",
      startTime: "",
      endTime: "",
      maxCapacity: 100,
      rooms: [],
      sessions: [],
      ticketTypes: [],
    },
  });

  const rooms = useFieldArray({ control: form.control, name: "rooms" });
  const sessions = useFieldArray({ control: form.control, name: "sessions" });
  const ticketTypes = useFieldArray({ control: form.control, name: "ticketTypes" });

  if (user?.role !== "ORGANIZER") {
    return (
      <Card className="p-8">
        <p className="text-headline text-foreground">Bạn không có quyền tạo sự kiện</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Chỉ tài khoản ban tổ chức được tạo và sửa sự kiện. Nhân sự soát vé vẫn xem được danh sách.
        </p>
        <Button asChild variant="secondary" className="mt-6 w-fit">
          <Link to={routes.events()}>Về danh sách sự kiện</Link>
        </Button>
      </Card>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await createEvent.mutateAsync({
        name: values.name.trim(),
        venue: values.venue.trim(),
        startTime: fromDateTimeInput(values.startTime),
        endTime: fromDateTimeInput(values.endTime),
        maxCapacity: values.maxCapacity,
        rooms: values.rooms.map((room) => ({
          name: room.name.trim(),
          capacity: room.capacity,
        })),
        sessions: values.sessions.map((session) => ({
          title: session.title.trim(),
          speaker: session.speaker.trim(),
          startTime: fromDateTimeInput(session.startTime),
          endTime: fromDateTimeInput(session.endTime),
          isLive: session.isLive,
        })),
        ticketTypes: values.ticketTypes.map((type) => ({
          name: type.name.trim(),
          price: type.price,
          quota: type.quota,
        })),
      });
      toast.success("Đã tạo sự kiện");
      navigate(routes.event(result.event.id));
    } catch (cause) {
      const error = toApiError(cause);
      setFormError(eventErrorText(error.code, error.message));
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to={routes.events()}
            className="w-fit text-sm text-muted-foreground hover:text-primary"
          >
            ← Danh sách sự kiện
          </Link>
          <h1 className="text-display text-foreground">Tạo sự kiện</h1>
          <p className="text-sm text-muted-foreground">
            Tạo sự kiện cùng phòng, phiên và loại vé trong một lần. Có thể bổ sung sau.
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {formError ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Chưa tạo được sự kiện</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-title">Thông tin sự kiện</CardTitle>
            <CardDescription>Tên, địa điểm và khung thời gian diễn ra.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(form.formState.errors.name)}>
                  <FieldLabel htmlFor="new-name">Tên sự kiện</FieldLabel>
                  <Input
                    id="new-name"
                    placeholder="Tech Summit Vietnam 2026"
                    aria-invalid={Boolean(form.formState.errors.name)}
                    {...form.register("name")}
                  />
                  <FieldError>{form.formState.errors.name?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.venue)}>
                  <FieldLabel htmlFor="new-venue">Địa điểm</FieldLabel>
                  <Input
                    id="new-venue"
                    placeholder="Saigon Exhibition and Convention Center"
                    aria-invalid={Boolean(form.formState.errors.venue)}
                    {...form.register("venue")}
                  />
                  <FieldError>{form.formState.errors.venue?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.startTime)}>
                  <FieldLabel htmlFor="new-start">Bắt đầu</FieldLabel>
                  <Input
                    id="new-start"
                    type="datetime-local"
                    aria-invalid={Boolean(form.formState.errors.startTime)}
                    {...form.register("startTime")}
                  />
                  <FieldError>{form.formState.errors.startTime?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.endTime)}>
                  <FieldLabel htmlFor="new-end">Kết thúc</FieldLabel>
                  <Input
                    id="new-end"
                    type="datetime-local"
                    aria-invalid={Boolean(form.formState.errors.endTime)}
                    {...form.register("endTime")}
                  />
                  <FieldError>{form.formState.errors.endTime?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.maxCapacity)}>
                  <FieldLabel htmlFor="new-capacity">Sức chứa</FieldLabel>
                  <Input
                    id="new-capacity"
                    type="number"
                    min={1}
                    aria-invalid={Boolean(form.formState.errors.maxCapacity)}
                    {...form.register("maxCapacity", { valueAsNumber: true })}
                  />
                  <FieldError>{form.formState.errors.maxCapacity?.message}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title">Phòng</CardTitle>
            <CardDescription>
              Không bắt buộc. Sức chứa từng phòng không vượt quá sự kiện.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {rooms.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có phòng. Thêm phòng nếu cần chia khu vực soát vé.
              </p>
            ) : null}
            {rooms.fields.map((field, index) => {
              const errors = form.formState.errors.rooms?.[index];
              return (
                <div key={field.id} className="rounded-lg bg-secondary p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
                    <Field data-invalid={Boolean(errors?.name)}>
                      <FieldLabel htmlFor={`room-${index}-name`}>Tên phòng</FieldLabel>
                      <Input
                        id={`room-${index}-name`}
                        placeholder="Main Hall"
                        aria-invalid={Boolean(errors?.name)}
                        {...form.register(`rooms.${index}.name`)}
                      />
                      <FieldError>{errors?.name?.message}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors?.capacity)}>
                      <FieldLabel htmlFor={`room-${index}-capacity`}>Sức chứa</FieldLabel>
                      <Input
                        id={`room-${index}-capacity`}
                        type="number"
                        min={1}
                        aria-invalid={Boolean(errors?.capacity)}
                        {...form.register(`rooms.${index}.capacity`, { valueAsNumber: true })}
                      />
                      <FieldError>{errors?.capacity?.message}</FieldError>
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xoá phòng ${index + 1}`}
                      onClick={() => rooms.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() => rooms.append({ name: "", capacity: 100 })}
            >
              <Plus />
              Thêm phòng
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title">Phiên</CardTitle>
            <CardDescription>
              Phiên là ngữ cảnh cho Q&A, poll và quiz. Bật live khi phiên bắt đầu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sessions.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có phiên. Thêm phiên để host tương tác với người tham dự.
              </p>
            ) : null}
            {sessions.fields.map((field, index) => {
              const errors = form.formState.errors.sessions?.[index];
              return (
                <div key={field.id} className="rounded-lg bg-secondary p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field data-invalid={Boolean(errors?.title)}>
                      <FieldLabel htmlFor={`session-${index}-title`}>Tiêu đề</FieldLabel>
                      <Input
                        id={`session-${index}-title`}
                        placeholder="Opening Keynote"
                        aria-invalid={Boolean(errors?.title)}
                        {...form.register(`sessions.${index}.title`)}
                      />
                      <FieldError>{errors?.title?.message}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors?.speaker)}>
                      <FieldLabel htmlFor={`session-${index}-speaker`}>Diễn giả</FieldLabel>
                      <Input
                        id={`session-${index}-speaker`}
                        placeholder="Alex Nguyen"
                        aria-invalid={Boolean(errors?.speaker)}
                        {...form.register(`sessions.${index}.speaker`)}
                      />
                      <FieldError>{errors?.speaker?.message}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors?.startTime)}>
                      <FieldLabel htmlFor={`session-${index}-start`}>Bắt đầu</FieldLabel>
                      <Input
                        id={`session-${index}-start`}
                        type="datetime-local"
                        aria-invalid={Boolean(errors?.startTime)}
                        {...form.register(`sessions.${index}.startTime`)}
                      />
                      <FieldError>{errors?.startTime?.message}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors?.endTime)}>
                      <FieldLabel htmlFor={`session-${index}-end`}>Kết thúc</FieldLabel>
                      <Input
                        id={`session-${index}-end`}
                        type="datetime-local"
                        aria-invalid={Boolean(errors?.endTime)}
                        {...form.register(`sessions.${index}.endTime`)}
                      />
                      <FieldError>{errors?.endTime?.message}</FieldError>
                    </Field>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label
                      htmlFor={`session-${index}-live`}
                      className="flex h-11 items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        id={`session-${index}-live`}
                        checked={form.watch(`sessions.${index}.isLive`)}
                        onCheckedChange={(checked) =>
                          form.setValue(`sessions.${index}.isLive`, checked === true, {
                            shouldDirty: true,
                          })
                        }
                      />
                      Bật live ngay
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xoá phiên ${index + 1}`}
                      onClick={() => sessions.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() =>
                sessions.append({
                  title: "",
                  speaker: "",
                  startTime: "",
                  endTime: "",
                  isLive: false,
                })
              }
            >
              <Plus />
              Thêm phiên
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-title">Loại vé</CardTitle>
            <CardDescription>
              Giá tính bằng đồng. Quota vượt sức chứa vẫn lưu được nhưng nên cân đối.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ticketTypes.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có loại vé. Thêm ít nhất một loại vé để mở bán.
              </p>
            ) : null}
            {ticketTypes.fields.map((field, index) => {
              const errors = form.formState.errors.ticketTypes?.[index];
              return (
                <div key={field.id} className="rounded-lg bg-secondary p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
                    <Field data-invalid={Boolean(errors?.name)}>
                      <FieldLabel htmlFor={`tt-${index}-name`}>Tên loại vé</FieldLabel>
                      <Input
                        id={`tt-${index}-name`}
                        placeholder="Standard"
                        aria-invalid={Boolean(errors?.name)}
                        {...form.register(`ticketTypes.${index}.name`)}
                      />
                      <FieldError>{errors?.name?.message}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors?.price)}>
                      <FieldLabel htmlFor={`tt-${index}-price`}>Giá (₫)</FieldLabel>
                      <Input
                        id={`tt-${index}-price`}
                        type="number"
                        min={0}
                        step={1000}
                        aria-invalid={Boolean(errors?.price)}
                        {...form.register(`ticketTypes.${index}.price`, { valueAsNumber: true })}
                      />
                      <FieldError>{errors?.price?.message}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors?.quota)}>
                      <FieldLabel htmlFor={`tt-${index}-quota`}>Quota</FieldLabel>
                      <Input
                        id={`tt-${index}-quota`}
                        type="number"
                        min={1}
                        aria-invalid={Boolean(errors?.quota)}
                        {...form.register(`ticketTypes.${index}.quota`, { valueAsNumber: true })}
                      />
                      <FieldError>{errors?.quota?.message}</FieldError>
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xoá loại vé ${index + 1}`}
                      onClick={() => ticketTypes.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() => ticketTypes.append({ name: "", price: 0, quota: 100 })}
            >
              <Plus />
              Thêm loại vé
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Sự kiện tạo xong sẽ mở trang chi tiết.</p>
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link to={routes.events()}>Huỷ</Link>
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? "Đang tạo…" : "Tạo sự kiện"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
