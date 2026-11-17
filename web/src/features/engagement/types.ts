import type {
  Game,
  GameQuestion,
  LeaderboardEntry,
  Poll,
  PollOption,
  QAQuestion,
  SessionStats,
} from "@/lib/api/types";

export type { Game, GameQuestion, LeaderboardEntry, Poll, PollOption, QAQuestion, SessionStats };

export type EngagementTab = "qa" | "polls" | "quiz";

export type CreateQuestionInput = {
  content: string;
};

export type CreatePollInput = {
  title: string;
  options: string[];
};

export type AddGameQuestionInput = {
  content: string;
  options: string[];
  correctOption: number;
  timeLimitSec: number;
};
