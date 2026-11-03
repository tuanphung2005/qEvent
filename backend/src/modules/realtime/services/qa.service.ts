import { prisma } from "../../../plugins/prisma";
import { broadcastToSession } from "./broadcast.service";
import { checkUserSessionAccess, getSessionLiveStatus, handleToggleVote } from "./session-access.service";
import { tallyOptions } from "./poll-format.service";

/**
 * Nghiệp vụ Q&A dùng chung cho REST và WebSocket.
 *
 * Trước đây mỗi thao tác được viết 2 lần (route + WS case), và bản WS tin
 * `userId` do client gửi lên — cho phép mạo danh. Mọi hàm ở đây chỉ nhận
 * `userId` đã được xác thực từ token.
 *
 * `GateFailure.body` giữ nguyên payload mà route REST vẫn trả, để refactor
 * không đổi response. `code` là mã ổn định cho client WS.
 */

export type GateFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404;
  code: string;
  body: { error: string; message?: string };
};

const fail = (
  status: GateFailure["status"],
  code: string,
  error: string,
  message?: string
): GateFailure => ({
  ok: false,
  status,
  code,
  body: message === undefined ? { error } : { error, message },
});

export async function postQuestion(input: {
  sessionId: string;
  userId: string | null | undefined;
  content: string;
}): Promise<{ ok: true; question: any } | GateFailure> {
  if (!input.userId) {
    return fail(401, "UNAUTHORIZED", "Vui lòng đăng nhập để gửi câu hỏi");
  }

  const { isLive } = await getSessionLiveStatus(input.sessionId);
  if (!isLive) {
    return fail(
      403,
      "EVENT_NOT_LIVE",
      "EVENT_NOT_LIVE",
      "Phiên hỏi đáp chỉ hoạt động trong thời gian sự kiện đang diễn ra"
    );
  }

  const access = await checkUserSessionAccess(input.sessionId, input.userId);
  if (!access.isCheckedIn) {
    return fail(
      403,
      "NOT_CHECKED_IN",
      "NOT_CHECKED_IN",
      "Bạn cần điểm danh tại cổng để kích hoạt quyền đặt câu hỏi"
    );
  }

  const question = await prisma.qAQuestion.create({
    data: {
      sessionId: input.sessionId,
      userId: input.userId,
      content: input.content.trim(),
    },
    include: {
      user: { select: { id: true, fullName: true } },
      votes: { select: { userId: true } },
    },
  });

  broadcastToSession(input.sessionId, { type: "QUESTION_ADDED", question });
  // Tên event cũ, client mobile vẫn đang lắng nghe.
  broadcastToSession(input.sessionId, { type: "NEW_QUESTION", question });

  return { ok: true, question };
}

export async function upvoteQuestion(input: {
  questionId: string;
  userId: string | null | undefined;
}): Promise<{ ok: true; question: any; hasVoted: boolean } | GateFailure> {
  if (!input.userId) {
    return fail(401, "UNAUTHORIZED", "Vui lòng đăng nhập để bình chọn");
  }

  const target = await prisma.qAQuestion.findUnique({ where: { id: input.questionId } });
  if (!target) {
    return fail(404, "QUESTION_NOT_FOUND", "Question not found");
  }

  const { isLive } = await getSessionLiveStatus(target.sessionId);
  if (!isLive) {
    return fail(
      403,
      "EVENT_NOT_LIVE",
      "EVENT_NOT_LIVE",
      "Chỉ có thể bình chọn câu hỏi trong thời gian sự kiện diễn ra"
    );
  }

  const access = await checkUserSessionAccess(target.sessionId, input.userId);
  if (!access.isCheckedIn) {
    return fail(
      403,
      "NOT_CHECKED_IN",
      "NOT_CHECKED_IN",
      "Bạn cần điểm danh tại cổng để tham gia bình chọn câu hỏi"
    );
  }

  const { question, hasVoted } = await handleToggleVote(input.questionId, input.userId);

  broadcastToSession(question.sessionId, {
    type: "VOTE_UPDATED",
    questionId: question.id,
    upvotes: question.upvotes,
    userId: input.userId,
    hasVoted,
  });
  broadcastToSession(question.sessionId, {
    type: "QUESTION_UPVOTED",
    questionId: question.id,
    upvotes: question.upvotes,
  });

  return { ok: true, question, hasVoted };
}

export async function votePoll(input: {
  pollId: string;
  optionId: string;
  userId: string | null | undefined;
}): Promise<
  | { ok: true; pollId: string; totalVotes: number; tally: unknown; userVotedOptionId: string }
  | GateFailure
> {
  if (!input.userId) {
    return fail(401, "UNAUTHORIZED", "Vui lòng đăng nhập để bình chọn");
  }

  const poll = await prisma.poll.findUnique({ where: { id: input.pollId } });
  if (!poll) {
    return fail(404, "POLL_NOT_FOUND", "Poll not found");
  }

  if (!poll.isActive) {
    return fail(400, "POLL_CLOSED", "POLL_CLOSED", "Câu hỏi tương tác này đã đóng");
  }

  const { isLive } = await getSessionLiveStatus(poll.sessionId);
  if (!isLive) {
    return fail(
      403,
      "EVENT_NOT_LIVE",
      "EVENT_NOT_LIVE",
      "Câu hỏi tương tác chỉ mở trong thời gian sự kiện diễn ra"
    );
  }

  const access = await checkUserSessionAccess(poll.sessionId, input.userId);
  if (!access.isCheckedIn) {
    return fail(
      403,
      "NOT_CHECKED_IN",
      "NOT_CHECKED_IN",
      "Bạn cần điểm danh tại cổng để tham gia trả lời câu hỏi tương tác"
    );
  }

  // Upsert: một user một phiếu cho mỗi poll.
  await prisma.pollVote.upsert({
    where: { pollId_userId: { pollId: poll.id, userId: input.userId } },
    create: { pollId: poll.id, optionId: input.optionId, userId: input.userId },
    update: { optionId: input.optionId },
  });

  const updatedPoll = await prisma.poll.findUnique({
    where: { id: poll.id },
    include: {
      options: { include: { _count: { select: { votes: true } } } },
    },
  });

  const { totalVotes, tally } = tallyOptions(updatedPoll?.options ?? []);

  broadcastToSession(poll.sessionId, {
    type: "POLL_VOTED",
    pollId: poll.id,
    totalVotes,
    tally,
  });

  return {
    ok: true,
    pollId: poll.id,
    totalVotes,
    tally,
    userVotedOptionId: input.optionId,
  };
}
