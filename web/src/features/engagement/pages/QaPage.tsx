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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import {
  AlertTriangle,
  ChevronUp,
  Clock,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import {
  useDeleteQuestion,
  useQuestions,
  useRestoreQuestion,
  useToggleVote,
  useUpdateQuestion,
} from "../api";
import type { QAQuestion } from "../types";

type OutletCtx = {
  activeSession: { id: string; title: string; isLive: boolean } | null;
  realtimeStatus: string;
};

export function QaPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { realtimeStatus } = useOutletContext<OutletCtx>();
  const { user } = useAuth();

  // If realtime is in fallback or offline, enable 5-second polling
  const pollingInterval =
    realtimeStatus === "fallback" || realtimeStatus === "offline" ? 5000 : false;

  const { data, isLoading, error } = useQuestions(sessionId, pollingInterval);
  const toggleVoteMutation = useToggleVote(sessionId ?? "");
  const deleteMutation = useDeleteQuestion(sessionId ?? "");
  const restoreMutation = useRestoreQuestion(sessionId ?? "");
  const updateMutation = useUpdateQuestion(sessionId ?? "");

  const [questionToDelete, setQuestionToDelete] = useState<QAQuestion | null>(null);
  const [questionToEdit, setQuestionToEdit] = useState<QAQuestion | null>(null);
  const [editContent, setEditContent] = useState("");

  const rawQuestions = data?.questions ?? [];
  const deletedQuestions = data?.deletedQuestions ?? [];
  // Sort descending by upvotes, then latest
  const sortedQuestions = [...rawQuestions].sort((a, b) => {
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const isStaffOrOrganizer = user?.role === "STAFF" || user?.role === "ORGANIZER";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Không tải được danh sách câu hỏi</AlertTitle>
        <AlertDescription>Thử lại sau ít phút hoặc tải lại trang.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" />
          <h2 className="text-title text-foreground">Hỏi &amp; Đáp trực tiếp</h2>
          <Badge variant="secondary" className="ml-1">
            {sortedQuestions.length} câu hỏi
          </Badge>
        </div>
      </div>

      {/* Empty State */}
      {sortedQuestions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Chưa có câu hỏi nào</EmptyTitle>
            <EmptyDescription>
              Khán giả sẽ đặt câu hỏi tại đây khi phiên thuyết trình bắt đầu. Câu hỏi nhận được
              nhiều bình chọn nhất sẽ hiển thị lên đầu.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {sortedQuestions.map((q) => (
            <Card key={q.id} className="group bg-card shadow-sm transition-all hover:shadow">
              <CardContent className="flex items-start gap-4 p-4">
                {/* Upvote Button (≥44px touch target) */}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground"
                  disabled={toggleVoteMutation.isPending}
                  onClick={() => toggleVoteMutation.mutate(q.id)}
                >
                  <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold leading-none">{q.upvotes}</span>
                  <span className="sr-only">phiếu bình chọn</span>
                </Button>

                {/* Content */}
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-relaxed text-foreground">{q.content}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {new Date(q.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Staff Actions (Edit / Delete Question) */}
                {isStaffOrOrganizer && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sửa câu hỏi"
                      className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      onClick={() => {
                        setQuestionToEdit(q);
                        setEditContent(q.content);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Xoá câu hỏi"
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
                      onClick={() => setQuestionToDelete(q)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Soft-deleted questions can be restored by staff */}
      {isStaffOrOrganizer && deletedQuestions.length > 0 && (
        <Card className="border-card-border">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">
              Câu hỏi đã xoá ({deletedQuestions.length})
            </p>
            <div className="space-y-2">
              {deletedQuestions.map((question) => (
                <div
                  key={question.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-secondary p-3"
                >
                  <p className="min-w-0 truncate text-sm text-muted-foreground line-through">
                    {question.content}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(question.id)}
                  >
                    <RotateCcw className="size-4" />
                    Khôi phục
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit question dialog */}
      <Dialog
        open={Boolean(questionToEdit)}
        onOpenChange={(open) => !open && setQuestionToEdit(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!questionToEdit || !editContent.trim()) return;
              updateMutation.mutate(
                { questionId: questionToEdit.id, content: editContent.trim() },
                { onSuccess: () => setQuestionToEdit(null) },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Sửa câu hỏi</DialogTitle>
              <DialogDescription>
                Nội dung mới hiển thị ngay trên bảng tương tác; số phiếu bình chọn được giữ nguyên.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                aria-label="Nội dung câu hỏi"
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                maxLength={500}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="h-8"
                onClick={() => setQuestionToEdit(null)}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                className="h-8"
                disabled={updateMutation.isPending || !editContent.trim()}
              >
                {updateMutation.isPending ? "Đang lưu..." : "Lưu câu hỏi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deleting Question */}
      <AlertDialog
        open={Boolean(questionToDelete)}
        onOpenChange={(open) => !open && setQuestionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xoá câu hỏi?</AlertDialogTitle>
            <AlertDialogDescription>
              Câu hỏi này sẽ ẩn khỏi bảng tương tác của phiên. Khôi phục được ở mục “Câu hỏi đã
              xoá”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
              onClick={() => {
                if (questionToDelete) {
                  deleteMutation.mutate(questionToDelete.id);
                  setQuestionToDelete(null);
                }
              }}
            >
              Xác nhận xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
