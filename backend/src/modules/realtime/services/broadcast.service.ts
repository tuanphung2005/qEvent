import { createBroadcaster } from "../../../lib/broadcast";

/**
 * Giữ nguyên tên export cũ (`sessionSubscribers`, `broadcastToSession`) để mọi
 * import hiện có không phải đổi. Logic nằm ở `src/lib/broadcast.ts`.
 */
const { subscribers, broadcast } = createBroadcaster();

export const sessionSubscribers = subscribers;
export const broadcastToSession = broadcast;
