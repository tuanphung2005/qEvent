import { EventSelect } from "@/components/event-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useEventContext } from "@/lib/event-context";
import { statusLabel, statusTone, statusToneClass } from "@/lib/format/status-label";
import { routes } from "@/lib/routes";
import {
  Calendar,
  ChartColumn,
  LogOut,
  Receipt,
  ScanLine,
  Settings,
  Ticket,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import type { NavItem } from "./nav-item";
import { navItems } from "./navigation";

const NAV_ICON: Record<NavItem["icon"], LucideIcon> = {
  calendar: Calendar,
  receipt: Receipt,
  ticket: Ticket,
  scan: ScanLine,
  chart: ChartColumn,
  settings: Settings,
  users: Users,
};

const SIDEBAR_WIDTH = {
  "--sidebar-width": "200px",
  "--sidebar-width-icon": "64px",
} as CSSProperties;

function visibleNav(role: string | undefined): NavItem[] {
  if (!role) return [];
  return navItems.filter((item) => item.roles.includes(role as NavItem["roles"][number]));
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { eventId, setEventId, events, isLoading: eventsLoading } = useEventContext();
  const items = visibleNav(user?.role);
  const location = useLocation();
  // DESIGN.md: 240px sidebar from 1280, 72px rail from 768, bottom nav below 768.
  const [wide] = useState(() => window.matchMedia("(min-width: 1280px)").matches);

  return (
    <SidebarProvider style={SIDEBAR_WIDTH} defaultOpen={wide}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            to={routes.dashboard()}
            aria-label="qEvent"
            className="flex h-10 items-center gap-2 px-2"
          >
            <img
              src="/icon-64.png"
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-md"
            />
            <span className="truncate text-sm font-semibold text-foreground group-data-[collapsible=icon]:hidden">
              qEvent
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = NAV_ICON[item.icon];
                  const active =
                    item.to === routes.dashboard()
                      ? location.pathname === routes.dashboard()
                      : location.pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild tooltip={item.label} isActive={active} size="lg">
                        <Link to={item.to}>
                          <Icon />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 bg-card px-3 shadow-subtle md:px-4 lg:px-5">
          <SidebarTrigger className="hidden md:inline-flex" />
          {eventsLoading ? (
            <Skeleton className="h-8 w-[200px] md:w-[240px]" />
          ) : (
            <EventSelect
              events={events}
              value={eventId}
              onValueChange={setEventId}
              label="Sự kiện đang chọn"
              className="w-[200px] md:w-[240px]"
            />
          )}

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 gap-2 px-1.5">
                    <span
                      aria-hidden="true"
                      className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                    >
                      {user.fullName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[160px] truncate text-sm font-semibold text-foreground sm:block">
                      {user.fullName}
                    </span>
                    <span className="sr-only">Tài khoản</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-foreground">{user.fullName}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                    <Badge
                      variant="secondary"
                      className={`mt-1 w-fit ${statusToneClass(statusTone(user.role))}`}
                    >
                      {statusLabel(user.role)}
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={routes.settings()}>
                      <Settings />
                      Tài khoản
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={logout}>
                    <LogOut />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <span className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="Đăng xuất" onClick={logout}>
                <LogOut />
              </Button>
            </span>
          </div>
        </header>

        {/* SidebarInset already renders the page's single <main> landmark. */}
        <div className="flex-1 px-4 py-4 pb-20 md:px-5 md:pb-4 lg:px-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
            <Outlet />
          </div>
        </div>

        {items.length > 0 ? (
          <nav
            aria-label="Điều hướng dưới"
            className="fixed inset-x-0 bottom-0 z-20 flex bg-card px-2 pb-[env(safe-area-inset-bottom)] shadow-float md:hidden"
          >
            {items.slice(0, 5).map((item) => {
              const Icon = NAV_ICON[item.icon];
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === routes.dashboard()}
                  className={({ isActive }) =>
                    [
                      "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-label",
                      isActive ? "text-primary" : "text-muted-foreground",
                    ].join(" ")
                  }
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}
