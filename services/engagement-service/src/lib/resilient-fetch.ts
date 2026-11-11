export class InfraError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "InfraError";
  }
}

export type ResilientFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  fetchImpl?: typeof fetch;
};

const RETRYABLE_STATUS = new Set([502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resilientFetch(
  url: string,
  init: RequestInit = {},
  options: ResilientFetchOptions = {}
): Promise<{ status: number; body: unknown }> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const retries = options.retries ?? 2;
  const backoffMs = options.backoffMs ?? 300;
  const doFetch = options.fetchImpl ?? fetch;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await doFetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      if (RETRYABLE_STATUS.has(response.status)) {
        if (attempt < retries) {
          await sleep(backoffMs);
          continue;
        }
        throw new InfraError(`downstream responded ${response.status}`, response.status);
      }

      return { status: response.status, body };
    } catch (error) {
      if (error instanceof InfraError) throw error;
      if (attempt < retries) {
        await sleep(backoffMs);
        continue;
      }
      throw new InfraError(
        controller.signal.aborted ? "downstream timeout" : "downstream unreachable"
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
