import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "../../plugins/prisma";

export const authModule = new Elysia({ prefix: "/api/auth" })
  .use(
    jwt({
      name: "jwtAuth",
      secret: process.env.JWT_SECRET || "qcheck_super_secret_jwt_key_2026_production_grade",
    })
  )
  .post(
    "/register",
    async ({ body, jwtAuth, set }) => {
      const { email, password, fullName, role } = body;
      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        set.status = 400;
        return { error: "Email already registered", message: "Email này đã được sử dụng" };
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      const assignedRole = (role === "STAFF" || role === "ORGANIZER" || role === "SPEAKER")
        ? role
        : "ATTENDEE";

      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: fullName.trim(),
          role: assignedRole,
        },
      });

      const token = await jwtAuth.sign({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      });

      set.status = 201;
      return {
        message: "Registration successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
        fullName: t.String(),
        role: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, jwtAuth, set }) => {
      const { email, password } = body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        set.status = 401;
        return { error: "Invalid credentials", message: "Email hoặc mật khẩu không chính xác" };
      }

      const isValid = bcrypt.compareSync(password, user.passwordHash);
      if (!isValid) {
        set.status = 401;
        return { error: "Invalid credentials", message: "Email hoặc mật khẩu không chính xác" };
      }

      const token = await jwtAuth.sign({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      };
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
    }
  )
  .get(
    "/me",
    async ({ headers, jwtAuth, set }) => {
      const authHeader = headers["authorization"];
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const token = authHeader.slice(7);
      const payload = await jwtAuth.verify(token);
      if (!payload || typeof payload !== "object" || !("id" in payload)) {
        set.status = 401;
        return { error: "Invalid or expired token" };
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.id as string },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { user };
    }
  );
