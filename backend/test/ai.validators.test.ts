import { describe, expect, it } from "bun:test";
import { validateClusters } from "../src/modules/realtime/services/qa-cluster.service";
import { validateQuizDraft } from "../src/modules/ai/services/quiz-draft.service";

describe("validateClusters", () => {
  const questions = [
    { id: "a", content: "Khi nào ra mắt?", upvotes: 5 },
    { id: "b", content: "Bao giờ launch?", upvotes: 9 },
  ];

  it("bỏ ID bịa, đảm bảo nhóm rời nhau, tính mergedUpvotes ở server", () => {
    const out = validateClusters(
      {
        clusters: [
          { label: "Ra mắt", questionIds: ["a", "b", "ghost"], representativeId: "ghost" },
          { label: "Trùng lặp", questionIds: ["a"] }, // a đã bị nhóm 1 chiếm → bị bỏ
        ],
      },
      questions
    );
    expect(out).toHaveLength(1);
    expect(out[0].questionIds).toEqual(["a", "b"]);
    expect(out[0].representativeId).toBe("b"); // fallback: upvotes cao nhất
    expect(out[0].mergedUpvotes).toBe(14);
  });

  it("ném lỗi khi output rỗng", () => {
    expect(() => validateClusters({}, questions)).toThrow();
  });
});

describe("validateQuizDraft", () => {
  const ok = {
    question: "HTTP status nào là Not Found?",
    difficulty: "easy",
    options: [
      { text: "200", isCorrect: false },
      { text: "404", isCorrect: true },
      { text: "500", isCorrect: false },
      { text: "301", isCorrect: false },
    ],
  };

  it("map difficulty → timeLimitSec/points ở server", () => {
    const [q] = validateQuizDraft({ questions: [ok] }, 5);
    expect(q.timeLimitSec).toBe(15);
    expect(q.points).toBe(500);
  });

  it("loại câu có 2 đáp án đúng", () => {
    const bad = { ...ok, options: ok.options.map((o) => ({ ...o, isCorrect: true })) };
    expect(() => validateQuizDraft({ questions: [bad] }, 5)).toThrow();
  });

  it("khử câu trùng ý thay vì nhân đôi", () => {
    const out = validateQuizDraft({ questions: [ok, { ...ok }] }, 5);
    expect(out).toHaveLength(1);
  });
});
