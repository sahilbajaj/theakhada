import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BellRing, ListOrdered, ShieldCheck, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const YEAR = new Date().getFullYear();

interface Feature {
  icon: typeof Swords;
  title: string;
  detail: string;
}

const FEATURES: Feature[] = [
  {
    icon: Swords,
    title: "Courtside match scoring",
    detail: "Singles or doubles, best-of-1/3/5, tiebreaks and super tiebreaks. Any member starts a match, anyone can save the next set.",
  },
  {
    icon: ListOrdered,
    title: "Club rankings and seeding",
    detail: "Live ratings and drag-to-reorder seeding blend rating, recent form, and how often you've played.",
  },
  {
    icon: Trophy,
    title: "Personal stats",
    detail: "This month's W-L, current streak, form strip, most-played opponents, and a per-player match history.",
  },
  {
    icon: BellRing,
    title: "Activity feed",
    detail: "In-app bell with unread badge, a scrollable feed of match results, and one-tap open on any card.",
  },
  {
    icon: ShieldCheck,
    title: "Admin controls",
    detail: "Approve access requests, invite members, adjust roles, nicknames, ratings, and avatars.",
  },
];

export default function Landing() {
  const { accessStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (accessStatus === "approved") navigate("/app", { replace: true });
  }, [accessStatus, navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Akhada Tennis Club logo" className="h-10 w-10 rounded-md object-cover" />
          <span className="text-lg font-semibold">The Akhada</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild size="sm">
            <Link to="/privacy">Privacy</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">
              Sign in
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-center">
        <div className="grid gap-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Akhada Tennis Club</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Score matches, track rankings, and keep the club moving.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            The Akhada is a private club-operations app for our tennis members. Record scores courtside,
            see live rankings and seeds, get pinged when a match involving you is finalized, and let
            admins run access, invites, and roles from one place.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link to="/auth">
                Sign in or request access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#features">See what it does</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Access is limited to approved club members. New here? Request access from the sign-in page
            and a club admin will approve you.
          </p>
        </div>

        <div className="grid place-items-center">
          <img
            src="/logo.jpg"
            alt="Akhada Tennis Club logo"
            className="h-56 w-56 rounded-2xl object-cover shadow-lg sm:h-72 sm:w-72"
          />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">What's inside</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="grid gap-2 rounded-lg border bg-card p-4 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>© {YEAR} The Akhada. Built for our club, hosted on Supabase and AWS Amplify.</p>
          <nav className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
