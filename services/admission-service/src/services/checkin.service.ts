import crypto from "node:crypto";
import type { Deps } from "../deps";
import type { CurrentUser } from "../lib/auth";
import { isStaffOrOrganizer } from "../lib/auth";
import { verifyQrToken, verifyQrTokenSignature, verifyTotp } from "../lib/qr";
import type { ServiceResult } from "../lib/result";

export type OfflineScan = {
  ticketId: string;
  scannedAt: string;
  deviceId?: string;
  /** Optional: signed token captured at the gate. Old queues do not have it. */
  qrToken?: string;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const QR_ERRORS: Record<string, string> = {
  MALFORMED: "Dynamic QR token is malformed",
  BAD_SIGNATURE: "Dynamic QR signature is invalid",
  EXPIRED: "Dynamic QR token has expired",
  FUTURE: "Dynamic QR token timestamp is in the future",
};

export async function checkIn(
  deps: Deps,
  user: CurrentUser | null,
  input: { qrToken: string; deviceId?: string; gate?: string }
): Promise<ServiceResult> {
  if (!isStaffOrOrganizer(user)) {
    return { status: 403, body: { code: "FORBIDDEN", message: "Staff role is required" } };
  }

  const now = deps.now();
  const verification = verifyQrToken(input.qrToken, deps.keys.publicKey, now.getTime());
  if (!verification.valid) {
    return {
      status: 400,
      body: { code: "INVALID_QR_TOKEN", message: QR_ERRORS[verification.error] },
    };
  }

  const { tid, eid, code } = verification.payload;
  const ticket = await deps.prisma.ticket.findUnique({
    where: { id: tid },
    include: { user: true, order: true },
  });

  if (!ticket || ticket.eventId !== eid) {
    return {
      status: 400,
      body: { code: "INVALID_QR_TOKEN", message: "Ticket does not match this QR token" },
    };
  }

  if (ticket.order.status !== "CONFIRMED") {
    return {
      status: 409,
      body: { code: "ORDER_NOT_CONFIRMED", message: "Ticket order is not confirmed" },
    };
  }

  if (!verifyTotp(ticket.qrSecret, code, now.getTime())) {
    return {
      status: 400,
      body: { code: "INVALID_QR_TOKEN", message: QR_ERRORS.EXPIRED },
    };
  }

  const result = await deps.prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({
      where: { id: ticket.id, status: "PAID" },
      data: { status: "CHECKED_IN", checkedInAt: now },
    });
    if (updated.count === 0) return { accepted: false as const };

    const log = await tx.checkinLog.create({
      data: {
        ticketId: ticket.id,
        scannedBy: user!.id,
        scannedAt: now,
        isOffline: false,
        deviceId: input.deviceId ?? input.gate ?? null,
        syncStatus: "SYNCED",
        scanKey: crypto.randomUUID(),
      },
    });
    return { accepted: true as const, log };
  });

  if (!result.accepted) {
    const current = await deps.prisma.ticket.findUnique({ where: { id: ticket.id } });
    if (current?.status === "CHECKED_IN") {
      return {
        status: 409,
        body: {
          code: "ALREADY_CHECKED_IN",
          message: "Ticket has already been checked in",
          ticket: {
            id: current.id,
            status: current.status,
            checkedInAt: current.checkedInAt,
            attendeeName: ticket.user.fullName,
          },
        },
      };
    }
    return {
      status: 400,
      body: { code: "INVALID_TICKET_STATUS", message: `Ticket status is ${current?.status}` },
    };
  }

  return {
    status: 201,
    body: {
      status: "CHECKIN_SUCCESS",
      code: "CHECKIN_SUCCESS",
      ticket: {
        id: ticket.id,
        status: "CHECKED_IN",
        checkedInAt: now,
        attendeeName: ticket.user.fullName,
      },
      logId: result.log.id,
    },
  };
}

type ScanResult = {
  ticketId: string;
  status: "SYNCED" | "CONFLICT" | "DUPLICATE" | "ERROR";
  reason?: string;
  message?: string;
  attendeeName?: string;
  logId?: string;
};

/** A device clock can drift; anything further ahead than this is not trusted. */
const FUTURE_SKEW_MS = 5 * 60_000;

export async function syncOffline(
  deps: Deps,
  user: CurrentUser | null,
  eventId: string,
  scans: OfflineScan[]
): Promise<ServiceResult> {
  if (!isStaffOrOrganizer(user)) {
    return { status: 403, body: { code: "FORBIDDEN", message: "Staff role is required" } };
  }

  const now = deps.now();
  const time = (scan: OfflineScan) => {
    const value = new Date(scan.scannedAt).getTime();
    return Number.isNaN(value) ? 0 : value;
  };
  const ordered = [...scans].sort((a, b) => time(a) - time(b));

  const results: ScanResult[] = [];
  let synced = 0;
  let conflicts = 0;
  let duplicates = 0;

  // Two prefetch queries replace two lookups per scan.
  const ticketIds = [...new Set(ordered.map((scan) => scan.ticketId))];
  const tickets = ticketIds.length
    ? await deps.prisma.ticket.findMany({
        where: { id: { in: ticketIds } },
        include: { user: { select: { fullName: true } } },
      })
    : [];
  const byTicketId = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  const keyOf = (scan: OfflineScan, deviceId: string, scannedAt: Date) =>
    sha256(`${scan.ticketId}|${deviceId}|${scannedAt.toISOString()}`);

  for (const scan of ordered) {
    const scannedAt = new Date(scan.scannedAt);
    if (Number.isNaN(scannedAt.getTime()) || scannedAt.getTime() > now.getTime() + FUTURE_SKEW_MS) {
      results.push({ ticketId: scan.ticketId, status: "ERROR", reason: "INVALID_TIMESTAMP" });
      continue;
    }

    const deviceId = scan.deviceId ?? "offline_device";
    const scanKey = keyOf(scan, deviceId, scannedAt);

    const ticket = byTicketId.get(scan.ticketId);
    if (!ticket) {
      results.push({ ticketId: scan.ticketId, status: "ERROR", reason: "TICKET_NOT_FOUND" });
      continue;
    }
    // Event scope check first; signed-token checks (when present) follow.
    if (ticket.eventId !== eventId) {
      results.push({ ticketId: scan.ticketId, status: "ERROR", reason: "EVENT_MISMATCH" });
      continue;
    }

    // New clients include the signed token. Verify it at the physical scan time
    // so a token that was valid at the gate cannot be replayed hours later.
    if (scan.qrToken) {
      const verified = verifyQrTokenSignature(scan.qrToken, deps.keys.publicKey);
      if (!verified.valid) {
        results.push({ ticketId: scan.ticketId, status: "ERROR", reason: "INVALID_QR_TOKEN" });
        continue;
      }
      if (verified.payload.tid !== ticket.id || verified.payload.eid !== eventId) {
        results.push({
          ticketId: scan.ticketId,
          status: "ERROR",
          reason: "QR_TICKET_MISMATCH",
        });
        continue;
      }
      if (!verifyTotp(ticket.qrSecret, verified.payload.code, scannedAt.getTime())) {
        results.push({ ticketId: scan.ticketId, status: "ERROR", reason: "INVALID_QR_TOKEN" });
        continue;
      }
    }

    const replay = await deps.prisma.checkinLog.findUnique({ where: { scanKey } });
    if (replay) {
      duplicates++;
      results.push({ ticketId: scan.ticketId, status: "DUPLICATE", logId: replay.id });
      continue;
    }

    try {
      const outcome = await deps.prisma.$transaction(async (tx) => {
        const current = await tx.ticket.findUnique({ where: { id: ticket.id } });
        if (!current) return { kind: "ERROR" as const, reason: "TICKET_NOT_FOUND" };

        if (current.status === "CHECKED_IN") {
          // Earliest physical scan wins, even when a later batch arrived first.
          if (!current.checkedInAt || current.checkedInAt.getTime() > scannedAt.getTime()) {
            await tx.ticket.updateMany({
              where: { id: ticket.id, checkedInAt: { gt: scannedAt } },
              data: { checkedInAt: scannedAt },
            });
          }

          const log = await tx.checkinLog.create({
            data: {
              ticketId: ticket.id,
              scannedBy: user!.id,
              scannedAt,
              isOffline: true,
              deviceId,
              syncStatus: "CONFLICT",
              scanKey,
            },
          });
          return { kind: "CONFLICT" as const, logId: log.id };
        }

        if (current.status !== "PAID") {
          return { kind: "ERROR" as const, reason: `INVALID_STATUS:${current.status}` };
        }

        const updated = await tx.ticket.updateMany({
          where: { id: ticket.id, status: "PAID" },
          data: { status: "CHECKED_IN", checkedInAt: scannedAt },
        });
        if (updated.count === 0) {
          // Another writer won the race. Re-read so an earlier offline scan can
          // still replace a later check-in timestamp.
          const latest = await tx.ticket.findUnique({ where: { id: ticket.id } });
          if (latest?.status === "CHECKED_IN") {
            if (!latest.checkedInAt || latest.checkedInAt.getTime() > scannedAt.getTime()) {
              await tx.ticket.updateMany({
                where: { id: ticket.id, checkedInAt: { gt: scannedAt } },
                data: { checkedInAt: scannedAt },
              });
            }
            const log = await tx.checkinLog.create({
              data: {
                ticketId: ticket.id,
                scannedBy: user!.id,
                scannedAt,
                isOffline: true,
                deviceId,
                syncStatus: "CONFLICT",
                scanKey,
              },
            });
            return { kind: "CONFLICT" as const, logId: log.id };
          }
          return { kind: "ERROR" as const, reason: `INVALID_STATUS:${latest?.status}` };
        }

        const log = await tx.checkinLog.create({
          data: {
            ticketId: ticket.id,
            scannedBy: user!.id,
            scannedAt,
            isOffline: true,
            deviceId,
            syncStatus: "SYNCED",
            scanKey,
          },
        });
        return { kind: "SYNCED" as const, logId: log.id };
      });

      if (outcome.kind === "SYNCED") {
        synced++;
        results.push({
          ticketId: ticket.id,
          status: "SYNCED",
          attendeeName: ticket.user.fullName,
          logId: outcome.logId,
        });
      } else if (outcome.kind === "CONFLICT") {
        conflicts++;
        results.push({
          ticketId: ticket.id,
          status: "CONFLICT",
          message: "Ticket had already been checked in",
          logId: outcome.logId,
        });
      } else {
        results.push({ ticketId: ticket.id, status: "ERROR", reason: outcome.reason });
      }
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002") {
        duplicates++;
        results.push({ ticketId: ticket.id, status: "DUPLICATE" });
        continue;
      }
      throw error;
    }
  }

  return {
    status: 200,
    body: {
      processed: ordered.length,
      synced,
      conflicts,
      duplicates,
      results,
    },
  };
}
