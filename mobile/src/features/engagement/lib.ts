import { ApiError, toNetworkError } from '@/api/errors';
import type { RealtimeStatus } from '@/lib/realtime/use-realtime';
import type { Game, GameQuestion, Poll } from './data';

const COPY: Record<string, string> = {
  POLL_INACTIVE: 'Bình chọn đã đóng nên không thể gửi phiếu.',
  POLL_NOT_FOUND: 'Bình chọn này không còn tồn tại.',
  INVALID_OPTION: 'Lựa chọn không hợp lệ. Tải lại rồi thử lại.',
  ANSWER_WINDOW_CLOSED: 'Câu hỏi đã đóng, không nhận câu trả lời nữa.',
  ANSWER_TOO_LATE: 'Bạn trả lời quá muộn so với giới hạn thời gian.',
  ALREADY_ANSWERED: 'Bạn đã trả lời câu này rồi.',
  NOT_CURRENT_QUESTION: 'Câu hỏi đã chuyển sang câu khác. Chờ câu tiếp theo.',
  QUESTION_NOT_STARTED: 'Câu hỏi chưa bắt đầu. Thử lại sau vài giây.',
  GAME_NOT_FOUND: 'Phiên này chưa có quiz.',
  QUESTION_NOT_FOUND: 'Câu hỏi này không còn tồn tại.',
};

export function engagementErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    return COPY[error.code] ?? error.message;
  }
  return toNetworkError(error).message;
}

export function pollTotal(poll: Poll): number {
  return poll.options.reduce((sum, option) => sum + option.voteCount, 0);
}

export function pollPercent(voteCount: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((voteCount / total) * 100);
}

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Seconds left in the current quiz question, measured on the server clock.
 * The answer is clamped to [0, timeLimitSec].
 */
export function secondsLeft(
  questionStartedAt: string | null | undefined,
  timeLimitSec: number,
  now: number
): number {
  if (!questionStartedAt || timeLimitSec <= 0) return 0;
  const started = Date.parse(questionStartedAt);
  if (Number.isNaN(started)) return 0;
  const elapsed = (now - started) / 1000;
  return Math.max(0, Math.min(timeLimitSec, Math.ceil(timeLimitSec - elapsed)));
}

/**
 * Attendees only get `currentQuestion` while a question is active or revealed.
 * A finished game exposes the full question list instead.
 */
export function currentGameQuestion(game: Game | undefined): GameQuestion | undefined {
  if (!game?.currentQuestion) return undefined;
  return game.currentQuestion as GameQuestion;
}

export function correctOption(game: Game | undefined): number | null {
  const question = currentGameQuestion(game);
  if (game?.status !== 'ROUND_REVEALED' || question?.correctOption === undefined) {
    return null;
  }
  return question.correctOption;
}

export function connectionNote(status: RealtimeStatus): {
  label: string;
  tone: 'success' | 'warning';
} | null {
  switch (status) {
    case 'open':
      return { label: 'Đang cập nhật trực tiếp', tone: 'success' };
    case 'polling':
      return { label: 'Mất kết nối trực tiếp — làm mới mỗi 5 giây', tone: 'warning' };
    case 'reconnecting':
    case 'connecting':
      return { label: 'Đang kết nối lại…', tone: 'warning' };
    default:
      return null;
  }
}
