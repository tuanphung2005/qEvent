import { prisma } from "../../../plugins/prisma";

/**
 * Determine if a session is currently within its live event window
 */
export async function getSessionLiveStatus(sessionId: string): Promise<{
  session: any;
  isLive: boolean;
  status: "UPCOMING" | "LIVE" | "ENDED";
}> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { event: true },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // If session is explicitly toggled live
  if (session.isLive) {
    return { session, isLive: true, status: "LIVE" };
  }

  const now = new Date();
  const startTime = new Date(session.startTime);
  const endTime = new Date(session.endTime);

  if (now < startTime) {
    return { session, isLive: false, status: "UPCOMING" };
  }
  if (now > endTime) {
    return { session, isLive: false, status: "ENDED" };
  }

  return { session, isLive: true, status: "LIVE" };
}

/**
 * Check if a user has checked in for the event corresponding to a session
 */
export async function checkUserSessionAccess(
  sessionId: string,
  userId?: string | null
): Promise<{
  isRegistered: boolean;
  isCheckedIn: boolean;
  role: string;
}> {
  if (!userId) {
    return { isRegistered: false, isCheckedIn: false, role: "GUEST" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return { isRegistered: false, isCheckedIn: false, role: "GUEST" };
  }

  // Staff, Organizer, Speaker have full interaction access
  if (user.role === "STAFF" || user.role === "ORGANIZER" || user.role === "SPEAKER") {
    return { isRegistered: true, isCheckedIn: true, role: user.role };
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { eventId: true },
  });

  if (!session) {
    return { isRegistered: false, isCheckedIn: false, role: user.role };
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      eventId: session.eventId,
      userId: user.id,
    },
  });

  if (!ticket) {
    return { isRegistered: false, isCheckedIn: false, role: user.role };
  }

  return {
    isRegistered: true,
    isCheckedIn: ticket.status === "CHECKED_IN",
    role: user.role,
  };
}

export async function handleToggleVote(questionId: string, userId: string) {
  const existingVote = await prisma.qAQuestionVote.findUnique({
    where: {
      questionId_userId: {
        questionId,
        userId,
      },
    },
  });

  let question;
  let hasVoted = false;

  if (existingVote) {
    // Unvote
    await prisma.qAQuestionVote.delete({
      where: { id: existingVote.id },
    });
    question = await prisma.qAQuestion.update({
      where: { id: questionId },
      data: {
        upvotes: { decrement: 1 },
      },
      include: {
        user: { select: { id: true, fullName: true } },
        votes: { select: { userId: true } },
      },
    });
    hasVoted = false;
  } else {
    // Vote
    await prisma.qAQuestionVote.create({
      data: {
        questionId,
        userId,
      },
    });
    question = await prisma.qAQuestion.update({
      where: { id: questionId },
      data: {
        upvotes: { increment: 1 },
      },
      include: {
        user: { select: { id: true, fullName: true } },
        votes: { select: { userId: true } },
      },
    });
    hasVoted = true;
  }

  return { question, hasVoted };
}
