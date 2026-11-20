import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { TicketType } from "@/lib/api/types";
import { formatMoney, formatNumber } from "@/lib/format/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useOutletContext } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateTicketType, useUpdateTicketType } from "../api";
import { type EventTabContext, eventErrorText } from "../types";

const schema = z.object({
  name: z.string().trim().min(1, "Nhập tên loại vé"),
  price: z.number({ invalid_type_error: "Nhập giá vé" }).min(0, "Giá vé không được âm"),
  quota: z
    .number({ invalid_type_error: "Nhập quota" })
    .int("Quota là số nguyên")
    .min(1, "Quota tối thiểu 1"),
});

type FormValues = z.infer<typeof schema>;

function TicketTypeDialog({
  eventId,
  ticketType,
  maxCapacity,
  open,
  onOpenChange,
}: {
  eventId: string;
  ticketType: TicketType | null;
  maxCapacity: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createType = useCreateTicketType(eventId);
  const updateType = useUpdateTicketType(eventId);
  const [formError, setFormError] = useState<string | null>(null);
  const pending = createType.isPending || updateType.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      name: ticketType?.name ?? "",
      price: ticketType?.price ?? 0,
      quota: ticketType?.quota ?? 100,
    },
  });
  const quota = form.watch("quota");

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    form.reset({
      name: ticketType?.name ?? "",
      price: ticketType?.price ?? 0,
      quota: ticketType?.quota ?? 100,
    });
  }, [open, ticketType, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (ticketType) {
        await updateType.mutateAsync({ ticketTypeId: ticketType.id, body: values });
        toast.success("Đã cập nhật loại vé");
      } else {
        await createType.mutateAsync(values);
        toast.success("Đã thêm loại vé");
      }
      onOpenChange(false);
    } catch (cause) {
      const error = toApiError(cause);
      if (error.code === "QUOTA_BELOW_SOLD") {
        form.setError("quota", { message: eventErrorText(error.code, error.message) });
        return;
      }
      setFormError(eventErrorText(error.code, error.message));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ticketType ? "Sửa loại vé" : "Thêm loại vé"}</DialogTitle>
          <DialogDescription>
            Quota không được thấp hơn số vé đã bán. Quota vượt sức chứa vẫn lưu được.
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
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor="tt-name">Tên loại vé</FieldLabel>
              <Input
                id="tt-name"
                placeholder="Standard"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.price)}>
                <FieldLabel htmlFor="tt-price">Giá (₫)</FieldLabel>
                <Input
                  id="tt-price"
                  type="number"
                  min={0}
                  step={1000}
                  aria-invalid={Boolean(form.formState.errors.price)}
                  {...form.register("price", { valueAsNumber: true })}
                />
                <FieldError>{form.formState.errors.price?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.quota)}>
                <FieldLabel htmlFor="tt-quota">Quota</FieldLabel>
                <Input
                  id="tt-quota"
                  type="number"
                  min={1}
                  aria-invalid={Boolean(form.formState.errors.quota)}
                  {...form.register("quota", { valueAsNumber: true })}
                />
                <FieldError>{form.formState.errors.quota?.message}</FieldError>
              </Field>
            </div>
            {Number.isFinite(quota) && quota > maxCapacity ? (
              <Alert className="bg-warning-subtle text-warning">
                <AlertTriangle />
                <AlertDescription className="text-warning">
                  Quota {formatNumber(quota)} vượt sức chứa sự kiện ({formatNumber(maxCapacity)}).
                  Vẫn lưu được nhưng có thể không phát hành hết vé.
                </AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : ticketType ? "Lưu thay đổi" : "Thêm loại vé"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TicketTypesTab() {
  const { event } = useOutletContext<EventTabContext>();
  const { user } = useAuth();
  const canEdit = user?.role === "ORGANIZER";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TicketType | null>(null);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (ticketType: TicketType) => {
    setEditing(ticketType);
    setOpen(true);
  };

  const sold = event.ticketTypes.reduce((sum, type) => sum + type.soldCount, 0);
  const overCapacity = event.ticketTypes.filter((type) => type.quota > event.maxCapacity);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-headline text-foreground">Loại vé</h2>
          <p className="text-sm text-muted-foreground">
            {formatNumber(event.ticketTypes.length)} loại · {formatNumber(sold)} vé đã bán
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate}>
            <Plus />
            Thêm loại vé
          </Button>
        ) : null}
      </header>

      {overCapacity.length > 0 ? (
        <Alert className="bg-warning-subtle text-warning">
          <AlertTriangle />
          <AlertTitle className="text-warning">Có loại vé vượt sức chứa sự kiện</AlertTitle>
          <AlertDescription className="text-warning">
            {overCapacity.map((type) => type.name).join(", ")} có quota lớn hơn{" "}
            {formatNumber(event.maxCapacity)}. Giảm quota hoặc tăng sức chứa để tránh bán quá chỗ.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="min-w-0 py-0 [contain:inline-size]">
        <CardContent className="p-0">
          {event.ticketTypes.length === 0 ? (
            <Empty className="p-10">
              <EmptyHeader>
                <EmptyTitle>Chưa có loại vé</EmptyTitle>
                <EmptyDescription>
                  Thêm loại vé với giá và quota để bắt đầu bán vé cho sự kiện.
                </EmptyDescription>
              </EmptyHeader>
              {canEdit ? (
                <Button variant="secondary" className="mt-2" onClick={openCreate}>
                  Thêm loại vé đầu tiên
                </Button>
              ) : null}
            </Empty>
          ) : (
            <Table aria-label="Danh sách loại vé">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-label uppercase text-muted-foreground">
                    Loại vé
                  </TableHead>
                  <TableHead className="text-right text-label uppercase text-muted-foreground">
                    Giá
                  </TableHead>
                  <TableHead className="text-right text-label uppercase text-muted-foreground">
                    Quota
                  </TableHead>
                  <TableHead className="text-right text-label uppercase text-muted-foreground">
                    Đã bán
                  </TableHead>
                  <TableHead className="text-right text-label uppercase text-muted-foreground">
                    Còn lại
                  </TableHead>
                  {canEdit ? <TableHead className="w-24" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.ticketTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-semibold text-foreground">{type.name}</TableCell>
                    <TableCell className="text-right">{formatMoney(type.price)}</TableCell>
                    <TableCell className="text-right">{formatNumber(type.quota)}</TableCell>
                    <TableCell className="text-right">{formatNumber(type.soldCount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(type.available)}</TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(type)}>
                          Sửa
                        </Button>
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
        <TicketTypeDialog
          eventId={event.id}
          ticketType={editing}
          maxCapacity={event.maxCapacity}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}
