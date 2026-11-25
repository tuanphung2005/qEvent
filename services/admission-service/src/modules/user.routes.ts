import type { Role } from "@prisma/client";
import { Elysia, t } from "elysia";
import type { Deps } from "../deps";
import { createJwtAuth, deriveCurrentUser } from "../lib/auth";
import { fail } from "../lib/http";

const role = t.Optional(t.Union([t.Literal("HOST"), t.Literal("STAFF"), t.Literal("ORGANIZER"), t.Literal("ATTENDEE")]));

/**
 * Organizer-only account picker. Used when assigning a HOST to an event; it
 * never returns password hashes or other credentials.
 */
export function userRoutes(deps: Deps, secret: string) {
  return new Elysia({ tags: ["users"] })
    .use(createJwtAuth(secret))
    .derive(deriveCurrentUser)
    .get(
      "/api/users",
      async ({ currentUser, query, set }) => {
        if (!currentUser) {
          return fail(set, 401, "UNAUTHORIZED", "Authentication is required");
        }
        if (currentUser.role !== "ORGANIZER") {
          return fail(set, 403, "FORBIDDEN", "Organizer role is required");
        }

        const users = await deps.prisma.user.findMany({
          where: query.role ? { role: query.role as Role } : undefined,
          select: { id: true, email: true, fullName: true, role: true },
          orderBy: { fullName: "asc" },
        });
        return { users };
      },
      { query: t.Object({ role }) }
    );
}
