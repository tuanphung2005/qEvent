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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { AlertTriangle, ChevronUp, Clock, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { useDeleteQuestion, useQuestions, useToggleVote } from "../api";
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

  const [questionToDelete, setQuestionToDelete] = useState<QAQuestion | null>(null);

  const rawQuestions = data?.questions ?? [];
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

                {/* Staff Actions (Delete Question) */}
                {isStaffOrOrganizer && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Xoá câu hỏi"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setQuestionToDelete(q)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Deleting Question */}
      <AlertDialog
        open={Boolean(questionToDelete)}
        onOpenChange={(open) => !open && setQuestionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xoá câu hỏi?</AlertDialogTitle>
            <AlertDialogDescription>
              Câu hỏi này sẽ bị gỡ bỏ khỏi bảng tương tác của phiên. Hành động này không thể hoàn
              tác.
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
