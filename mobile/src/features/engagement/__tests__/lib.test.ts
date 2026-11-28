import { ApiError } from '@/api/errors';
import type { Game, Poll } from '../data';
import {
  connectionNote,
  correctOption,
  currentGameQuestion,
  engagementErrorText,
  optionLetter,
  pollPercent,
  pollTotal,
  secondsLeft,
} from '../lib';

const poll: Poll = {
  id: 'poll-1',
  sessionId: 'session-1',
  title: 'Bạn thấy thế nào?',
  isActive: true,
  createdAt: '2026-11-28T12:00:00.000Z',
  options: [
    { id: 'a', pollId: 'poll-1', content: 'Tốt', voteCount: 3 },
    { id: 'b', pollId: 'poll-1', content: 'Chưa tốt', voteCount: 1 },
  ],
};

function game(overrides: Partial<Game>): Game {
  return {
    id: 'game-1',
    sessionId: 'session-1',
    status: 'QUESTION_ACTIVE',
    currentQuestionIndex: 0,
    totalQuestions: 3,
    ...overrides,
  };
}

describe('poll helpers', () => {
  it('sums every option', () => {
    expect(pollTotal(poll)).toBe(4);
  });

  it('computes whole percentages and guards zero', () => {
    expect(pollPercent(3, 4)).toBe(75);
    expect(pollPercent(1, 4)).toBe(25);
    expect(pollPercent(0, 0)).toBe(0);
  });
});

describe('secondsLeft', () => {
  const startedAt = '2026-11-28T12:00:00.000Z';

  it('counts down from the server start time', () => {
    const now = Date.parse(startedAt) + 12_400;
    expect(secondsLeft(startedAt, 30, now)).toBe(18);
  });

  it('clamps at zero once the window is over', () => {
    const now = Date.parse(startedAt) + 45_000;
    expect(secondsLeft(startedAt, 30, now)).toBe(0);
  });

  it('returns zero without a start time', () => {
    expect(secondsLeft(null, 30, Date.now())).toBe(0);
  });
});

describe('quiz reveal gating', () => {
  const question = {
    id: 'q1',
    orderNum: 0,
    content: 'Câu hỏi',
    options: ['A', 'B'],
    correctOption: 0,
    timeLimitSec: 30,
    questionStartedAt: '2026-11-28T12:00:00.000Z',
  };

  it('never exposes the correct option before the reveal', () => {
    const active = game({ status: 'QUESTION_ACTIVE', currentQuestion: question });
    expect(currentGameQuestion(active)?.id).toBe('q1');
    expect(correctOption(active)).toBeNull();
  });

  it('exposes the correct option once the round is revealed', () => {
    const revealed = game({ status: 'ROUND_REVEALED', currentQuestion: question });
    expect(correctOption(revealed)).toBe(0);
  });

  it('has no current question while waiting', () => {
    expect(currentGameQuestion(game({ status: 'WAITING' }))).toBeUndefined();
  });
});

describe('optionLetter', () => {
  it('maps indexes to answer letters', () => {
    expect(optionLetter(0)).toBe('A');
    expect(optionLetter(3)).toBe('D');
  });
});

describe('engagementErrorText', () => {
  it('replaces closed answer windows with attendee copy', () => {
    const error = new ApiError(400, 'ANSWER_WINDOW_CLOSED', 'closed');
    expect(engagementErrorText(error)).toContain('Câu hỏi đã đóng');
  });

  it('tells the attendee they already answered', () => {
    const error = new ApiError(409, 'ALREADY_ANSWERED', 'duplicate');
    expect(engagementErrorText(error)).toContain('đã trả lời');
  });
});

describe('connectionNote', () => {
  it('shows a green live note while the socket is open', () => {
    expect(connectionNote('open')).toEqual({
      label: 'Đang cập nhật trực tiếp',
      tone: 'success',
    });
  });

  it('falls back to polling copy when the socket drops', () => {
    expect(connectionNote('polling')?.tone).toBe('warning');
    expect(connectionNote('polling')?.label).toContain('5 giây');
  });

  it('stays quiet while idle', () => {
    expect(connectionNote('idle')).toBeNull();
  });
});
