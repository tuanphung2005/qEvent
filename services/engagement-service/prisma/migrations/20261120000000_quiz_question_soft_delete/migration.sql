-- Soft delete for quiz questions: a deleted question keeps its answers and can
-- be restored, so hosts can undo a mis-click during a live session.
ALTER TABLE "QuizQuestion" ADD COLUMN "deletedAt" TIMESTAMP(3);
