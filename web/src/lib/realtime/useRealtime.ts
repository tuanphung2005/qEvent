import { readToken } from "@/lib/api/token";
import { useEffect, useRef, useState } from "react";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "fallback"
  | "offline";

export type RealtimeTarget =
  | { channel: "qa"; sessionId: string }
  | { channel: "game"; gameId: string };

type Options = {
  enabled?: boolean;
  onMessage?: (message: unknown) => void;
  /** Fires once after a dropped socket comes back, so callers refetch one time. */
  onReconnect?: () => void;
};

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
const HEARTBEAT_MS = 25_000;
/** After this long without a socket the caller should switch to polling. */
const FALLBACK_AFTER_MS = 30_000;

function socketUrl(channel: "qa" | "game"): string | null {
  const token = readToken();
  if (!token) return null;
  const configured = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  const base =
    configured && configured.length > 0
      ? configured
      : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  // The token rides in the query string; it is never logged or rendered.
  return `${base}/ws/${channel}?token=${encodeURIComponent(token)}`;
}

/**
 * The single WebSocket client for the console: backoff 1/2/4/8/16/30s with
 * jitter, 25s heartbeat, fallback signal after 30s, one refetch on reconnect.
 * Trọng's engagement screens import this instead of writing their own.
 */
export function useRealtime(target: RealtimeTarget | null, options: Options = {}) {
  const { enabled = true, onMessage, onReconnect } = options;
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const messageRef = useRef(onMessage);
  const reconnectRef = useRef(onReconnect);
  messageRef.current = onMessage;
  reconnectRef.current = onReconnect;

  const channel = target?.channel ?? null;
  const targetId =
    target === null ? null : target.channel === "qa" ? target.sessionId : target.gameId;

  useEffect(() => {
    if (!enabled || !channel || !targetId) {
      setStatus("idle");
      return;
    }

    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let hadConnection = false;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const url = socketUrl(channel);
      if (!url) {
        setStatus("offline");
        return;
      }

      setStatus(hadConnection ? "reconnecting" : "connecting");
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setStatus("open");
        if (hadConnection) reconnectRef.current?.();
        hadConnection = true;
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = undefined;
        }
        socket?.send(
          JSON.stringify(
            channel === "qa"
              ? { type: "JOIN_SESSION", sessionId: targetId }
              : { type: "JOIN_GAME", gameId: targetId },
          ),
        );
        heartbeat = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "PING" }));
        }, HEARTBEAT_MS);
      };

      socket.onmessage = (event) => {
        try {
          messageRef.current?.(JSON.parse(String(event.data)));
        } catch {
          // Non-JSON frames carry nothing the console can act on.
        }
      };

      socket.onclose = (event) => {
        if (heartbeat) clearInterval(heartbeat);
        if (disposed) return;
        // 4401 = the gateway rejected the JWT; retrying cannot fix that.
        if (event.code === 4401) {
          setStatus("offline");
          return;
        }
        fallbackTimer ??= setTimeout(() => setStatus("fallback"), FALLBACK_AFTER_MS);
        const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 30_000;
        attempt += 1;
        retryTimer = setTimeout(connect, base + Math.random() * 400);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [channel, targetId, enabled]);

  return { status };
}
