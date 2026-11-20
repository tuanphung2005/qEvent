-- Soft delete for host-generated content: a deleted question or poll keeps its
-- votes and can be restored. Quiz questions got the same treatment earlier.
ALTER TABLE "QAQuestion" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Poll" ADD COLUMN "deletedAt" TIMESTAMP(3);
