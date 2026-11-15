import type { NavItem } from "@/app/nav-item";
import { routes as paths } from "@/lib/routes";
import type { RouteObject } from "react-router";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";

export const routes: RouteObject[] = [
  { path: paths.orders(), element: <OrdersPage /> },
  { path: "/orders/:orderId", element: <OrderDetailPage /> },
];

export const nav: NavItem[] = [
  {
    to: paths.orders(),
    label: "Đơn hàng",
    icon: "receipt",
    roles: ["STAFF", "ORGANIZER"],
    order: 30,
  },
];
