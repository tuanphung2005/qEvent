type WsClient = {
  send(message: string): void;
};

class BroadcastManager {
  private qaRooms = new Map<string, Set<WsClient>>();
  private gameRooms = new Map<string, Set<WsClient>>();

  subscribeQa(sessionId: string, client: WsClient): () => void {
    let room = this.qaRooms.get(sessionId);
    if (!room) {
      room = new Set();
      this.qaRooms.set(sessionId, room);
    }
    room.add(client);

    return () => {
      room?.delete(client);
      if (room && room.size === 0) this.qaRooms.delete(sessionId);
    };
  }

  broadcastQa(sessionId: string, payload: unknown) {
    const room = this.qaRooms.get(sessionId);
    if (!room) return;
    const data = JSON.stringify(payload);
    for (const client of room) {
      try {
        client.send(data);
      } catch {}
    }
  }

  subscribeGame(gameId: string, client: WsClient): () => void {
    let room = this.gameRooms.get(gameId);
    if (!room) {
      room = new Set();
      this.gameRooms.set(gameId, room);
    }
    room.add(client);

    return () => {
      room?.delete(client);
      if (room && room.size === 0) this.gameRooms.delete(gameId);
    };
  }

  broadcastGame(gameId: string, payload: unknown) {
    const room = this.gameRooms.get(gameId);
    if (!room) return;
    const data = JSON.stringify(payload);
    for (const client of room) {
      try {
        client.send(data);
      } catch {}
    }
  }
}

export const broadcaster = new BroadcastManager();
