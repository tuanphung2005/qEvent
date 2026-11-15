import type { NavItem } from "@/app/nav-item";
import { routes as paths } from "@/lib/routes";
import type { RouteObject } from "react-router";
import { CheckinsPage } from "./pages/CheckinsPage";
import { ScanPage } from "./pages/ScanPage";
import { SyncPage } from "./pages/SyncPage";

export const routes: RouteObject[] = [
  { path: paths.checkins(), element: <CheckinsPage /> },
  { path: paths.scan(), element: <ScanPage /> },
  { path: paths.sync(), element: <SyncPage /> },
];

export const nav: NavItem[] = [
  {
    to: paths.checkins(),
    label: "Check-in",
    icon: "users",
    roles: ["STAFF", "ORGANIZER"],
    order: 50,
  },
  {
    to: paths.scan(),
    label: "Quét vé",
    icon: "scan",
    roles: ["STAFF", "ORGANIZER"],
    order: 60,
  },
];
