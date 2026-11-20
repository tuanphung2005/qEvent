import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { GameQuestion } from "../types";

type DeletedQuestion = { id: string; content: string };

/**
 * Question list for a WAITING game, plus the soft-deleted rows a host can
 * restore. Presentational only: mutations live in the page that owns the game.
 */
export function QuizQuestionList({
  questions,
  deletedQuestions,
  canEdit,
  restoring,
  onEdit,
  onDelete,
  onRestore,
}: {
  questions: GameQuestion[];
  deletedQuestions: DeletedQuestion[];
  canEdit: boolean;
  restoring: boolean;
  onEdit: (question: GameQuestion) => void;
  onDelete: (question: GameQuestion) => void;
  onRestore: (questionId: string) => void;
}) {
  return (
    <>
      <Card className="bg-card shadow-sm">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            Danh sách câu hỏi ({questions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2">
          {questions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Chưa có câu hỏi. Thêm ít nhất một câu trước khi bắt đầu game.
            </p>
          ) : (
            <div className="space-y-2">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-secondary p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Câu {index + 1}: {question.content}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {question.options.length} lựa chọn · Đáp án{" "}
                      {String.fromCharCode(65 + (question.correctOption ?? 0))} ·{" "}
                      {question.timeLimitSec ?? 30}s
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Sửa câu hỏi ${index + 1}`}
                        className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        onClick={() => onEdit(question)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xoá câu hỏi ${index + 1}`}
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
                        onClick={() => onDelete(question)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {deletedQuestions.length > 0 && (
        <Card className="bg-card shadow-sm">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Câu hỏi đã xoá ({deletedQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-2">
            <p className="mb-2 text-sm text-muted-foreground">
              Khôi phục để đưa câu hỏi trở lại danh sách, giữ nguyên đáp án đã ghi nhận.
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
                    disabled={restoring}
                    onClick={() => onRestore(question.id)}
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
    </>
  );
}
