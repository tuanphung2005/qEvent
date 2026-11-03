/**
 * Cấu hình JWT dùng chung cho mọi module.
 *
 * Trước đây mỗi file route tự khai báo `jwt({ ... })` + một khối `derive` 18 dòng
 * giống hệt nhau (12 bản). Chỉ cần một bản lệch secret là route đó trả 401 cho
 * mọi token hợp lệ, nên tất cả đi qua file này.
 */
export const FALLBACK_JWT_SECRET = "qevent_super_secret_jwt_key_2026_production_grade";

export const JWT_CONFIG = {
  name: "jwtAuth",
  secret: process.env.JWT_SECRET || FALLBACK_JWT_SECRET,
} as const;

export type CurrentUser = {
  id: string;
  email: string;
  role: string;
};

type AuthDeriveInput = {
  headers: Record<string, string | undefined>;
  jwtAuth: { verify(token?: string): Promise<unknown> };
};

/** Đọc `Authorization: Bearer <token>` và trả `{ currentUser }` (null nếu không hợp lệ). */
export async function deriveCurrentUser({
  headers,
  jwtAuth,
}: AuthDeriveInput): Promise<{ currentUser: CurrentUser | null }> {
  const authHeader = headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return { currentUser: null };
  }

  const token = authHeader.slice(7);
  const payload = await jwtAuth.verify(token);
  if (!payload || typeof payload !== "object" || !("id" in payload)) {
    return { currentUser: null };
  }

  // `verify` trả về payload chưa được định kiểu ở đây → ép kiểu đúng như bản cũ.
  const claims = payload as { id?: unknown; email?: unknown; role?: unknown };

  return {
    currentUser: {
      id: claims.id as string,
      email: claims.email as string,
      role: claims.role as string,
    },
  };
}
