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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  "--sidebar-width": "240px",
  "--sidebar-width-icon": "72px",
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
          <Link to={routes.dashboard()} className="flex h-12 items-center gap-2 px-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              qE
            </span>
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
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 bg-card px-4 shadow-subtle md:px-5 lg:px-6">
          <SidebarTrigger className="hidden md:inline-flex" />
          {eventsLoading ? (
            <Skeleton className="h-11 w-[220px] md:w-[280px]" />
          ) : (
            <Select
              value={eventId ?? ""}
              onValueChange={(value) => value && setEventId(value)}
              disabled={events.length === 0}
            >
              <SelectTrigger
                aria-label="Sự kiện đang chọn"
                className="h-11 w-[220px] bg-secondary md:w-[280px]"
              >
                <SelectValue
                  placeholder={events.length === 0 ? "Chưa có sự kiện" : "Chọn sự kiện"}
                />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Tài khoản ${user.fullName}`}
                    className="flex h-11 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {user.fullName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[160px] truncate text-sm font-semibold text-foreground sm:block">
                      {user.fullName}
                    </span>
                  </button>
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

        <main className="flex-1 px-4 py-6 pb-24 md:px-5 md:pb-6 lg:px-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
            <Outlet />
          </div>
        </main>

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
