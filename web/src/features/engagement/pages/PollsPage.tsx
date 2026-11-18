import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { Activity, AlertTriangle, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { useCreatePoll, useDeletePoll, usePolls, useUpdatePoll } from "../api";
import type { Poll } from "../types";

type OutletCtx = {
  activeSession: { id: string; title: string; isLive: boolean } | null;
  realtimeStatus: string;
};

export function PollsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { realtimeStatus } = useOutletContext<OutletCtx>();
  const { user } = useAuth();

  const pollingInterval =
    realtimeStatus === "fallback" || realtimeStatus === "offline" ? 5000 : false;

  const { data, isLoading, error } = usePolls(sessionId, pollingInterval);
  const createPollMutation = useCreatePoll(sessionId ?? "");
  const updatePollMutation = useUpdatePoll(sessionId ?? "");
  const deletePollMutation = useDeletePoll(sessionId ?? "");

  // One dialog serves create and edit; `editingPoll` is null while creating.
  const [openForm, setOpenForm] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);

  const polls = data?.polls ?? [];
  const isStaffOrOrganizer = user?.role === "STAFF" || user?.role === "ORGANIZER";

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const openCreateForm = () => {
    setEditingPoll(null);
    setTitle("");
    setOptions(["", ""]);
    setOpenForm(true);
  };

  const openEditForm = (poll: Poll) => {
    setEditingPoll(poll);
    setTitle(poll.title);
    setOptions(poll.options.map((option) => option.content));
    setOpenForm(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (!title.trim() || cleanOptions.length < 2) return;

    const onSuccess = () => {
      setTitle("");
      setOptions(["", ""]);
      setEditingPoll(null);
      setOpenForm(false);
    };

    if (editingPoll) {
      updatePollMutation.mutate(
        { pollId: editingPoll.id, title: title.trim(), options: cleanOptions },
        { onSuccess },
      );
      return;
    }

    createPollMutation.mutate({ title: title.trim(), options: cleanOptions }, { onSuccess });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Không tải được danh sách khảo sát</AlertTitle>
        <AlertDescription>Thử lại sau ít phút hoặc tải lại trang.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <h2 className="text-title text-foreground">Khảo sát &amp; Bình chọn</h2>
          <Badge variant="secondary" className="ml-1">
            {polls.length} khảo sát
          </Badge>
        </div>

        {isStaffOrOrganizer && (
          <Dialog open={openForm} onOpenChange={setOpenForm}>
            <Button className="gap-1.5" onClick={openCreateForm}>
              <Plus className="size-4" />
              <span>Tạo khảo sát mới</span>
            </Button>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingPoll ? "Sửa khảo sát bình chọn" : "Tạo khảo sát bình chọn"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPoll
                      ? "Đổi tiêu đề hoặc phương án. Phương án mới sẽ đặt lại số phiếu đã bình chọn."
                      : "Tạo câu hỏi bình chọn trực tiếp với từ 2 đến 10 phương án lựa chọn."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <Field>
                    <FieldLabel htmlFor="poll-title">Nội dung khảo sát</FieldLabel>
                    <Input
                      id="poll-title"
                      placeholder="Ví dụ: Bạn thấy bài diễn thuyết hôm nay thế nào?"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="h-8"
                    />
                  </Field>

                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-foreground">
                      Các lựa chọn (2 - 10 lựa chọn)
                    </span>
                    {options.map((opt, idx) => (
                      <div key={`poll-option-${idx + 1}`} className="flex items-center gap-2">
                        <Input
                          aria-label={`Lựa chọn ${idx + 1}`}
                          placeholder={`Lựa chọn ${idx + 1}`}
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          required
                          className="h-8"
                        />
                        {options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Xoá lựa chọn ${idx + 1}`}
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveOption(idx)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {options.length < 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 w-full gap-1.5"
                        onClick={handleAddOption}
                      >
                        <Plus className="size-4" />
                        <span>Thêm lựa chọn</span>
                      </Button>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8"
                    onClick={() => setOpenForm(false)}
                  >
                    Huỷ
                  </Button>
                  <Button
                    type="submit"
                    className="h-8"
                    disabled={
                      createPollMutation.isPending ||
                      updatePollMutation.isPending ||
                      !title.trim() ||
                      options.filter((o) => o.trim()).length < 2
                    }
                  >
                    {createPollMutation.isPending || updatePollMutation.isPending
                      ? "Đang lưu..."
                      : editingPoll
                        ? "Lưu thay đổi"
                        : "Tạo khảo sát"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* List Polls */}
      {polls.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Chưa có khảo sát nào</EmptyTitle>
            <EmptyDescription>
              Tạo khảo sát đầu tiên để thu thập ý kiến khán giả trong phiên thuyết trình.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voteCount, 0);

            return (
              <Card key={poll.id} className="bg-card shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6 pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold text-foreground">
                        {poll.title}
                      </CardTitle>
                      {poll.isActive ? (
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          Đang mở
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Đã đóng</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tổng số: {totalVotes} lượt bình chọn
                    </p>
                  </div>

                  {/* Host actions: open/close, edit, delete */}
                  {isStaffOrOrganizer && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={poll.isActive ? "destructive" : "secondary"}
                        size="sm"
                        className="h-8 gap-1.5"
                        disabled={updatePollMutation.isPending}
                        onClick={() =>
                          updatePollMutation.mutate({
                            pollId: poll.id,
                            isActive: !poll.isActive,
                          })
                        }
                      >
                        <Power className="size-4" />
                        <span>{poll.isActive ? "Đóng bình chọn" : "Mở lại"}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => openEditForm(poll)}
                      >
                        <Pencil className="size-4" />
                        <span>Sửa</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Xoá khảo sát ${poll.title}`}
                        className="h-8 gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setPollToDelete(poll)}
                      >
                        <Trash2 className="size-4" />
                        <span>Xoá</span>
                      </Button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 p-4 sm:p-6 pt-2">
                  {poll.options.map((opt) => {
                    const percentage =
                      totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;

                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span className="text-foreground">{opt.content}</span>
                          <span className="text-muted-foreground">
                            {opt.voteCount} phiếu ({percentage}%)
                          </span>
                        </div>
                        {/* Progress: shadcn Progress, surface separation without border */}
                        <Progress
                          value={percentage}
                          aria-label={`${opt.content}: ${percentage}%`}
                          className="h-3"
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(pollToDelete)}
        onOpenChange={(open) => !open && setPollToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá khảo sát?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pollToDelete?.title}” cùng toàn bộ phiếu bình chọn sẽ bị xoá. Hành động này không
              thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 bg-destructive text-primary-foreground hover:bg-destructive/90"
              disabled={deletePollMutation.isPending}
              onClick={() => {
                if (pollToDelete) deletePollMutation.mutate(pollToDelete.id);
                setPollToDelete(null);
              }}
            >
              Xoá khảo sát
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
