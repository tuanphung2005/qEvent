import { describe, expect, it } from "bun:test";
import {
  call,
  makeTestApp,
  prisma,
  registerAttendee,
  registerOrganizer,
  registerStaff,
} from "./helpers";

const { app } = makeTestApp();

describe("account picker", () => {
  it("lets an organizer list HOST accounts without credentials", async () => {
    const organizer = await registerOrganizer(app);
    const host = await registerAttendee(app);
    await prisma.user.update({ where: { id: host.userId }, data: { role: "HOST" } });

    const result = await call(app, "/api/users?role=HOST", { token: organizer.token });
    expect(result.status).toBe(200);
    expect(result.data.users.some((user: { id: string }) => user.id === host.userId)).toBe(true);
    expect(result.data.users[0].passwordHash).toBeUndefined();
    expect(result.data.users[0].role).toBe("HOST");
  });

  it("keeps the picker organizer-only", async () => {
    const staff = await registerStaff(app);
    const attendee = await registerAttendee(app);

    const staffResult = await call(app, "/api/users?role=HOST", { token: staff.token });
    const attendeeResult = await call(app, "/api/users?role=HOST", { token: attendee.token });
    expect(staffResult.status).toBe(403);
    expect(attendeeResult.status).toBe(403);
  });
});
