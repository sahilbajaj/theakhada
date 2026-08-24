import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Crown,
  LayoutDashboard,
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
import { cn } from "@/lib/utils";

const primaryNav = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/scores", label: "Scores", icon: Swords },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/players", label: "Players", icon: UsersRound },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/insights", label: "Stats", icon: BarChart3 },
];

function NavItems({ compact = false }: { compact?: boolean }) {
  return (
    <nav className={cn("grid gap-1", compact && "grid-cols-4")}>
      {primaryNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            compact && "h-14 flex-col justify-center gap-1 px-1 py-1 text-[11px]",
          )}
        >
          <item.icon className={cn("h-4 w-4", compact && "h-5 w-5")} />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function pageTitle(pathname: string) {
  const active = primaryNav.find((item) => item.to === pathname);
  return active?.label ?? "Home";
}

export function AppShell() {
  const { demoMode, isLoading } = useAuth();
  const { mode, setMode } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-3 px-5">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Crown className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">The Akhada</p>
              <p className="text-sm text-muted-foreground">Tennis operations</p>
            </div>
          </div>
          <div className="px-3">
            <NavItems />
          </div>
          <div className="mt-auto p-4">
            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Backend</span>
                <Badge variant={demoMode ? "secondary" : "default"}>{demoMode ? "Demo" : "Supabase"}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {demoMode ? "Connect Supabase env vars to switch from demo data." : "Live Supabase project connected."}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
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
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <Crown className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">The Akhada</p>
                      <p className="text-sm text-muted-foreground">Tennis operations</p>
                    </div>
                  </div>
                  <NavItems />
                </SheetContent>
              </Sheet>
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <h1 className="text-lg font-semibold sm:text-xl">{pageTitle(location.pathname)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoading ? <Badge variant="outline">Syncing</Badge> : null}
              <Button
                variant="outline"
                size="icon"
                aria-label="Toggle theme"
                onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              >
                {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-2 py-2 lg:hidden">
        <NavItems compact />
      </div>
    </div>
  );
}
