import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type QuizSeed = {
  status: "WAITING" | "QUESTION_ACTIVE" | "ROUND_REVEALED" | "FINISHED";
  currentQuestionIndex: number;
  questions: Array<{
    content: string;
    options: string[];
    correctOption: number;
    timeLimitSec?: number;
  }>;
};

type SessionSeed = {
  sessionId: string;
  questions: Array<{ content: string; upvotes: number; userId: string }>;
  polls: Array<{
    title: string;
    isActive: boolean;
    options: Array<{ content: string; votes: number }>;
  }>;
  quiz: QuizSeed;
};

/**
 * Demo engagement for four sessions owned by event-service/prisma/seed.ts.
 * Every state the console can render (waiting / live question / revealed /
 * finished, open and closed polls) shows up on first load.
 */
const sessions: SessionSeed[] = [
  {
    sessionId: "33333333-3333-4333-8333-333333333333",
    questions: [
      {
        content: "Microservices có phù hợp với hệ thống chịu tải cao như qEvent không?",
        upvotes: 14,
        userId: "user-attendee-1",
      },
      {
        content: "Làm sao để giữ p99 check-in dưới 300ms khi mạng tại cổng chập chờn?",
        upvotes: 9,
        userId: "user-attendee-2",
      },
      {
        content: "Nhóm có dùng Kafka hay RabbitMQ cho hàng đợi offline không?",
        upvotes: 5,
        userId: "user-attendee-3",
      },
    ],
    polls: [
      {
        title: "Bạn thấy kiến trúc Microservices phân tán thế nào?",
        isActive: true,
        options: [
          { content: "Rất tối ưu và dễ mở rộng", votes: 48 },
          { content: "Khá phức tạp khi gỡ lỗi", votes: 21 },
          { content: "Cần công cụ quan sát mạnh mẽ", votes: 63 },
        ],
      },
      {
        title: "Bạn đang chạy bao nhiêu service trong production?",
        isActive: false,
        options: [
          { content: "1 – 3 service", votes: 30 },
          { content: "4 – 10 service", votes: 41 },
          { content: "Trên 10 service", votes: 12 },
        ],
      },
    ],
    quiz: {
      status: "WAITING",
      currentQuestionIndex: 0,
      questions: [
        {
          content: "Thuật toán nào được dùng để chống check-in trùng?",
          options: [
            "Two-Phase Locking (2PL)",
            "Compare-And-Set (CAS)",
            "Optimistic Concurrency Control đơn thuần",
            "Polling định kỳ",
          ],
          correctOption: 1,
        },
        {
          content: "Circuit Breaker ngắt mạch (OPEN) nhằm mục đích gì?",
          options: [
            "Tăng tốc độ truy vấn",
            "Ngăn chặn sụp đổ dây chuyền",
            "Tự động tái tạo container",
            "Nén gói tin HTTP",
          ],
          correctOption: 1,
        },
      ],
    },
  },
  {
    sessionId: "33333333-3333-4333-8333-333333333334",
    questions: [
      {
        content: "10.000 cổng soát vé thì cần bao nhiêu pod gateway?",
        upvotes: 11,
        userId: "user-attendee-2",
      },
      {
        content: "Có nên cache danh sách vé ở edge không?",
        upvotes: 7,
        userId: "user-attendee-4",
      },
    ],
    polls: [
      {
        title: "Đâu là điểm nghẽn lớn nhất khi mở 10k cổng?",
        isActive: true,
        options: [
          { content: "Database ghi check-in", votes: 55 },
          { content: "Độ trễ mạng tại cổng", votes: 38 },
          { content: "Xác thực JWT", votes: 17 },
          { content: "Đồng bộ offline", votes: 24 },
        ],
      },
    ],
    quiz: {
      status: "QUESTION_ACTIVE",
      currentQuestionIndex: 0,
      questions: [
        {
          content: "p99 check-in mục tiêu của qEvent là bao nhiêu?",
          options: ["< 300ms", "< 1s", "< 3s", "< 5s"],
          correctOption: 0,
          timeLimitSec: 20,
        },
        {
          content: "Offline queue ghi vào đâu trên client?",
          options: ["localStorage", "IndexedDB", "Cookie", "Memory only"],
          correctOption: 1,
          timeLimitSec: 20,
        },
        {
          content: "Khi hai cổng quét cùng một vé, ai thắng?",
          options: [
            "Cổng quét sau",
            "Cổng quét trước (có điều kiện)",
            "Cả hai",
            "Không ai",
          ],
          correctOption: 1,
          timeLimitSec: 20,
        },
      ],
    },
  },
  {
    sessionId: "33333333-3333-4333-8333-333333333338",
    questions: [
      {
        content: "Có encore bài 'Đường về' không ạ?",
        upvotes: 42,
        userId: "user-attendee-5",
      },
      {
        content: "Mình có thể xin setlist sau chương trình ở đâu?",
        upvotes: 16,
        userId: "user-attendee-6",
      },
    ],
    polls: [
      {
        title: "Bài nào bạn muốn nghe lại nhất?",
        isActive: true,
        options: [
          { content: "Đường về", votes: 88 },
          { content: "Mùa hè đã hết", votes: 64 },
          { content: "Sài Gòn đêm", votes: 57 },
        ],
      },
    ],
    quiz: {
      status: "ROUND_REVEALED",
      currentQuestionIndex: 1,
      questions: [
        {
          content: "Ban nhạc mở màn tối nay tên gì?",
          options: ["Cá Hồi Hoang", "Chillies", "Ngọt", "Thịnh Suy"],
          correctOption: 2,
          timeLimitSec: 15,
        },
        {
          content: "Sân khấu chính nằm ở khán đài nào?",
          options: ["Khán đài A", "Khán đài B", "Sân cỏ", "Cổng 3"],
          correctOption: 0,
          timeLimitSec: 15,
        },
      ],
    },
  },
  {
    sessionId: "33333333-3333-4333-8333-333333333343",
    questions: [
      {
        content: "Model nào đang được dùng để đọc QR tại cổng?",
        upvotes: 12,
        userId: "user-attendee-7",
      },
      {
        content: "Có xử lý ảnh chụp màn hình để chống gian lận không?",
        upvotes: 6,
        userId: "user-attendee-8",
      },
    ],
    polls: [
      {
        title: "Năm nay team bạn có định thay hệ thống soát vé không?",
        isActive: true,
        options: [
          { content: "Có, đang tìm giải pháp", votes: 27 },
          { content: "Đang cân nhắc", votes: 34 },
          { content: "Không, giữ nguyên", votes: 9 },
        ],
      },
    ],
    quiz: {
      status: "FINISHED",
      currentQuestionIndex: 1,
      questions: [
        {
          content: "Check-in dưới 0.3 giây cần tối ưu phần nào trước?",
          options: ["Frontend", "Mạng tại cổng", "Ghi DB check-in", "Email xác nhận"],
          correctOption: 2,
        },
        {
          content: "QR token hết hạn sau bao lâu?",
          options: ["30 giây", "5 phút", "1 giờ", "1 ngày"],
          correctOption: 0,
        },
      ],
    },
  },
];

async function reset(sessionId: string) {
  await prisma.quizAnswer.deleteMany({ where: { question: { game: { sessionId } } } });
  await prisma.quizQuestion.deleteMany({ where: { game: { sessionId } } });
  await prisma.quizGame.deleteMany({ where: { sessionId } });
  await prisma.pollVote.deleteMany({ where: { option: { poll: { sessionId } } } });
  await prisma.pollOption.deleteMany({ where: { poll: { sessionId } } });
  await prisma.poll.deleteMany({ where: { sessionId } });
  await prisma.qAVote.deleteMany({ where: { question: { sessionId } } });
  await prisma.qAQuestion.deleteMany({ where: { sessionId } });
}

async function main() {
  for (const session of sessions) {
    await reset(session.sessionId);

    for (const question of session.questions) {
      await prisma.qAQuestion.create({
        data: {
          sessionId: session.sessionId,
          userId: question.userId,
          content: question.content,
          upvotes: question.upvotes,
        },
      });
    }

    for (const poll of session.polls) {
      await prisma.poll.create({
        data: {
          sessionId: session.sessionId,
          title: poll.title,
          isActive: poll.isActive,
          options: {
            create: poll.options.map((option) => ({
              content: option.content,
              voteCount: option.votes,
            })),
          },
        },
      });
    }

    const game = await prisma.quizGame.create({
      data: {
        sessionId: session.sessionId,
        status: session.quiz.status,
        currentQuestionIndex: session.quiz.currentQuestionIndex,
        questions: {
          create: session.quiz.questions.map((question, orderNum) => ({
            orderNum,
            content: question.content,
            options: question.options,
            correctOption: question.correctOption,
            timeLimitSec: question.timeLimitSec ?? 30,
            questionStartedAt:
              session.quiz.status === "QUESTION_ACTIVE" ||
              session.quiz.status === "ROUND_REVEALED"
                ? new Date()
                : null,
          })),
        },
      },
      include: { questions: { orderBy: { orderNum: "asc" } } },
    });

    if (session.quiz.status === "FINISHED") {
      const first = game.questions[0];
      if (first) {
        await prisma.quizAnswer.createMany({
          data: [
            { questionId: first.id, userId: "user-attendee-1", selectedOption: 2, responseTimeMs: 2100, score: 100 },
            { questionId: first.id, userId: "user-attendee-2", selectedOption: 0, responseTimeMs: 3400, score: 0 },
            { questionId: first.id, userId: "user-attendee-3", selectedOption: 2, responseTimeMs: 1800, score: 100 },
            { questionId: first.id, userId: "user-attendee-4", selectedOption: 1, responseTimeMs: 5200, score: 0 },
          ],
        });
      }
    }
  }

  const totals = {
    sessions: sessions.length,
    questions: sessions.reduce((sum, session) => sum + session.questions.length, 0),
    polls: sessions.reduce((sum, session) => sum + session.polls.length, 0),
    quizzes: sessions.length,
  };
  console.log("Seeded engagement demo data:", totals);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
