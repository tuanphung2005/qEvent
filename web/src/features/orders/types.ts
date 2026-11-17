import type { components } from "@/lib/api/generated";

/** Response shapes stay in `lib/api/types.ts`; these are only narrowed unions. */
export type OrderStatus = components["schemas"]["StaffOrder"]["status"];

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PENDING_RECONCILIATION",
  "COMPENSATING",
  "CONFIRMED",
  "FAILED",
];
