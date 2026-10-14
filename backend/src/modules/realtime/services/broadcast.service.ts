export const sessionSubscribers = new Map<string, Set<any>>();

export function broadcastToSession(sessionId: string, message: any) {
  const subscribers = sessionSubscribers.get(sessionId);
  if (!subscribers) return;
  const payload = JSON.stringify(message);
  for (const ws of subscribers) {
    try {
      ws.send(payload);
    } catch {
      subscribers.delete(ws);
    }
  }
}
