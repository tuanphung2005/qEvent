-- The session host/speaker drives Q&A, polls and quiz from the presenter screen.
-- Kept separate from ORGANIZER so a speaker cannot touch tickets, orders or capacity.
ALTER TYPE "Role" ADD VALUE 'HOST';
