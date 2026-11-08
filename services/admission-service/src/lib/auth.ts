import { jwt } from "@elysiajs/jwt";

export type CurrentUser = {
  id: string;
  email: string;
  role: string;
  fullName?: string;
};

type JwtVerifier = {
  verify(token?: string): Promise<unknown>;
};

export function createJwtAuth(secret: string) {
  return jwt({ name: "jwtAuth", secret, exp: "12h" });
}

export async function deriveCurrentUser({
  headers,
  jwtAuth,
}: {
  headers: Record<string, string | undefined>;
  jwtAuth: JwtVerifier;
}): Promise<{ currentUser: CurrentUser | null }> {
  const header = headers.authorization;
  if (!header?.startsWith("Bearer ")) return { currentUser: null };

  const payload = await jwtAuth.verify(header.slice(7));
  if (!payload || typeof payload !== "object" || !("id" in payload)) {
    return { currentUser: null };
  }

  const claims = payload as { id?: unknown; email?: unknown; role?: unknown; fullName?: unknown };
  if (typeof claims.id !== "string" || typeof claims.role !== "string") {
    return { currentUser: null };
  }

  return {
    currentUser: {
      id: claims.id,
      email: typeof claims.email === "string" ? claims.email : "",
      role: claims.role,
      fullName: typeof claims.fullName === "string" ? claims.fullName : undefined,
    },
  };
}

export function isStaffOrOrganizer(user: CurrentUser | null): boolean {
  return user?.role === "STAFF" || user?.role === "ORGANIZER";
}
