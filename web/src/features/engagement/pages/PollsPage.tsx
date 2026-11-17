import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { Activity, AlertTriangle, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { useCreatePoll, usePolls, useUpdatePoll } from "../api";

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

  // Create Poll Dialog State
  const [openCreate, setOpenCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (!title.trim() || cleanOptions.length < 2) return;

    createPollMutation.mutate(
      { title: title.trim(), options: cleanOptions },
      {
        onSuccess: () => {
          setTitle("");
          setOptions(["", ""]);
          setOpenCreate(false);
        },
      },
    );
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
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="h-11 gap-1.5 shadow-sm">
                <Plus className="size-4" />
                <span>Tạo khảo sát mới</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Tạo khảo sát bình chọn</DialogTitle>
                  <DialogDescription>
                    Tạo câu hỏi bình chọn trực tiếp với từ 2 đến 10 phương án lựa chọn.
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
                      className="h-11"
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
                          className="h-11"
                        />
                        {options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Xoá lựa chọn ${idx + 1}`}
                            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
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
                    className="h-11"
                    onClick={() => setOpenCreate(false)}
                  >
                    Huỷ
                  </Button>
                  <Button
                    type="submit"
                    className="h-11"
                    disabled={
                      createPollMutation.isPending ||
                      !title.trim() ||
                      options.filter((o) => o.trim()).length < 2
                    }
                  >
                    {createPollMutation.isPending ? "Đang tạo..." : "Tạo khảo sát"}
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

                  {/* Host Toggle Open / Close Poll */}
                  {isStaffOrOrganizer && (
                    <Button
                      variant={poll.isActive ? "destructive" : "secondary"}
                      size="sm"
                      className="h-10 gap-1.5"
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
    </div>
  );
}
