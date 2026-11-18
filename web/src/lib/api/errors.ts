import type { ApiError } from "./types";

const STATUS_CODE: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_FAILED",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

/** Vietnamese copy for every code the three services can return. */
const MESSAGE: Record<string, string> = {
  UNAUTHORIZED: "Phiên đã hết hạn. Đăng nhập lại để tiếp tục.",
  FORBIDDEN: "Bạn không có quyền cho thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  BAD_REQUEST: "Yêu cầu chưa hợp lệ. Kiểm tra lại rồi thử tiếp.",
  CONFLICT: "Dữ liệu đã thay đổi. Tải lại rồi thử tiếp.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ. Kiểm tra các ô được đánh dấu.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  INVALID_QR_TOKEN: "Mã QR không hợp lệ hoặc đã hết hạn.",
  ALREADY_CHECKED_IN: "Vé đã được soát.",
  ORDER_NOT_CONFIRMED: "Đơn chưa xác nhận, chưa soát được vé.",
  QUOTA_BELOW_SOLD: "Không giảm được quota: đã bán nhiều vé hơn mức mới.",
  INVALID_SESSION_TIME: "Giờ kết thúc phải sau giờ bắt đầu.",
  ROOM_NOT_FOUND: "Không tìm thấy phòng.",
  SOLD_OUT: "Đã hết vé cho loại vé này.",
  SERVICE_UNAVAILABLE: "Dịch vụ tạm thời không phản hồi. Thử lại sau ít phút.",
  GATEWAY_TIMEOUT: "Dịch vụ phản hồi quá lâu. Thử lại.",
  NETWORK: "Không có kết nối mạng. Kiểm tra Wi-Fi hoặc 4G.",
  UNKNOWN: "Đã xảy ra lỗi. Thử lại.",
};

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = error.status;
  }

  toApiError(): ApiError {
    return { code: this.code, message: this.message, status: this.status };
  }
}

export function isApiError(value: unknown): value is ApiRequestError {
  return value instanceof ApiRequestError;
}

export function errorMessage(code: string | null | undefined): string {
  if (!code) return MESSAGE.UNKNOWN ?? "";
  return MESSAGE[code] ?? MESSAGE.UNKNOWN ?? "";
}

/** Normalises anything thrown by fetch, the client or a hook into one shape. */
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiRequestError) return cause.toApiError();
  if (cause instanceof TypeError)
    return { code: "NETWORK", message: errorMessage("NETWORK"), status: 0 };
  if (cause instanceof Error && "code" in cause && typeof cause.code === "string") {
    const status = "status" in cause && typeof cause.status === "number" ? cause.status : 0;
    return { code: cause.code, message: errorMessage(cause.code), status };
  }
  return { code: "UNKNOWN", message: errorMessage("UNKNOWN"), status: 0 };
}

type ClientResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Turns an openapi-fetch result into data or a thrown ApiRequestError, so
 * TanStack Query owns loading/error state instead of every page.
 */
export function unwrap<T>(result: ClientResult<T>): T {
  if (result.error !== undefined) {
    const body = result.error as { code?: string; message?: string } | null;
    const status = result.response.status;
    const code = body?.code ?? STATUS_CODE[status] ?? "UNKNOWN";
    throw new ApiRequestError({
      code,
      message: body?.message?.trim() || errorMessage(code),
      status,
    });
  }
  if (result.data === undefined) {
    // 204 No Content is a successful DELETE; only an empty 2xx-less response is an error.
    if (result.response.ok) return undefined as T;
    throw new ApiRequestError({ code: "UNKNOWN", message: errorMessage("UNKNOWN"), status: 0 });
  }
  return result.data;
}
