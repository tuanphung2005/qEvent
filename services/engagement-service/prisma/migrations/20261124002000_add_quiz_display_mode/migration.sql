-- Attendee phone display: full question + options, or only A/B/C/D keys.
ALTER TABLE "QuizGame" ADD COLUMN "displayMode" TEXT NOT NULL DEFAULT 'FULL';
