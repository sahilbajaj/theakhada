import { useMemo, useState } from "react";
import { Plus, Trophy } from "lucide-react";
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
    myFormStrip,
    liveMatch,
    liveCount,
    todayCount,
    memberCount,
  } = useMemo(() => {
    const my = selfId ? matches.filter((m) => selfSideOf(m, selfId) !== null) : [];
    const finalsForMe = selfId
      ? my.filter((m) => selfResultOf(m, selfId) !== null).slice(0, 5).map((m) => selfResultOf(m, selfId)!)
      : [];
    const anyLive = matches.find((m) => m.status !== "final");
    const now = new Date();
    return {
      myMatches: my.slice(0, 3),
      myFormStrip: finalsForMe,
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
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hi, {selfName}</h1>
          </div>
          <Button size="lg" onClick={openNewMatch} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Start a match
          </Button>
        </div>
      </section>

      {liveMatch ? (
        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live now</h2>
          </div>
          <MatchCard match={liveMatch} preferNicknames={preferNicknames} onOpen={openMatch} />
        </section>
      ) : null}

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your recent matches</h2>
          {myFormStrip.length ? (
            <div className="flex gap-1">
              {myFormStrip.map((r, i) => (
                <span
                  key={i}
                  className={
                    "grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold " +
                    (r === "W" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
                  }
                >
                  {r}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {matchesQuery.isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : myMatches.length ? (
          <div className="grid gap-2">
            {myMatches.map((match) => (
              <MatchCard key={match.match_id} match={match} preferNicknames={preferNicknames} onOpen={openMatch} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            Nothing yet — start a match above.
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Club at a glance</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Members" value={memberCount} />
          <StatTile label="Live" value={liveCount} />
          <StatTile label="Today" value={todayCount} />
        </div>
      </section>

      <ScoreEntry open={entryOpen} onOpenChange={setEntryOpen} matchId={entryMatchId} />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

