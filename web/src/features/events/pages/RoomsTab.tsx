import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { Room } from "@/lib/api/types";
import { formatNumber } from "@/lib/format/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useOutletContext } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateRoom, useUpdateRoom } from "../api";
import { type EventTabContext, eventErrorText } from "../types";

const schema = z.object({
  name: z.string().trim().min(1, "Nhập tên phòng"),
  capacity: z
    .number({ invalid_type_error: "Nhập sức chứa" })
    .int("Sức chứa là số nguyên")
    .min(1, "Sức chứa tối thiểu 1"),
});

type FormValues = z.infer<typeof schema>;

function RoomDialog({
  eventId,
  room,
  open,
  onOpenChange,
}: {
  eventId: string;
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createRoom = useCreateRoom(eventId);
  const updateRoom = useUpdateRoom(eventId);
  const [formError, setFormError] = useState<string | null>(null);
  const pending = createRoom.isPending || updateRoom.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { name: room?.name ?? "", capacity: room?.capacity ?? 100 },
  });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    form.reset({ name: room?.name ?? "", capacity: room?.capacity ?? 100 });
  }, [open, room, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (room) {
        await updateRoom.mutateAsync({ roomId: room.id, body: values });
        toast.success("Đã cập nhật phòng");
      } else {
        await createRoom.mutateAsync(values);
        toast.success("Đã thêm phòng");
      }
      onOpenChange(false);
    } catch (cause) {
      const error = toApiError(cause);
      setFormError(eventErrorText(error.code, error.message));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Sửa phòng" : "Thêm phòng"}</DialogTitle>
          <DialogDescription>
            Sức chứa phòng dùng để đối chiếu khi chia khu vực soát vé.
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
              <FieldLabel htmlFor="room-name">Tên phòng</FieldLabel>
              <Input
                id="room-name"
                placeholder="Main Hall"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.capacity)}>
              <FieldLabel htmlFor="room-capacity">Sức chứa</FieldLabel>
              <Input
                id="room-capacity"
                type="number"
                min={1}
                aria-invalid={Boolean(form.formState.errors.capacity)}
                {...form.register("capacity", { valueAsNumber: true })}
              />
              <FieldError>{form.formState.errors.capacity?.message}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : room ? "Lưu thay đổi" : "Thêm phòng"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoomsTab() {
  const { event } = useOutletContext<EventTabContext>();
  const { user } = useAuth();
  const canEdit = user?.role === "ORGANIZER";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditing(room);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-headline text-foreground">Phòng</h2>
          <p className="text-sm text-muted-foreground">
            {formatNumber(event.rooms.length)} phòng · tổng{" "}
            {formatNumber(event.rooms.reduce((sum, room) => sum + room.capacity, 0))} chỗ
          </p>
        </div>
        {canEdit ? (
          <Button onClick={openCreate}>
            <Plus />
            Thêm phòng
          </Button>
        ) : null}
      </header>

      <Card className="min-w-0 py-0 [contain:inline-size]">
        <CardContent className="p-0">
          {event.rooms.length === 0 ? (
            <Empty className="p-10">
              <EmptyHeader>
                <EmptyTitle>Chưa có phòng</EmptyTitle>
                <EmptyDescription>
                  Thêm phòng để chia khu vực và đối chiếu sức chứa khi soát vé.
                </EmptyDescription>
              </EmptyHeader>
              {canEdit ? (
                <Button variant="secondary" className="mt-2" onClick={openCreate}>
                  Thêm phòng đầu tiên
                </Button>
              ) : null}
            </Empty>
          ) : (
            <Table aria-label="Danh sách phòng">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-label uppercase text-muted-foreground">
                    Phòng
                  </TableHead>
                  <TableHead className="text-right text-label uppercase text-muted-foreground">
                    Sức chứa
                  </TableHead>
                  {canEdit ? <TableHead className="w-24" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-semibold text-foreground">{room.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(room.capacity)}</TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(room)}>
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
        <RoomDialog eventId={event.id} room={editing} open={open} onOpenChange={setOpen} />
      ) : null}
    </div>
  );
}
