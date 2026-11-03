/**
 * Một bộ broadcast WebSocket dùng chung cho game và realtime.
 *
 * Hai module trước đây có hai bản copy gần giống hệt; bản game đã lệch và gọi
 * `gameSubscribers.delete(ws)` — xoá key sai trên Map nên socket chết không bao
 * giờ được dọn. Giữ một bản duy nhất ở đây.
 */
export type Broadcaster = {
  /** Map<khoá phòng, tập socket đang kết nối>. Export để WS handler tự thêm/xoá. */
  subscribers: Map<string, Set<any>>;
  broadcast: (key: string, message: unknown) => void;
};

export function createBroadcaster(): Broadcaster {
  const subscribers = new Map<string, Set<any>>();

  function broadcast(key: string, message: unknown) {
    const room = subscribers.get(key);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const ws of room) {
      try {
        ws.send(payload);
      } catch {
        room.delete(ws);
      }
    }
  }

  return { subscribers, broadcast };
}
