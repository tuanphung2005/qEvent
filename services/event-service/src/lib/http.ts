export type ErrorBody = { code: string; message: string };

export function fail(
  set: { status?: number | string },
  status: number,
  code: string,
  message: string
): ErrorBody {
  set.status = status;
  return { code, message };
}
