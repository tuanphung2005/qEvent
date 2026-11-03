import { createBroadcaster } from "../../../lib/broadcast";

/**
 * Giữ nguyên tên export cũ (`gameSubscribers`, `broadcastToGame`) để mọi import
 * hiện có không phải đổi. Logic nằm ở `src/lib/broadcast.ts`.
 */
const { subscribers, broadcast } = createBroadcaster();

export const gameSubscribers = subscribers;
export const broadcastToGame = broadcast;
