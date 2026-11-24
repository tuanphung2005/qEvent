export type NavRole = "HOST" | "STAFF" | "ORGANIZER";

/** The contract every feature routes.tsx satisfies (see docs/STAFF_WEB_TEAM_SPLIT.md §4.2). */
export type NavItem = {
  to: string;
  /** Vietnamese label; two words maximum. */
  label: string;
  icon: "calendar" | "receipt" | "ticket" | "scan" | "chart" | "settings" | "users" | "present";
  roles: NavRole[];
  order: number;
};
