import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import { useQuery } from "@tanstack/react-query";
import type { OrderStatus } from "./types";

export type OrdersFilter = {
  eventId: string;
  status?: OrderStatus;
  q?: string;
  cursor?: string;
};

const PAGE_SIZE = 20;

export function useOrders(filter: OrdersFilter | null) {
  return useQuery({
    queryKey: qk.orders.list(filter ?? {}),
    queryFn: async () => {
      if (!filter) throw new Error("Chưa chọn sự kiện");
      return unwrap(
        await api.GET("/api/orders", { params: { query: { ...filter, limit: PAGE_SIZE } } }),
      );
    },
    enabled: filter !== null,
    placeholderData: (previous) => previous,
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: qk.orders.detail(orderId ?? "none"),
    queryFn: async () =>
      unwrap(await api.GET("/api/orders/{id}", { params: { path: { id: orderId ?? "" } } })),
    enabled: Boolean(orderId),
  });
}
