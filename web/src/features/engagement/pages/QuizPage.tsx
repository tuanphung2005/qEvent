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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Square,
  Trash2,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import {
  useAddGameQuestion,
  useCreateSessionGame,
  useDeleteGameQuestion,
  useEndGame,
  useGameLeaderboard,
  useNextGameQuestion,
  useRestartGame,
  useRestoreGameQuestion,
  useRevealGameAnswer,
  useSessionGame,
  useStartGame,
  useUpdateGameQuestion,
} from "../api";
import type { GameQuestion } from "../types";
import { QuizQuestionList } from "./QuizQuestionList";

type OutletCtx = {
  activeSession: { id: string; title: string; isLive: boolean } | null;
  realtimeStatus: string;
};

type DraftOption = { id: string; value: string };

const newOption = (value = ""): DraftOption => ({ id: crypto.randomUUID(), value });

export function QuizPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { realtimeStatus } = useOutletContext<OutletCtx>();
  const { user } = useAuth();

  const pollingInterval =
    realtimeStatus === "fallback" || realtimeStatus === "offline" ? 5000 : false;

  const { data: gameData, isLoading, error } = useSessionGame(sessionId, pollingInterval);
  const game = gameData?.game ?? null;
  const deletedQuestions = gameData?.deletedQuestions ?? [];

  // Leaderboard query
  const { data: lbData } = useGameLeaderboard(game?.id, pollingInterval);
  const leaderboard = lbData?.leaderboard ?? [];

  // Mutations
  const createGameMutation = useCreateSessionGame(sessionId ?? "");
  const addQuestionMutation = useAddGameQuestion(sessionId ?? "", game?.id ?? "");
  const updateQuestionMutation = useUpdateGameQuestion(sessionId ?? "");
  const deleteQuestionMutation = useDeleteGameQuestion(sessionId ?? "");
  const restoreQuestionMutation = useRestoreGameQuestion(sessionId ?? "");
  const startMutation = useStartGame(sessionId ?? "");
  const revealMutation = useRevealGameAnswer(sessionId ?? "");
  const nextMutation = useNextGameQuestion(sessionId ?? "");
  const endMutation = useEndGame(sessionId ?? "");
  const restartMutation = useRestartGame(sessionId ?? "");

  // Modal / Confirm States
  const [openQuestionForm, setOpenQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<GameQuestion | null>(null);
  const [qContent, setQContent] = useState("");
  const [qOptions, setQOptions] = useState<DraftOption[]>(() => [newOption(), newOption()]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [timeLimit, setTimeLimit] = useState(30);

  const [questionToDelete, setQuestionToDelete] = useState<GameQuestion | null>(null);
  const [confirmAction, setConfirmAction] = useState<"next" | "end" | "restart" | null>(null);

  const isStaffOrOrganizer =
    user?.role === "STAFF" || user?.role === "HOST" || user?.role === "ORGANIZER";

  const openCreateQuestion = () => {
    setEditingQuestion(null);
    setQContent("");
    setQOptions([newOption(), newOption()]);
    setCorrectIdx(0);
    setTimeLimit(30);
    setOpenQuestionForm(true);
  };

  const openEditQuestion = (question: GameQuestion) => {
    setEditingQuestion(question);
    setQContent(question.content);
    setQOptions(question.options.map((option) => newOption(option)));
    setCorrectIdx(question.correctOption ?? 0);
    setTimeLimit(question.timeLimitSec ?? 30);
    setOpenQuestionForm(true);
  };

  const updateOption = (index: number, value: string) => {
    setQOptions((current) =>
      current.map((option, i) => (i === index ? { ...option, value } : option)),
    );
  };

  const addOption = () => {
    setQOptions((current) => (current.length < 6 ? [...current, newOption()] : current));
  };

  const removeOption = (index: number) => {
    setQOptions((current) => {
      if (current.length <= 2) return current;
      const next = current.filter((_, i) => i !== index);
      setCorrectIdx((prev) => (prev === index ? 0 : prev > index ? prev - 1 : prev));
      return next;
    });
  };

  const handleAddQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Keep positions: filtering blanks would shift `correctOption`.
    const cleanOpts = qOptions.map((option) => option.value.trim());
    if (!qContent.trim() || cleanOpts.length < 2 || cleanOpts.some((o) => !o)) return;

    const input = {
      content: qContent.trim(),
      options: cleanOpts,
      correctOption: correctIdx,
      timeLimitSec: timeLimit,
    };
    const onSuccess = () => {
      setEditingQuestion(null);
      setQContent("");
      setQOptions([newOption(), newOption()]);
      setCorrectIdx(0);
      setTimeLimit(30);
      setOpenQuestionForm(false);
    };

    if (editingQuestion && game) {
      updateQuestionMutation.mutate(
        { gameId: game.id, questionId: editingQuestion.id, ...input },
        { onSuccess },
      );
      return;
    }
    addQuestionMutation.mutate(input, { onSuccess });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Không tải được Quiz game</AlertTitle>
        <AlertDescription>Thử lại sau ít phút hoặc tải lại trang.</AlertDescription>
      </Alert>
    );
  }

  // If no game exists for this session
  if (!game) {
    return (
      <div className="space-y-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Chưa có Quiz Game nào</EmptyTitle>
            <EmptyDescription>
              Khởi tạo một game trắc nghiệm tương tác trực tiếp cho khán giả trong phiên này.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        {isStaffOrOrganizer && (
          <div className="flex justify-center">
            <Button
              className="gap-2"
              disabled={createGameMutation.isPending}
              onClick={() => createGameMutation.mutate()}
            >
              <Radio className="size-4" />
              <span>Khởi tạo Game mới</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  const questions = game.questions ?? [];
  const currentIdx = game.currentQuestionIndex ?? 0;
  const currentQ = questions[currentIdx] ?? null;

  return (
    <div className="space-y-6">
      {/* Game State Header & Controls */}
      <Card className="bg-card shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-foreground">
                Trò chơi Trắc nghiệm trực tiếp
              </CardTitle>
              {game.status === "WAITING" && <Badge variant="secondary">Đang chuẩn bị</Badge>}
              {game.status === "QUESTION_ACTIVE" && (
                <Badge variant="secondary" className="bg-warning-subtle text-warning">
                  <span
                    className="size-2 animate-pulse rounded-full bg-warning"
                    aria-hidden="true"
                  />
                  Đang trả lời
                </Badge>
              )}
              {game.status === "ROUND_REVEALED" && (
                <Badge variant="secondary" className="bg-success-subtle text-success">
                  Đã công bố đáp án
                </Badge>
              )}
              {game.status === "FINISHED" && <Badge variant="outline">Đã kết thúc</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Tổng số {questions.length} câu hỏi • Câu hiện tại:{" "}
              {questions.length > 0 ? currentIdx + 1 : 0} / {questions.length}
            </p>
          </div>

          {/* Action Buttons for Host / Staff */}
          {isStaffOrOrganizer && (
            <div className="flex flex-wrap items-center gap-2">
              {game.status === "WAITING" && (
                <>
                  <Dialog open={openQuestionForm} onOpenChange={setOpenQuestionForm}>
                    <Button variant="outline" className="h-8 gap-1.5" onClick={openCreateQuestion}>
                      <Plus className="size-4" />
                      <span>Thêm câu hỏi</span>
                    </Button>
                    <DialogContent className="sm:max-w-[540px]">
                      <form onSubmit={handleAddQuestionSubmit}>
                        <DialogHeader>
                          <DialogTitle>
                            {editingQuestion ? "Sửa câu hỏi Quiz" : "Thêm câu hỏi Quiz mới"}
                          </DialogTitle>
                          <DialogDescription>
                            Nhập nội dung câu hỏi, thời gian giới hạn và chọn đáp án chính xác.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <Field>
                            <FieldLabel htmlFor="quiz-question-content">
                              Nội dung câu hỏi
                            </FieldLabel>
                            <Input
                              id="quiz-question-content"
                              placeholder="Ví dụ: Công nghệ nào xử lý phân tán trong microservices?"
                              value={qContent}
                              onChange={(e) => setQContent(e.target.value)}
                              required
                              className="h-8"
                            />
                          </Field>

                          <div className="space-y-2">
                            <span className="block text-sm font-medium text-foreground">
                              Các lựa chọn (2–6, tích chọn phương án đúng)
                            </span>
                            {qOptions.map((opt, idx) => (
                              <div key={opt.id} className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant={correctIdx === idx ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 w-8 shrink-0 font-bold"
                                  aria-label={`Chọn ${String.fromCharCode(65 + idx)} là đáp án đúng`}
                                  aria-pressed={correctIdx === idx}
                                  onClick={() => setCorrectIdx(idx)}
                                >
                                  {String.fromCharCode(65 + idx)}
                                </Button>
                                <Input
                                  aria-label={`Lựa chọn ${String.fromCharCode(65 + idx)}`}
                                  placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}`}
                                  value={opt.value}
                                  onChange={(e) => updateOption(idx, e.target.value)}
                                  required
                                  className="h-8"
                                />
                                {qOptions.length > 2 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Xoá lựa chọn ${String.fromCharCode(65 + idx)}`}
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
                                    onClick={() => removeOption(idx)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            {qOptions.length < 6 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-full gap-1.5"
                                onClick={addOption}
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
                            onClick={() => setOpenQuestionForm(false)}
                          >
                            Huỷ
                          </Button>
                          <Button
                            type="submit"
                            className="h-8"
                            disabled={
                              addQuestionMutation.isPending ||
                              updateQuestionMutation.isPending ||
                              !qContent.trim() ||
                              qOptions.some((option) => !option.value.trim())
                            }
                          >
                            {addQuestionMutation.isPending || updateQuestionMutation.isPending
                              ? "Đang lưu..."
                              : editingQuestion
                                ? "Lưu thay đổi"
                                : "Lưu câu hỏi"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Button
                    className="h-8 gap-1.5"
                    disabled={startMutation.isPending || questions.length === 0}
                    onClick={() => startMutation.mutate(game.id)}
                  >
                    <Play className="size-4" />
                    <span>Bắt đầu Game</span>
                  </Button>
                </>
              )}

              {game.status === "QUESTION_ACTIVE" && (
                <Button
                  className="h-10 gap-1.5"
                  disabled={revealMutation.isPending}
                  onClick={() => revealMutation.mutate(game.id)}
                >
                  <Eye className="size-4" />
                  <span>Công bố đáp án</span>
                </Button>
              )}

              {game.status === "ROUND_REVEALED" && (
                <>
                  <Button
                    variant="default"
                    className="h-10 gap-1.5"
                    disabled={nextMutation.isPending}
                    onClick={() => setConfirmAction("next")}
                  >
                    <ChevronRight className="size-4" />
                    <span>Câu tiếp theo</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 gap-1.5 text-destructive hover:bg-destructive-subtle"
                    disabled={endMutation.isPending}
                    onClick={() => setConfirmAction("end")}
                  >
                    <Square className="size-4" />
                    <span>Kết thúc Game</span>
                  </Button>
                </>
              )}

              {(game.status === "FINISHED" || game.status === "ROUND_REVEALED") && (
                <Button
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={restartMutation.isPending || startMutation.isPending}
                  onClick={() => setConfirmAction("restart")}
                >
                  <RotateCcw className="size-4" />
                  <span>Chơi lại</span>
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        {/* Current Active Question Display */}
        {currentQ && game.status !== "WAITING" && (
          <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
            <div className="rounded-xl bg-secondary p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Câu hỏi {currentIdx + 1}
                </span>
                <span className="text-xs text-muted-foreground">
                  Thời gian: {currentQ.timeLimitSec ?? 30}s
                </span>
              </div>
              <h3 className="text-title text-foreground">{currentQ.content}</h3>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {currentQ.options.map((opt, idx) => {
                const isCorrect = currentQ.correctOption === idx;
                const isRevealed = game.status === "ROUND_REVEALED";

                return (
                  <div
                    key={`opt-${currentQ.id ?? "q"}-${idx}`}
                    className={`flex items-center gap-3 rounded-xl p-3.5 transition-colors ${
                      isRevealed && isCorrect
                        ? "bg-success-subtle font-semibold text-success"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-xs font-bold shadow-sm">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1 text-sm">{opt}</span>
                    {isRevealed && isCorrect && (
                      <CheckCircle2 className="size-5 shrink-0 text-success" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Question list — only editable while the game is WAITING */}
      {game.status === "WAITING" && (
        <QuizQuestionList
          questions={questions}
          deletedQuestions={deletedQuestions}
          canEdit={isStaffOrOrganizer}
          restoring={restoreQuestionMutation.isPending}
          onEdit={openEditQuestion}
          onDelete={setQuestionToDelete}
          onRestore={(questionId: string) =>
            restoreQuestionMutation.mutate({ gameId: game.id, questionId })
          }
        />
      )}

      {/* Leaderboard Section */}
      <Card className="bg-card shadow-sm">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-warning" />
            <CardTitle className="text-base font-semibold text-foreground">
              Bảng xếp hạng trực tiếp
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2">
          {leaderboard.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu xếp hạng. Khán giả trả lời đúng sẽ xuất hiện tại đây.
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((item) => (
                <div
                  key={item.userId}
                  className="flex items-center justify-between rounded-xl bg-secondary p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm ${
                        item.rank === 1
                          ? "bg-warning text-primary-foreground"
                          : item.rank <= 3
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-background text-foreground"
                      }`}
                    >
                      {item.rank}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      Người tham gia ({item.userId.slice(-6)})
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm font-semibold">
                    <span className="text-muted-foreground">{item.correctCount} câu đúng</span>
                    <span className="text-primary">{item.totalScore} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Sensitive Actions (next/end/delete game) */}
      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "next"
                ? "Chuyển sang câu hỏi tiếp theo?"
                : confirmAction === "restart"
                  ? "Chơi lại Quiz game?"
                  : "Kết thúc trò chơi Quiz?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "next"
                ? "Khán giả sẽ được chuyển ngay sang câu hỏi kế tiếp và không thể tiếp tục gửi đáp án cho câu hỏi này."
                : confirmAction === "restart"
                  ? "Điểm và câu trả lời của lượt trước sẽ bị xoá; câu hỏi được giữ nguyên và game bắt đầu lại từ câu đầu."
                  : "Game sẽ chính thức khép lại và hiển thị bảng xếp hạng chung cuộc cho toàn bộ phiên."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="h-8"
              onClick={() => {
                if (confirmAction === "next") {
                  nextMutation.mutate(game.id);
                } else if (confirmAction === "end") {
                  endMutation.mutate(game.id);
                } else if (confirmAction === "restart") {
                  restartMutation.mutate(game.id, {
                    onSuccess: () => startMutation.mutate(game.id),
                  });
                }
                setConfirmAction(null);
              }}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete question confirmation */}
      <AlertDialog
        open={Boolean(questionToDelete)}
        onOpenChange={(open) => !open && setQuestionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá câu hỏi Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              “{questionToDelete?.content}” sẽ ẩn khỏi game. Khôi phục được ở mục “Câu hỏi đã xoá”.
              Chỉ xoá được khi game chưa bắt đầu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 bg-destructive text-primary-foreground hover:bg-destructive/90"
              disabled={deleteQuestionMutation.isPending}
              onClick={() => {
                if (questionToDelete && game) {
                  deleteQuestionMutation.mutate({
                    gameId: game.id,
                    questionId: questionToDelete.id,
                  });
                }
                setQuestionToDelete(null);
              }}
            >
              Xoá câu hỏi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
