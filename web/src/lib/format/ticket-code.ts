const EMPTY = "—";

function compact(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** "QE-7F3A-91C2" — the only human-readable form of a ticket id. */
export function formatTicketCode(id: string | null | undefined): string {
  if (!id) return EMPTY;
  const clean = compact(id);
  if (clean.length < 8) return `QE-${clean}`;
  return `QE-${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

/** "…91C2" — scan history where the full code does not fit. */
export function shortCode(id: string | null | undefined): string {
  if (!id) return EMPTY;
  const clean = compact(id);
  if (clean.length <= 6) return clean;
  return `…${clean.slice(-4)}`;
}

/** Order/ticket ids are mono and copyable; this keeps them scannable. */
export function truncateId(id: string | null | undefined): string {
  if (!id) return EMPTY;
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}
