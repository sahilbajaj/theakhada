import { useMemo, useState } from "react";
import { Activity, CalendarClock, Plus, Trophy, UsersRound } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { MatchCard } from "@/features/matches/ui/MatchCard";
import { ScoreEntry } from "@/features/matches/ui/ScoreEntry";
import type { MatchListItem, MatchSide } from "@/features/matches/types";
import { useClubRoster } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { cn } from "@/lib/utils";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function selfSideOf(match: MatchListItem, selfId: string): MatchSide | null {
  if (match.side_a.some((p) => p.profile_id === selfId)) return "A";
  if (match.side_b.some((p) => p.profile_id === selfId)) return "B";
  return null;
}

function selfResultOf(match: MatchListItem, selfId: string): "W" | "L" | null {
  if (match.status !== "final" || !match.winner_side) return null;
  const side = selfSideOf(match, selfId);
  if (!side) return null;
  return side === match.winner_side ? "W" : "L";
}

function greetingFor(now: Date) {
  const h = now.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { profile } = useAuth();
  const rosterQuery = useClubRoster();
  const matchesQuery = useRecentMatches(50);
  const { preferNicknames } = useClubSettings();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMatchId, setEntryMatchId] = useState<string | null>(null);

  const selfId = profile?.id ?? null;
  const matches = matchesQuery.data ?? [];

  const {
    myMatches,
    liveMatch,
    liveCount,
    todayCount,
    memberCount,
  } = useMemo(() => {
    const my = selfId ? matches.filter((m) => selfSideOf(m, selfId) !== null) : [];
    const anyLive = matches.find((m) => m.status !== "final");
    const now = new Date();
    return {
      myMatches: my.slice(0, 3),
      liveMatch: anyLive,
      liveCount: matches.filter((m) => m.status !== "final").length,
      todayCount: matches.filter((m) => isSameDay(new Date(m.starts_at), now)).length,
      memberCount: rosterQuery.data?.length ?? 0,
    };
  }, [matches, selfId, rosterQuery.data]);

  const selfRoster = selfId ? rosterQuery.data?.find((r) => r.profile_id === selfId) : undefined;
  const selfName = selfRoster
    ? (preferNicknames && selfRoster.nickname) || selfRoster.full_name.split(" ")[0]
    : profile?.fullName?.split(" ")[0] ?? "there";

  const greeting = greetingFor(new Date());

  function openNewMatch() {
    setEntryMatchId(null);
    setEntryOpen(true);
  }

  function openMatch(matchId: string) {
    setEntryMatchId(matchId);
    setEntryOpen(true);
  }

  return (
    <div className="grid gap-5">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
        <div className="pointer-events-none absolute inset-0 rim-gradient" aria-hidden />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{greeting}</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Hi, {selfName}.</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {liveCount > 0 ? `${liveCount} live · ${todayCount} today` : todayCount > 0 ? `${todayCount} match${todayCount === 1 ? "" : "es"} today` : "No matches yet today."}
            </p>
          </div>
          <Button size="lg" onClick={openNewMatch} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Start a match
          </Button>
        </div>
      </section>

      {liveMatch ? (
        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="live"><span className="live-dot" />Live now</Badge>
            <span className="text-xs text-muted-foreground">Started {formatDistanceToNowStrict(new Date(liveMatch.starts_at), { addSuffix: true })}</span>
          </div>
          <MatchCard match={liveMatch} preferNicknames={preferNicknames} onOpen={openMatch} />
        </section>
      ) : null}

      {/* Your recent */}
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Your recent matches</SectionLabel>
        </div>
        {matchesQuery.isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : myMatches.length ? (
          <div className="grid gap-2">
            {myMatches.map((match) => (
              <div key={match.match_id} className="relative">
                <ResultRail result={selfId ? selfResultOf(match, selfId) : null} />
                <div className="pl-1.5">
                  <MatchCard match={match} preferNicknames={preferNicknames} onOpen={openMatch} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-base p-5 text-sm text-muted-foreground">
            Nothing yet — start a match above.
          </div>
        )}
      </section>

      {/* Club at a glance */}
      <section className="grid gap-3">
        <SectionLabel>Club at a glance</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatTile label="Members" value={memberCount} icon={UsersRound} tone="green" />
          <StatTile label="Live" value={liveCount} icon={Activity} tone="clay" />
          <StatTile label="Today" value={todayCount} icon={CalendarClock} tone="blue" />
        </div>
      </section>

      <ScoreEntry open={entryOpen} onOpenChange={setEntryOpen} matchId={entryMatchId} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>;
}

function ResultRail({ result }: { result: "W" | "L" | null }) {
  if (!result) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-0 top-2 bottom-2 w-1 rounded-full",
        result === "W" ? "bg-primary shadow-glow-primary" : "bg-muted-foreground/30",
      )}
    />
  );
}

const toneClasses: Record<"green" | "blue" | "clay", string> = {
  green: "bg-primary/12 text-primary",
  blue: "bg-[hsl(var(--court-blue)/0.14)] text-[hsl(var(--court-blue))]",
  clay: "bg-[hsl(var(--court-clay)/0.14)] text-[hsl(var(--court-clay))]",
};

function StatTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Trophy; tone: "green" | "blue" | "clay" }) {
  return (
    <div className="card-base p-3 transition hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        </div>
        <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", toneClasses[tone])}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}
