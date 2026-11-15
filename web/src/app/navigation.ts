import type { NavItem } from "./nav-item";

type FeatureRoutes = {
  routes?: unknown[];
  nav?: NavItem[];
  publicRoutes?: unknown[];
};

const modules = import.meta.glob<FeatureRoutes>("../features/*/routes.tsx", { eager: true });

/** Feature owners add a screen by adding `nav` to their routes.tsx; AppShell never changes. */
export const navItems: NavItem[] = Object.values(modules)
  .flatMap((module) => module.nav ?? [])
  .sort((a, b) => a.order - b.order);

export type { NavItem };
