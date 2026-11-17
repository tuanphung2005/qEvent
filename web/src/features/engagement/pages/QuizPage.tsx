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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { CheckCircle2, ChevronRight, Eye, Play, Plus, Radio, Square, Trophy } from "lucide-react";
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import {
  useAddGameQuestion,
  useCreateSessionGame,
  useEndGame,
  useGameLeaderboard,
  useNextGameQuestion,
  useRevealGameAnswer,
  useSessionGame,
  useStartGame,
} from "../api";

type OutletCtx = {
  activeSession: { id: string; title: string; isLive: boolean } | null;
  realtimeStatus: string;
};

export function QuizPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { realtimeStatus } = useOutletContext<OutletCtx>();
  const { user } = useAuth();

  const pollingInterval =
    realtimeStatus === "fallback" || realtimeStatus === "offline" ? 5000 : false;

  const { data: gameData, isLoading, error } = useSessionGame(sessionId, pollingInterval);
  const game = gameData?.game ?? null;

  // Leaderboard query
  const { data: lbData } = useGameLeaderboard(game?.id, pollingInterval);
  const leaderboard = lbData?.leaderboard ?? [];

  // Mutations
  const createGameMutation = useCreateSessionGame(sessionId ?? "");
  const addQuestionMutation = useAddGameQuestion(sessionId ?? "", game?.id ?? "");
  const startMutation = useStartGame(sessionId ?? "");
  const revealMutation = useRevealGameAnswer(sessionId ?? "");
  const nextMutation = useNextGameQuestion(sessionId ?? "");
  const endMutation = useEndGame(sessionId ?? "");

  // Modal / Confirm States
  const [openAddQuestion, setOpenAddQuestion] = useState(false);
  const [qContent, setQContent] = useState("");
  const [qOptions, setQOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [timeLimit, setTimeLimit] = useState(30);

  const [confirmAction, setConfirmAction] = useState<"next" | "end" | null>(null);

  const isStaffOrOrganizer = user?.role === "STAFF" || user?.role === "ORGANIZER";

  const handleAddQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOpts = qOptions.map((o) => o.trim()).filter(Boolean);
    if (!qContent.trim() || cleanOpts.length < 2) return;

    addQuestionMutation.mutate(
      {
        content: qContent.trim(),
        options: cleanOpts,
        correctOption: correctIdx,
        timeLimitSec: timeLimit,
      },
      {
        onSuccess: () => {
          setQContent("");
          setQOptions(["", "", "", ""]);
          setCorrectIdx(0);
          setTimeLimit(30);
          setOpenAddQuestion(false);
        },
      },
    );
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
      <div className="rounded-xl bg-destructive/10 p-4 text-center text-sm text-destructive">
        Không thể tải thông tin Quiz game. Vui lòng thử lại sau.
      </div>
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
              className="h-11 gap-2 shadow-sm"
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
                <Badge variant="default" className="bg-amber-600 animate-pulse">
                  Đang trả lời
                </Badge>
              )}
              {game.status === "ROUND_REVEALED" && (
                <Badge variant="default" className="bg-emerald-600">
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
                  <Dialog open={openAddQuestion} onOpenChange={setOpenAddQuestion}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="h-10 gap-1.5">
                        <Plus className="size-4" />
                        <span>Thêm câu hỏi</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[540px]">
                      <form onSubmit={handleAddQuestionSubmit}>
                        <DialogHeader>
                          <DialogTitle>Thêm câu hỏi Quiz mới</DialogTitle>
                          <DialogDescription>
                            Nhập nội dung câu hỏi, thời gian giới hạn và chọn đáp án chính xác.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="space-y-1.5">
                            <span className="block text-sm font-medium text-foreground">
                              Nội dung câu hỏi
                            </span>
                            <Input
                              placeholder="Ví dụ: Công nghệ nào xử lý phân tán trong microservices?"
                              value={qContent}
                              onChange={(e) => setQContent(e.target.value)}
                              required
                              className="h-11"
                            />
                          </div>

                          <div className="space-y-2">
                            <span className="block text-sm font-medium text-foreground">
                              Các lựa chọn (Tích chọn phương án đúng)
                            </span>
                            {qOptions.map((opt, idx) => (
                              <div
                                key={`choice-${String.fromCharCode(65 + idx)}`}
                                className="flex items-center gap-2"
                              >
                                <Button
                                  type="button"
                                  variant={correctIdx === idx ? "default" : "outline"}
                                  size="sm"
                                  className="h-11 w-11 shrink-0 font-bold"
                                  onClick={() => setCorrectIdx(idx)}
                                >
                                  {String.fromCharCode(65 + idx)}
                                </Button>
                                <Input
                                  placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const next = [...qOptions];
                                    next[idx] = e.target.value;
                                    setQOptions(next);
                                  }}
                                  required
                                  className="h-11"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11"
                            onClick={() => setOpenAddQuestion(false)}
                          >
                            Huỷ
                          </Button>
                          <Button
                            type="submit"
                            className="h-11"
                            disabled={
                              addQuestionMutation.isPending ||
                              !qContent.trim() ||
                              qOptions.filter((o) => o.trim()).length < 2
                            }
                          >
                            {addQuestionMutation.isPending ? "Đang lưu..." : "Lưu câu hỏi"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Button
                    className="h-10 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
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
                  className="h-10 gap-1.5 bg-primary"
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
                    className="h-10 gap-1.5 bg-primary"
                    disabled={nextMutation.isPending}
                    onClick={() => setConfirmAction("next")}
                  >
                    <ChevronRight className="size-4" />
                    <span>Câu tiếp theo</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 gap-1.5 text-destructive hover:bg-destructive/10"
                    disabled={endMutation.isPending}
                    onClick={() => setConfirmAction("end")}
                  >
                    <Square className="size-4" />
                    <span>Kết thúc Game</span>
                  </Button>
                </>
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
              <h3 className="text-base font-semibold text-foreground">{currentQ.content}</h3>
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
                        ? "bg-emerald-100 text-emerald-900 font-semibold"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-xs font-bold shadow-sm">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1 text-sm">{opt}</span>
                    {isRevealed && isCorrect && (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Leaderboard Section */}
      <Card className="bg-card shadow-sm">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
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
                          ? "bg-amber-400 text-amber-950"
                          : item.rank === 2
                            ? "bg-slate-300 text-slate-900"
                            : item.rank === 3
                              ? "bg-amber-600 text-amber-50"
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

      {/* Confirmation Dialog for Sensitive Actions (next/end) */}
      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "next"
                ? "Chuyển sang câu hỏi tiếp theo?"
                : "Kết thúc trò chơi Quiz?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "next"
                ? "Khán giả sẽ được chuyển ngay sang câu hỏi kế tiếp và không thể tiếp tục gửi đáp án cho câu hỏi này."
                : "Game sẽ chính thức khép lại và hiển thị bảng xếp hạng chung cuộc cho toàn bộ phiên."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                if (confirmAction === "next") {
                  nextMutation.mutate(game.id);
                } else if (confirmAction === "end") {
                  endMutation.mutate(game.id);
                }
                setConfirmAction(null);
              }}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
