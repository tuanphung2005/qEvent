-- Offline devices pull tickets incrementally: eventId + updatedAt supports
-- `?since=` without scanning the whole ticket table.
ALTER TABLE "Ticket" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Ticket_eventId_updatedAt_idx" ON "Ticket"("eventId", "updatedAt");
