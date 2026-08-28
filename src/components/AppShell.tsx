import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { NotificationBell } from "@/features/notifications/ui/NotificationBell";
import { cn } from "@/lib/utils";

const primaryNav = [
  { to: "/app", label: "Home", icon: LayoutDashboard },
  { to: "/scores", label: "Scores", icon: Swords },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/players", label: "Players", icon: UsersRound },
  { to: "/seeding", label: "Seeding", icon: ListOrdered, adminOnly: true },
  { to: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

const comingSoonNav = [
  { label: "Bookings", icon: CalendarDays },
  { label: "Attendance", icon: ClipboardCheck },
  { label: "Insights", icon: BarChart3 },
];

function NavItems({ compact = false }: { compact?: boolean }) {
  const { role } = useAuth();
  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className={cn("grid gap-4", compact && "gap-0")}>
      <nav className={cn("grid gap-1", compact && "flex justify-around gap-0")}>
        {primaryNav.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            className={({ isActive }) => cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              isActive && !compact && "bg-secondary text-foreground before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:shadow-glow-primary",
              isActive && compact && "text-foreground",
              compact && "h-14 flex-1 flex-col justify-center gap-1 px-1 py-1 text-[11px] rounded-none",
            )}
          >
            {({ isActive }) => (
              <>
                {compact && isActive ? (
                  <span className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-primary" aria-hidden />
                ) : null}
                <item.icon className={cn("h-4 w-4", compact && "h-[18px] w-[18px]", compact && isActive && "text-primary")} strokeWidth={compact && isActive ? 2.4 : 2} />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {compact ? null : (
        <div className="grid gap-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Coming soon</p>
          {comingSoonNav.map((item) => (
            <div
              key={item.label}
              aria-disabled
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50"
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
              <Badge variant="status" className="ml-auto">Soon</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pageTitle(pathname: string) {
  const active = primaryNav.find((item) => item.to === pathname);
  return active?.label ?? "Home";
}

export function AppShell() {
  const { demoMode, isLoading, profile, role, signOut } = useAuth();
  const { mode, setMode } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border/70 bg-background lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-3 px-5">
            <img
              src="/logo.jpg"
              alt="The Akhada logo"
              className="h-11 w-11 rounded-xl object-cover ring-1 ring-border/60 shadow-card"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold tracking-tight">The Akhada</p>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tennis club</p>
            </div>
          </div>
          <div className="px-3">
            <NavItems />
          </div>
          <div className="mt-auto p-4">
            <div className="card-base p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Backend</span>
                <Badge variant={demoMode ? "status" : "accent"}>{demoMode ? "Demo" : "Live"}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {demoMode ? "Connect Supabase env vars to switch from demo data." : "Live Supabase project connected."}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <div className="mb-6 flex items-center gap-3">
                    <img
                      src="/logo.jpg"
                      alt="The Akhada logo"
                      className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/60 shadow-card"
                    />
                    <div>
                      <p className="font-display text-base font-bold tracking-tight">The Akhada</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tennis club</p>
                    </div>
                  </div>
                  <NavItems />
                </SheetContent>
              </Sheet>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Today</p>
                <h1 className="font-display text-lg font-bold tracking-tight sm:text-xl">{pageTitle(location.pathname)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? <Badge variant="outline">Syncing</Badge> : null}
              {profile ? (
                <Badge variant="outline" className="hidden max-w-[220px] truncate capitalize sm:inline-flex">
                  {profile.fullName} · {role}
                </Badge>
              ) : null}
              {!demoMode ? <NotificationBell /> : null}
              <Button
                variant="outline"
                size="icon"
                aria-label="Toggle theme"
                onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              >
                {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {!demoMode ? (
                <Button variant="outline" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
                  <LogOut className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-2 py-1 backdrop-blur lg:hidden">
        <NavItems compact />
      </div>
    </div>
  );
}
