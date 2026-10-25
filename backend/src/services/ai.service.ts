import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
export const AI_ENABLED = Boolean(process.env.GEMINI_API_KEY);

const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 45_000;
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 16_384;

export class AiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY chưa được cấu hình");
    this.name = "AiNotConfiguredError";
  }
}

export class AiInvalidOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiInvalidOutputError";
  }
}

/** Lazy: KHÔNG khởi tạo ở module scope → thiếu key không làm sập server. */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new AiNotConfiguredError();
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: TIMEOUT_MS },
  });
  return client;
}

export interface GenerateJsonRequest {
  prompt: string;
  /** JSON Schema chuẩn (không phải Schema/Type của SDK). */
  schema: Record<string, unknown>;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

/** Cho phép inject generator giả trong test. Trả `unknown` — caller phải validate. */
export type JsonGenerator = (req: GenerateJsonRequest) => Promise<unknown>;

export const generateJson: JsonGenerator = async ({
  prompt,
  schema,
  model,
  maxOutputTokens,
  temperature,
}: GenerateJsonRequest): Promise<unknown> => {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: schema, // plain JSON Schema — SDK type là `unknown`
      temperature: temperature ?? 0.2,
      maxOutputTokens: maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      httpOptions: {
        timeout: TIMEOUT_MS,
        // SDK tự retry 408/429/5xx với exponential backoff + jitter.
        retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 8, jitter: 0.3 },
      },
    },
  });

  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  // Không dùng response.text (getter có thể throw); ghép parts an toàn:
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  if (!text.trim()) {
    throw new AiInvalidOutputError(`Model trả về rỗng (finishReason=${finishReason ?? "unknown"})`);
  }
  if (finishReason === "MAX_TOKENS") {
    throw new AiInvalidOutputError("Output bị cắt do MAX_TOKENS — giảm số câu hỏi gửi vào");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiInvalidOutputError("Model không trả về JSON hợp lệ");
  }
};

/* ------------------------------------------------------------------ */
/* Single-flight (double-click / 2 tab)                                */
/* ------------------------------------------------------------------ */

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Gộp các request cùng key đang chạy vào 1 promise.
 * Chỉ đúng trong 1 process — đủ cho MVP 1 instance.
 */
export function singleFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const job = run().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** Map lỗi AI → HTTP status. */
export function aiErrorStatus(err: unknown): number {
  if (err instanceof AiNotConfiguredError) return 503;
  if (err instanceof AiInvalidOutputError) return 502;
  const e = err as { status?: number; name?: string };
  if (e?.status === 429) return 429;
  if (e?.status === 504 || e?.name === "AbortError" || e?.name === "TimeoutError") return 504;
  return 500;
}

/** Mã lỗi ổn định cho response body (để client/UI xử lý). */
export function aiErrorCode(err: unknown): string {
  if (err instanceof AiNotConfiguredError) return "AI_NOT_CONFIGURED";
  if (err instanceof AiInvalidOutputError) return "AI_INVALID_OUTPUT";
  const e = err as { status?: number };
  if (e?.status === 429) return "AI_RATE_LIMITED";
  if (e?.status === 504) return "AI_TIMEOUT";
  return "AI_FAILED";
}
