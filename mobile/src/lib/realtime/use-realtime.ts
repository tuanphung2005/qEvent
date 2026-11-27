import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getToken } from '@/auth/token-store';
import { WS_BASE_URL } from '@/api/env';

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
const FALLBACK_AFTER_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_MS = 25_000;

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'polling';

type UseRealtimeOptions = {
  /** Gateway path, e.g. `/ws/qa` or `/ws/game`. */
  path: string;
  enabled: boolean;
  /** Reconnect when this changes (sessionId / gameId), so JOIN targets the new room. */
  joinKey?: string;
  /** Message sent right after the socket opens (JOIN_SESSION / JOIN_GAME). */
  join?: () => Record<string, unknown> | null;
  onEvent: (payload: unknown) => void;
  /** Polling fallback while the socket cannot connect. */
  onPoll?: () => void;
  /** One refetch after a reconnect so missed events are reconciled. */
  onReconnect?: () => void;
};

export function useRealtime({
  path,
  enabled,
  joinKey,
  join,
  onEvent,
  onPoll,
  onReconnect,
}: UseRealtimeOptions): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('idle');

  const onEventRef = useRef(onEvent);
  const onPollRef = useRef(onPoll);
  const onReconnectRef = useRef(onReconnect);
  const joinRef = useRef(join);

  useEffect(() => {
    onEventRef.current = onEvent;
    onPollRef.current = onPoll;
    onReconnectRef.current = onReconnect;
    joinRef.current = join;
  });

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let hasOpened = false;

    const clearTimers = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      reconnectTimer = null;
      heartbeatTimer = null;
      pollTimer = null;
      fallbackTimer = null;
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const startPolling = () => {
      if (pollTimer || disposed) return;
      setStatus('polling');
      onPollRef.current?.();
      pollTimer = setInterval(() => onPollRef.current?.(), POLL_INTERVAL_MS);
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      const base = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
      const jitter = Math.floor(Math.random() * 400);
      attempt += 1;
      setStatus('reconnecting');
      reconnectTimer = setTimeout(connect, base + jitter);
    };

    async function connect() {
      if (disposed) return;
      clearTimers();
      setStatus(hasOpened ? 'reconnecting' : 'connecting');

      const token = await getToken();
      if (!token || disposed) return;

      const separator = path.includes('?') ? '&' : '?';
      const url = `${WS_BASE_URL}${path}${separator}token=${encodeURIComponent(token)}`;

      try {
        socket = new WebSocket(url);
      } catch {
        startPolling();
        scheduleReconnect();
        return;
      }

      fallbackTimer = setTimeout(() => {
        if (socket?.readyState !== WebSocket.OPEN) {
          startPolling();
        }
      }, FALLBACK_AFTER_MS);

      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        const isReconnect = hasOpened;
        hasOpened = true;
        stopPolling();
        if (fallbackTimer) clearTimeout(fallbackTimer);
        setStatus('open');

        const joinMessage = joinRef.current?.();
        if (joinMessage) socket?.send(JSON.stringify(joinMessage));

        heartbeatTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
          }
        }, HEARTBEAT_MS);

        if (isReconnect) onReconnectRef.current?.();
      };

      socket.onmessage = (event) => {
        try {
          onEventRef.current(JSON.parse(String(event.data)));
        } catch {
          // Ignore non-JSON frames; the server only sends JSON today.
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        if (disposed) return;
        startPolling();
        scheduleReconnect();
      };
    }

    connect();

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && socket?.readyState !== WebSocket.OPEN && !disposed) {
        attempt = 0;
        connect();
      }
    });

    return () => {
      disposed = true;
      clearTimers();
      subscription.remove();
      socket?.close();
      socket = null;
    };
  }, [enabled, path, joinKey]);

  return enabled ? status : 'idle';
}
