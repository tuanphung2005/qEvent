import { Navigate, Outlet, type RouteObject, createBrowserRouter } from "react-router";
import { AppShell } from "./AppShell";
import { RouteError } from "./ErrorBoundary";
import { NotFoundPage } from "./NotFound";
import { RequireRole } from "./RequireRole";

type FeatureModule = {
  routes?: RouteObject[];
  publicRoutes?: RouteObject[];
  fullscreenRoutes?: RouteObject[];
};

/**
 * Routes and nav are collected from features/*\/routes.tsx. Adding a screen
 * means adding a file inside your own feature — this file and AppShell stay closed.
 */
const modules = import.meta.glob<FeatureModule>("../features/*/routes.tsx", { eager: true });
const featureRoutes = Object.values(modules).flatMap((module) => module.routes ?? []);
const publicRoutes = Object.values(modules).flatMap((module) => module.publicRoutes ?? []);
const fullscreenRoutes = Object.values(modules).flatMap((module) => module.fullscreenRoutes ?? []);

export const router = createBrowserRouter([
  ...publicRoutes,
  {
    errorElement: <RouteError />,
    element: (
      <RequireRole>
        <Outlet />
      </RequireRole>
    ),
    children: fullscreenRoutes,
  },
  {
    errorElement: <RouteError />,
    element: (
      <RequireRole>
        <AppShell />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...featureRoutes,
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
