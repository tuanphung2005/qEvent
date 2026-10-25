import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../../../plugins/prisma";
import { checkUserSessionAccess, HOST_ROLES } from "../../realtime";
import { isUniqueViolation } from "../../game/services/access.service";
import { AI_ENABLED, aiErrorCode, aiErrorStatus, singleFlight } from "../../../services/ai.service";
import { draftQuiz } from "../services/quiz-draft.service";
import { generateQuizBody } from "../schemas";

// Phụ thuộc một chiều: ai → game.services. `game` không import `ai` ⇒ không có vòng lặp.
const COLORS = ["RED", "BLUE", "YELLOW", "GREEN"] as const;

export const generateQuizRoutes = new Elysia()
  .use(
    jwt({
      name: "jwtAuth",
      secret: process.env.JWT_SECRET || "qevent_super_secret_jwt_key_2026_production_grade",
    })
  )
  .derive(async ({ headers, jwtAuth }) => {
    const authHeader = headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) return { currentUser: null };
    const payload = await jwtAuth.verify(authHeader.slice(7));
    if (!payload || typeof payload !== "object" || !("id" in payload)) return { currentUser: null };
    return {
      currentUser: {
        id: payload.id as string,
        email: payload.email as string,
        role: payload.role as string,
      },
    };
  })
  .post(
    "/api/ai/generate-quiz",
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const session = await prisma.session.findUnique({
        where: { id: body.sessionId },
        select: { id: true },
      });
      if (!session) {
        set.status = 404;
        return { error: "SESSION_NOT_FOUND" };
      }

      const access = await checkUserSessionAccess(body.sessionId, currentUser.id);
      if (!HOST_ROLES.includes(access.role)) {
        set.status = 403;
        return { error: "FORBIDDEN", message: "Chỉ host/speaker mới được tạo quiz" };
      }

      if (!AI_ENABLED) {
        set.status = 503;
        return { error: "AI_NOT_CONFIGURED", message: "Server chưa cấu hình GEMINI_API_KEY" };
      }

      const game = await prisma.quizGame.findUnique({
        where: { id: body.gameId },
        select: { id: true, sessionId: true, status: true },
      });
      if (!game) {
        set.status = 404;
        return { error: "GAME_NOT_FOUND" };
      }
      if (game.sessionId !== body.sessionId) {
        set.status = 400;
        return { error: "GAME_SESSION_MISMATCH" };
      }
      if (game.status !== "WAITING") {
        set.status = 409;
        return {
          error: "GAME_ALREADY_STARTED",
          message: "Chỉ có thể thêm câu hỏi khi game đang ở trạng thái WAITING",
        };
      }

      try {
        const questionCount = body.questionCount ?? 5;
        const language = body.language ?? "vi";

        // Gộp double-click / 2 tab: 1 lần gọi Gemini + 1 lần ghi cho mỗi game.
        const outcome = await singleFlight(`quiz:${game.id}`, async () => {
          const draft = await draftQuiz({
            topic: body.topic,
            contextText: body.contextText,
            questionCount,
            language,
          });

          // Host có thể bấm Start trong lúc chờ AI → kiểm tra lại ngay trước khi ghi.
          const fresh = await prisma.quizGame.findUnique({
            where: { id: game.id },
            select: { status: true },
          });
          if (fresh?.status !== "WAITING") return { ok: false as const };

          // orderNum dựa trên max hiện có (count sẽ sai nếu có câu bị xoá)
          const agg = await prisma.quizQuestion.aggregate({
            where: { gameId: game.id },
            _max: { orderNum: true },
          });
          const baseOrderNum = (agg._max.orderNum ?? -1) + 1;

          // 1 transaction → all-or-nothing
          const created = await prisma.$transaction(
            draft.map((q, i) =>
              prisma.quizQuestion.create({
                data: {
                  gameId: game.id,
                  orderNum: baseOrderNum + i,
                  question: q.question,
                  timeLimitSec: q.timeLimitSec,
                  points: q.points,
                  options: {
                    create: q.options.map((opt, idx) => ({
                      text: opt.text,
                      color: COLORS[idx % 4],
                      isCorrect: opt.isCorrect,
                    })),
                  },
                },
                include: { options: true },
              })
            )
          );

          return { ok: true as const, created };
        });

        if (!outcome.ok) {
          set.status = 409;
          return {
            error: "GAME_ALREADY_STARTED",
            message: "Game đã bắt đầu trong lúc tạo câu hỏi — không ghi câu mới",
          };
        }

        set.status = 201;
        return {
          generated: outcome.created.length,
          requested: questionCount,
          questions: outcome.created, // có isCorrect → host preview được
        };
      } catch (err) {
        // Cùng orderNum do 2 instance/2 request đồng thời (single-flight chỉ đúng 1 process)
        if (isUniqueViolation(err)) {
          set.status = 409;
          return { error: "ORDER_CONFLICT", message: "Câu hỏi vừa được thêm, thử lại" };
        }
        set.status = aiErrorStatus(err);
        return { error: aiErrorCode(err), message: (err as Error).message };
      }
    },
    { body: generateQuizBody }
  );
