// Map to store connected clients per gameId
export const gameSubscribers = new Map<string, Set<any>>();

export function broadcastToGame(gameId: string, message: any) {
  const subscribers = gameSubscribers.get(gameId);
  if (!subscribers) return;
  const payload = JSON.stringify(message);
  for (const ws of subscribers) {
    try {
      ws.send(payload);
    } catch {
      gameSubscribers.delete(ws);
    }
  }
}
