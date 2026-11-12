import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sessionId = "session-demo-1";

  // Clean existing demo data
  await prisma.quizAnswer.deleteMany({});
  await prisma.quizQuestion.deleteMany({});
  await prisma.quizGame.deleteMany({});
  await prisma.pollVote.deleteMany({});
  await prisma.pollOption.deleteMany({});
  await prisma.poll.deleteMany({});
  await prisma.qAVote.deleteMany({});
  await prisma.qAQuestion.deleteMany({});

  // 1. Seed demo Q&A
  const q1 = await prisma.qAQuestion.create({
    data: {
      sessionId,
      userId: "user-attendee-1",
      content: "Microservices có phù hợp với hệ thống chịu tải cao như qEvent không?",
      upvotes: 3,
    },
  });

  // 2. Seed demo Poll
  const poll = await prisma.poll.create({
    data: {
      sessionId,
      title: "Bạn thấy kiến trúc Microservices phân tán thế nào?",
      options: {
        create: [
          { content: "Rất tối ưu và dễ mở rộng", voteCount: 5 },
          { content: "Khá phức tạp khi gỡ lỗi", voteCount: 2 },
          { content: "Cần công cụ quan sát mạnh mẽ", voteCount: 8 },
        ],
      },
    },
  });

  // 3. Seed demo Quiz Game
  const game = await prisma.quizGame.create({
    data: {
      sessionId,
      status: "WAITING",
      currentQuestionIndex: 0,
      questions: {
        create: [
          {
            orderNum: 0,
            content: "Thuật toán nào được dùng để chống check-in trùng (Double Check-in)?",
            options: [
              "Two-Phase Locking (2PL)",
              "Compare-And-Set (CAS)",
              "Optimistic Concurrency Control đơn thuần",
              "Polling định kỳ",
            ],
            correctOption: 1,
            timeLimitSec: 20,
          },
          {
            orderNum: 1,
            content: "Circuit Breaker ngắt mạch (OPEN) nhằm mục đích gì?",
            options: [
              "Tăng tốc độ truy vấn cơ sở dữ liệu",
              "Ngăn chặn sụp đổ dây chuyền (Cascading Failure)",
              "Tự động tái tạo container bị lỗi",
              "Nén dung lượng gói tin HTTP",
            ],
            correctOption: 1,
            timeLimitSec: 20,
          },
        ],
      },
    },
  });

  console.log("Seeded engagement service data successfully:", {
    questionId: q1.id,
    pollId: poll.id,
    gameId: game.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
