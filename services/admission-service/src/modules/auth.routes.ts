import { Elysia, t } from "elysia";
import bcrypt from "bcryptjs";
import type { Deps } from "../deps";
import { createJwtAuth } from "../lib/auth";
import { fail } from "../lib/http";

export function authRoutes(deps: Deps, secret: string) {
  return new Elysia({ prefix: "/api/auth", tags: ["auth"] })
    .use(createJwtAuth(secret))
    .post(
      "/register",
      async ({ body, jwtAuth, set }) => {
        const email = body.email.trim().toLowerCase();
        const fullName = body.fullName.trim();

        const existing = await deps.prisma.user.findUnique({ where: { email } });
        if (existing) {
          return fail(set, 409, "EMAIL_TAKEN", "Email is already registered");
        }

        const passwordHash = await bcrypt.hash(body.password, 10);
        let user;
        try {
          user = await deps.prisma.user.create({
            data: { email, passwordHash, fullName, role: "ATTENDEE" },
          });
        } catch (error) {
          if ((error as { code?: string } | null)?.code === "P2002") {
            return fail(set, 409, "EMAIL_TAKEN", "Email is already registered");
          }
          throw error;
        }

        const token = await jwtAuth.sign({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        });

        set.status = 201;
        return {
          token,
          user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        };
      },
      {
        body: t.Object({
          email: t.String({ minLength: 3 }),
          password: t.String({ minLength: 8 }),
          fullName: t.String({ minLength: 1 }),
          role: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/login",
      async ({ body, jwtAuth, set }) => {
        const email = body.email.trim().toLowerCase();
        const user = await deps.prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
          return fail(set, 401, "INVALID_CREDENTIALS", "Email or password is incorrect");
        }

        const token = await jwtAuth.sign({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        });

        return {
          token,
          user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        };
      },
      {
        body: t.Object({
          email: t.String({ minLength: 3 }),
          password: t.String({ minLength: 1 }),
        }),
      }
    );
}
