import { useQuery } from '@tanstack/react-query';

import { api, recordServerDate } from '@/api/client';
import { unwrap } from '@/api/errors';
import type { components as EngagementComponents } from '@/api/generated/engagement';

export type QAQuestion = EngagementComponents['schemas']['QAQuestion'] & {
  /** Runtime field; the OpenAPI schema omits it. */
  votedUserIds?: string[];
};

export type PollOption = EngagementComponents['schemas']['PollOption'];

export type Poll = EngagementComponents['schemas']['Poll'] & {
  /** Runtime field; null when the caller has not voted in this poll. */
  userVotedOptionId?: string | null;
};

export type Game = EngagementComponents['schemas']['Game'];
export type GameQuestion = EngagementComponents['schemas']['GameQuestion'] & {
  displayMode?: 'FULL' | 'LETTERS';
  correctLetter?: string;
};
export type LeaderboardEntry = EngagementComponents['schemas']['LeaderboardEntry'];

export type QuestionsResponse = {
  sessionId: string;
  questions: QAQuestion[];
};

export type PollsResponse = {
  sessionId: string;
  polls: Poll[];
};

export const engagementKeys = {
  questions: (sessionId: string) => ['engagement', 'questions', sessionId] as const,
  polls: (sessionId: string) => ['engagement', 'polls', sessionId] as const,
  game: (sessionId: string) => ['engagement', 'game', sessionId] as const,
  leaderboard: (gameId: string) => ['engagement', 'leaderboard', gameId] as const,
};

export async function fetchQuestions(sessionId: string): Promise<QuestionsResponse> {
  const result = await api.GET('/api/sessions/{sessionId}/questions', {
    params: { path: { sessionId } },
  });
  recordServerDate(result.response);
  return unwrap(result) as QuestionsResponse;
}

export async function fetchPolls(sessionId: string): Promise<PollsResponse> {
  const result = await api.GET('/api/sessions/{sessionId}/polls', {
    params: { path: { sessionId } },
  });
  recordServerDate(result.response);
  return unwrap(result) as PollsResponse;
}

export async function fetchGame(sessionId: string): Promise<Game> {
  const result = await api.GET('/api/sessions/{sessionId}/game', {
    params: { path: { sessionId } },
  });
  recordServerDate(result.response);
  const summary = unwrap(result).game;

  // The session-level endpoint is the host-facing summary; the attendee view
  // with `currentQuestion` (and the revealed correctOption) lives on /api/game/:id.
  if (!summary?.id) return summary;

  const detail = await api.GET('/api/game/{gameId}', {
    params: { path: { gameId: summary.id } },
  });
  recordServerDate(detail.response);
  return unwrap(detail).game;
}

export async function fetchLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
  const result = await api.GET('/api/game/{gameId}/leaderboard', {
    params: { path: { gameId } },
  });
  recordServerDate(result.response);
  return unwrap(result).leaderboard;
}

export function useQuestions(sessionId: string) {
  return useQuery({
    queryKey: engagementKeys.questions(sessionId),
    queryFn: () => fetchQuestions(sessionId),
    staleTime: 5_000,
  });
}

export function usePolls(sessionId: string) {
  return useQuery({
    queryKey: engagementKeys.polls(sessionId),
    queryFn: () => fetchPolls(sessionId),
    staleTime: 5_000,
  });
}

export function useGame(sessionId: string) {
  return useQuery({
    queryKey: engagementKeys.game(sessionId),
    queryFn: () => fetchGame(sessionId),
    staleTime: 5_000,
    retry: false,
  });
}

export function useLeaderboard(gameId: string | undefined) {
  return useQuery({
    queryKey: engagementKeys.leaderboard(gameId ?? 'unknown'),
    queryFn: () => fetchLeaderboard(gameId as string),
    enabled: Boolean(gameId),
    staleTime: 5_000,
  });
}
