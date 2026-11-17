import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CheckinOutcome } from "./scan-result";

const FEED_LIMIT = 50;

export function useCheckinFeed(eventId: string | null, gate: string, paused: boolean) {
  return useQuery({
    queryKey: qk.checkins.list({ eventId, gate }),
    queryFn: async () => {
      if (!eventId) throw new Error("Chưa chọn sự kiện");
      return unwrap(
        await api.GET("/api/checkins", {
          params: {
            query: { eventId, gate: gate || undefined, limit: FEED_LIMIT },
          },
        }),
      );
    },
    enabled: Boolean(eventId),
    // 3s while the tab is active; pause is explicit and `refetchIntervalInBackground`
    // stays false so a hidden tab never keeps polling.
    refetchInterval: paused ? false : 3000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });
}

export function useAdmissionStats(eventId: string | null, paused: boolean) {
  return useQuery({
    queryKey: qk.checkins.stats(eventId ?? "none"),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/checkins/stats", {
          params: { query: { eventId: eventId ?? "" } },
        }),
      ),
    enabled: Boolean(eventId),
    // Counters follow the feed so both leave stale data at the same moment.
    refetchInterval: paused ? false : 3000,
    refetchIntervalInBackground: false,
  });
}

type CheckinErrorBody = {
  code?: string;
  message?: string;
  ticket?: { id?: string; attendeeName?: string; checkedInAt?: string | null };
};

/** Never throws: the scan screen renders every outcome, including network loss. */
export function useCheckIn() {
  return useMutation({
    mutationFn: async ({
      qrToken,
      gate,
    }: {
      qrToken: string;
      gate: string;
    }): Promise<CheckinOutcome> => {
      try {
        const result = await api.POST("/api/checkins", {
          body: { qrToken, gate, deviceId: gate },
        });

        if (result.response.status === 201 && result.data) {
          return {
            status: 201,
            code: result.data.code,
            ticketId: result.data.ticket.id,
            attendeeName: result.data.ticket.attendeeName,
            at: result.data.ticket.checkedInAt,
          };
        }

        const body = result.error as CheckinErrorBody | null;
        return {
          status: result.response.status,
          code: body?.code ?? "UNKNOWN",
          message: body?.message ?? null,
          ticketId: body?.ticket?.id ?? null,
          attendeeName: body?.ticket?.attendeeName ?? null,
          at: body?.ticket?.checkedInAt ?? null,
        };
      } catch {
        return { status: 0, code: "NETWORK" };
      }
    },
  });
}
