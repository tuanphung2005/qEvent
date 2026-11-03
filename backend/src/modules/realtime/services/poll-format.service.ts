/**
 * Định dạng poll dùng chung cho REST và WebSocket.
 *
 * Công thức `percentage` trước đây được copy 5 lần; REST và WS phải cho ra cùng
 * một con số vì client hiển thị cái nào tới trước.
 */
export type PollOptionRow = {
  id: string;
  text: string;
  _count: { votes: number };
};

export type PollRow = {
  id: string;
  question: string;
  isActive: boolean;
  createdAt: Date;
  options: PollOptionRow[];
  /** Prisma trả `undefined` khi không include votes của user hiện tại. */
  votes?: { optionId: string }[] | false | null;
};

/** Tổng phiếu + phần trăm từng phương án. */
export function tallyOptions(options: readonly PollOptionRow[]) {
  const totalVotes = options.reduce((sum, opt) => sum + opt._count.votes, 0);

  const tally = options.map((opt) => ({
    id: opt.id,
    text: opt.text,
    voteCount: opt._count.votes,
    percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
  }));

  return { totalVotes, tally };
}

/** Poll đầy đủ cho màn hình Q&A (kèm lựa chọn user đã bình chọn). */
export function formatPoll(poll: PollRow) {
  const { totalVotes, tally } = tallyOptions(poll.options);

  return {
    id: poll.id,
    question: poll.question,
    isActive: poll.isActive,
    createdAt: poll.createdAt,
    totalVotes,
    userVotedOptionId:
      poll.votes && poll.votes.length > 0 ? poll.votes[0].optionId : null,
    options: tally,
  };
}
