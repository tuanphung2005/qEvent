/**
 * Quy tắc chung cho phương án trắc nghiệm của game.
 *
 * `game-crud` (thêm/sửa câu) và `ai.generate-quiz` trước đây tự khai báo màu và
 * tự chép lại bộ kiểm tra 4 phương án. Một bản lệch là client thấy câu hỏi tạo
 * được ở đường này nhưng bị chặn ở đường kia.
 */

/** Màu hiển thị theo thứ tự phương án (A/B/C/D). */
export const OPTION_COLORS = ["RED", "BLUE", "YELLOW", "GREEN"] as const;

export type QuestionOptionInput = { text: string; isCorrect: boolean };

export type OptionValidationError = { error: "INVALID_OPTIONS"; message: string };

/**
 * Chốt thứ hai (schema đã ép kiểu): đúng 4 phương án, đúng 1 đáp án đúng,
 * 4 nội dung không trùng nhau. Trả `null` khi hợp lệ.
 *
 * `notFourMessage` cho phép mỗi route giữ nguyên câu chữ cũ.
 */
export function validateQuestionOptions(
  options: readonly QuestionOptionInput[],
  notFourMessage = "Cần đúng 4 phương án"
): OptionValidationError | null {
  if (options.length !== 4) {
    return { error: "INVALID_OPTIONS", message: notFourMessage };
  }
  if (options.filter((o) => o.isCorrect).length !== 1) {
    return { error: "INVALID_OPTIONS", message: "Phải có đúng 1 đáp án đúng" };
  }
  const texts = options.map((o) => o.text.trim().toLowerCase());
  if (new Set(texts).size !== 4) {
    return { error: "INVALID_OPTIONS", message: "4 đáp án phải khác nhau" };
  }
  return null;
}
