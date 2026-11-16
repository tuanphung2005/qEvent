import type { NavItem } from "@/app/nav-item";
import { routes as paths } from "@/lib/routes";
import type { RouteObject } from "react-router";
import { SettingsPage } from "./pages/SettingsPage";

export const routes: RouteObject[] = [{ path: paths.settings(), element: <SettingsPage /> }];

export const nav: NavItem[] = [
  {
    to: paths.settings(),
    label: "Tài khoản",
    icon: "settings",
    roles: ["STAFF", "ORGANIZER"],
    order: 90,
  },
];
