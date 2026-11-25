import type { NavItem } from "@/app/nav-item";
import type { RouteObject } from "react-router";
import { PresentPage } from "./pages/PresentPage";

/** Full-screen routes render without the console sidebar; auth is still enforced by the router. */
export const fullscreenRoutes: RouteObject[] = [
  { path: "/present", element: <PresentPage /> },
  { path: "/present/:sessionId", element: <PresentPage /> },
];

export const nav: NavItem[] = [
  {
    to: "/present",
    label: "Trình chiếu",
    icon: "present",
    roles: ["HOST", "ORGANIZER"],
    order: 20,
  },
];
