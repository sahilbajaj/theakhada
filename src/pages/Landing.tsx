import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BellRing, ListOrdered, ShieldCheck, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    title: "Courtside scoring",
    detail: "Singles or doubles, best-of-1/3/5, tiebreaks and super tiebreaks. Any member starts a match, anyone can save the next set.",
  },
  {
    icon: ListOrdered,
    title: "Live rankings & seeding",
    detail: "Ratings and drag-to-reorder seeding blend rating, recent form, and how often you've played — recomputed as matches finalize.",
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
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient court wash — cheap, no assets */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-court-wash" aria-hidden />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="The Akhada logo"
            className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/60 shadow-card"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-base font-bold tracking-tight">The Akhada</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tennis club</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex">
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

      <section className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-14">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="grid gap-6">
            <Badge variant="live" className="w-fit"><span className="live-dot" />Live for members</Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Play.<br />Track.<br />
              <span className="bg-primary-lime bg-clip-text text-transparent">Rank.</span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Your club, on the court. Record scores courtside, watch rankings shift as matches finalize,
              and get pinged when a match involving you wraps.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Sign in
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/auth">Request access</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Access is limited to approved members. New here? Request access from the sign-in page and a club admin will approve you.
            </p>
          </div>

          <CourtVisual />
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Features</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Everything the club needs</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group card-base p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-lime text-primary-foreground shadow-glow-primary">
                <f.icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <h3 className="mt-4 font-display text-base font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                0{i + 1}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative border-t border-border/70">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>© {YEAR} The Akhada. Built for our club, hosted on Supabase and AWS Amplify.</p>
          <nav className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <Button asChild className="flex-1"><Link to="/auth">Sign in</Link></Button>
          <Button asChild variant="outline" className="flex-1"><Link to="/auth">Request access</Link></Button>
        </div>
      </div>
    </main>
  );
}

// Decorative clay-court visual — pure SVG, no external asset.
function CourtVisual() {
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[360px]">
      <div className="absolute inset-0 rounded-3xl bg-hero-rim ring-1 ring-border/60 shadow-card-hover" />
      <div
        className="absolute inset-4 overflow-hidden rounded-2xl shadow-[0_20px_60px_-20px_hsl(var(--court-clay)/0.55)]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, hsl(20 76% 60%) 0%, hsl(20 76% 46%) 55%, hsl(20 72% 38%) 100%)",
        }}
      >
        <svg viewBox="0 0 300 400" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
          {/* Outer court */}
          <rect x="20" y="20" width="260" height="360" fill="none" stroke="#FFFFFF" strokeWidth="3" />
          {/* Doubles alleys */}
          <line x1="55" y1="20" x2="55" y2="380" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="245" y1="20" x2="245" y2="380" stroke="#FFFFFF" strokeWidth="2" />
          {/* Service boxes */}
          <line x1="55" y1="130" x2="245" y2="130" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="55" y1="270" x2="245" y2="270" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="150" y1="130" x2="150" y2="270" stroke="#FFFFFF" strokeWidth="2" />
          {/* Net */}
          <line x1="10" y1="200" x2="290" y2="200" stroke="#FFFFFF" strokeWidth="3" strokeDasharray="6 4" opacity="0.9" />
          {/* Center mark */}
          <line x1="150" y1="16" x2="150" y2="26" stroke="#FFFFFF" strokeWidth="3" />
          <line x1="150" y1="374" x2="150" y2="384" stroke="#FFFFFF" strokeWidth="3" />
          {/* Ball — accent lime pops against clay */}
          <circle cx="220" cy="90" r="9" fill="hsl(var(--accent))" opacity="0.98" />
        </svg>
      </div>
    </div>
  );
}
