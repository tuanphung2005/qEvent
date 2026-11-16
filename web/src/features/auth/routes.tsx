import { routes as paths } from "@/lib/routes";
import type { RouteObject } from "react-router";
import { LoginPage } from "./pages/LoginPage";

/** Public by design: the console gate is RequireRole, /login sits outside it. */
export const publicRoutes: RouteObject[] = [{ path: paths.login(), element: <LoginPage /> }];

export const nav = [];
