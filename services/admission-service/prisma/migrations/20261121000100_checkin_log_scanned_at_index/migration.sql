-- The check-in feed filters by scannedAt (`?since=`); without this index the
-- table is scanned as the event day grows.
CREATE INDEX "CheckinLog_scannedAt_idx" ON "CheckinLog"("scannedAt");
