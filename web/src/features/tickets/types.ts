import type { components } from "@/lib/api/generated";

export type TicketStatus = components["schemas"]["StaffTicket"]["status"];

export const TICKET_STATUSES: TicketStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CHECKED_IN",
  "CANCELLED",
];
