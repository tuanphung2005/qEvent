import type { NavItem } from "@/app/nav-item";
import { routes as paths } from "@/lib/routes";
import type { RouteObject } from "react-router";
import { EventDetailLayout } from "./pages/EventDetailLayout";
import { EventNewPage } from "./pages/EventNewPage";
import { EventOverviewPage } from "./pages/EventOverviewPage";
import { EventsPage } from "./pages/EventsPage";
import { HostsTab } from "./pages/HostsTab";
import { RoomsTab } from "./pages/RoomsTab";
import { SessionsTab } from "./pages/SessionsTab";
import { TicketTypesTab } from "./pages/TicketTypesTab";

export const routes: RouteObject[] = [
  { path: paths.events(), element: <EventsPage /> },
  { path: "/events/new", element: <EventNewPage /> },
  {
    path: paths.event(":eventId"),
    element: <EventDetailLayout />,
    children: [
      { index: true, element: <EventOverviewPage /> },
      { path: "rooms", element: <RoomsTab /> },
      { path: "sessions", element: <SessionsTab /> },
      { path: "ticket-types", element: <TicketTypesTab /> },
      { path: "hosts", element: <HostsTab /> },
    ],
  },
];

export const nav: NavItem[] = [
  {
    to: paths.events(),
    label: "Sự kiện",
    icon: "calendar",
    roles: ["STAFF", "ORGANIZER"],
    order: 10,
  },
];
