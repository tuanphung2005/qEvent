import type { NavItem } from "@/app/nav-item";
import type { RouteObject } from "react-router";
import { EngagementShell } from "./pages/EngagementShell";
import { PollsPage } from "./pages/PollsPage";
import { QaPage } from "./pages/QaPage";
import { QuizPage } from "./pages/QuizPage";

export const routes: RouteObject[] = [
  {
    path: "/engagement/:sessionId",
    element: <EngagementShell />,
    children: [
      { index: true, element: <QaPage /> },
      { path: "qa", element: <QaPage /> },
      { path: "polls", element: <PollsPage /> },
      { path: "quiz", element: <QuizPage /> },
    ],
  },
  {
    path: "/engagement",
    element: <EngagementShell />,
  },
];

export const nav: NavItem[] = [
  {
    to: "/engagement",
    label: "Tương tác",
    icon: "chart",
    roles: ["HOST", "STAFF", "ORGANIZER"],
    order: 70,
  },
];
