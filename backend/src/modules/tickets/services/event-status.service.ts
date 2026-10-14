export function checkIsEventLive(event: { isLive: boolean; startTime: Date; endTime: Date }): boolean {
  if (event.isLive) return true;
  const now = new Date();
  return now >= new Date(event.startTime) && now <= new Date(event.endTime);
}

export function checkIsSessionLive(
  session: { isLive: boolean; startTime: Date; endTime: Date },
  event?: { isLive: boolean; startTime: Date; endTime: Date }
): boolean {
  if (session.isLive) return true;
  const now = new Date();
  return now >= new Date(session.startTime) && now <= new Date(session.endTime);
}

export function getSessionStatus(
  session: { isLive: boolean; startTime: Date; endTime: Date }
): "UPCOMING" | "LIVE" | "ENDED" {
  if (session.isLive) return "LIVE";
  const now = new Date();
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  if (now < start) return "UPCOMING";
  if (now > end) return "ENDED";
  return "LIVE";
}
