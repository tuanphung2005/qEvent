export type ApiErrorBody = { code?: string; message?: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const VI_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_CHECKED_IN: 'Bạn cần check-in tại cổng trước khi vào phiên live.',
  SESSION_NOT_LIVE: 'Phiên này chưa mở.',
  TICKET_NOT_FOUND: 'Không tìm thấy vé.',
  ALREADY_CHECKED_IN: 'Vé đã được check-in trước đó.',
  ORDER_NOT_CONFIRMED: 'Đơn hàng chưa được xác nhận.',
  INVALID_QR_TOKEN: 'Mã QR không hợp lệ hoặc đã hết hạn.',
  INVALID_TICKET_STATUS: 'Trạng thái vé không cho phép check-in.',
  EVENT_MISMATCH: 'Vé thuộc sự kiện khác.',
  INVALID_OPTION: 'Lựa chọn không thuộc bình chọn này.',
  POLL_INACTIVE: 'Bình chọn đã đóng.',
  QUESTION_CLOSED: 'Câu hỏi đã đóng.',
  EMAIL_TAKEN: 'Email này đã được đăng ký.',
  ROLE_NOT_SUPPORTED: 'Tài khoản host dùng web console, không dùng app di động.',
  NETWORK: 'Không có kết nối mạng. Kiểm tra Wi-Fi/4G rồi thử lại.',
  TIMEOUT: 'Máy chủ phản hồi quá lâu. Thử lại sau.',
  SERVER: 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.',
  UNKNOWN: 'Đã có lỗi xảy ra. Thử lại.',
};

export function messageFor(code: string | undefined, fallback?: string): string {
  if (code && VI_MESSAGES[code]) return VI_MESSAGES[code];
  return fallback?.trim() || VI_MESSAGES.UNKNOWN;
}

export function toApiError(
  body: ApiErrorBody | undefined,
  status: number,
  fallbackMessage?: string
): ApiError {
  const code = body?.code ?? statusToCode(status);
  return new ApiError(status, code, messageFor(code, body?.message ?? fallbackMessage));
}

function statusToCode(status: number): string {
  if (status === 0) return 'NETWORK';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

/**
 * openapi-fetch never throws on HTTP errors. Call sites use this so every
 * screen gets the same Vietnamese copy and status handling.
 */
export function unwrap<T>(
  result: { data?: T; error?: ApiErrorBody; response: Response },
  fallbackMessage?: string
): T {
  if (result.error || !result.response.ok) {
    throw toApiError(result.error, result.response.status, fallbackMessage);
  }
  return result.data as T;
}

/** Network failures surface as TypeError before a Response exists. */
export function toNetworkError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) return new ApiError(0, 'NETWORK', VI_MESSAGES.NETWORK);
  return new ApiError(0, 'UNKNOWN', messageFor('UNKNOWN'));
}
