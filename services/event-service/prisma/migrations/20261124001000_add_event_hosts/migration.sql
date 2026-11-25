-- A HOST may only drive sessions inside the events assigned here.
-- The user id is an admission-service scalar; no cross-database foreign key.
CREATE TABLE "EventHost" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventHost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventHost_eventId_userId_key" ON "EventHost"("eventId", "userId");
CREATE INDEX "EventHost_userId_idx" ON "EventHost"("userId");

ALTER TABLE "EventHost" ADD CONSTRAINT "EventHost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
