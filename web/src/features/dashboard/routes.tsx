import type { NavItem } from "@/app/nav-item";
import { routes as paths } from "@/lib/routes";
import type { RouteObject } from "react-router";
import { DashboardPage } from "./pages/DashboardPage";

export const routes: RouteObject[] = [{ path: paths.dashboard(), element: <DashboardPage /> }];

export const nav: NavItem[] = [
  {
    to: paths.dashboard(),
    label: "Tổng quan",
    icon: "chart",
    roles: ["STAFF", "ORGANIZER"],
    order: 10,
  },
];
