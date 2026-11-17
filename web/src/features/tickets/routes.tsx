import type { NavItem } from "@/app/nav-item";
import { routes as paths } from "@/lib/routes";
import type { RouteObject } from "react-router";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { TicketsPage } from "./pages/TicketsPage";

export const routes: RouteObject[] = [
  { path: paths.tickets(), element: <TicketsPage /> },
  { path: "/tickets/:ticketId", element: <TicketDetailPage /> },
];

export const nav: NavItem[] = [
  {
    to: paths.tickets(),
    label: "Vé",
    icon: "ticket",
    roles: ["STAFF", "ORGANIZER"],
    order: 40,
  },
];
