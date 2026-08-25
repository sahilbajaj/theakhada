import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubRoster } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { MatchCard } from "@/features/matches/ui/MatchCard";
import { ScoreEntry } from "@/features/matches/ui/ScoreEntry";
import { computeStats, matchesForProfile, type Result } from "@/features/stats/logic/computeStats";
import { displayName, formalName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function FormPill({ r }: { r: Result }) {
  return (
    <span
      className={
        "grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold " +
        (r === "W" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
      }
    >
      {r}
    </span>
  );
}

export default function PlayerDetail() {
  const { profileId } = useParams<{ profileId: string }>();
  const rosterQuery = useClubRoster();
  const matchesQuery = useRecentMatches(200);
  const { preferNicknames } = useClubSettings();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMatchId, setEntryMatchId] = useState<string | null>(null);

  const member = useMemo(
    () => rosterQuery.data?.find((m) => m.profile_id === profileId),
    [rosterQuery.data, profileId],
  );
  const stats = useMemo(
    () => (profileId ? computeStats(matchesQuery.data ?? [], profileId) : null),
    [matchesQuery.data, profileId],
  );
  const myMatches = useMemo(
    () => (profileId ? matchesForProfile(matchesQuery.data ?? [], profileId) : []),
    [matchesQuery.data, profileId],
  );

  const isLoading = rosterQuery.isLoading || matchesQuery.isLoading;
  const notFound = !isLoading && !member;

  if (notFound) {
    return (
      <div className="grid gap-4">
        <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to players
        </Link>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Player not found.
        </div>
      </div>
    );
  }

  if (isLoading || !member || !stats) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }

  const primary = displayName(member, { preferNicknames });
  const formal = formalName(member);
  const monthRate = stats.monthPlayed ? Math.round((stats.monthWins / stats.monthPlayed) * 100) : null;

  return (
    <div className="grid gap-5">
      <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to players
      </Link>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={primary} /> : null}
            <AvatarFallback className="text-lg">{initialsFrom(primary)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-semibold">{primary}</h2>
            {formal !== primary ? <p className="truncate text-sm text-muted-foreground">{formal}</p> : null}
            <div className="mt-1 flex items-center gap-2">
              {member.seed != null ? <Badge>Seed #{member.seed}</Badge> : null}
              <Badge variant="outline">Rating {member.rating != null ? member.rating.toFixed(1) : "—"}</Badge>
              {stats.currentStreak ? (
                <Badge variant={stats.currentStreak.kind === "W" ? "default" : "secondary"}>
                  {stats.currentStreak.length}× {stats.currentStreak.kind}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">This month</h3>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Wins" value={String(stats.monthWins)} />
          <StatTile label="Losses" value={String(stats.monthLosses)} />
          <StatTile label="Win rate" value={monthRate != null ? `${monthRate}%` : "—"} sub={stats.monthPlayed ? `${stats.monthPlayed} played` : undefined} />
        </div>
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Form</h3>
          {stats.form.length ? <p className="text-xs text-muted-foreground">last {stats.form.length}</p> : null}
        </div>
        {stats.form.length ? (
          <div className="flex gap-1">
            {stats.form.map((r, i) => (
              <FormPill key={i} r={r} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-sm">No matches finalized yet.</div>
        )}
      </section>

      {stats.topOpponents.length ? (
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Most-played opponents</h3>
          <div className="grid gap-2">
            {stats.topOpponents.map((opp) => {
              const name = displayName(
                { full_name: opp.full_name, nickname: opp.nickname, email: null },
                { preferNicknames },
              );
              return (
                <Link
                  key={opp.profile_id}
                  to={`/players/${opp.profile_id}`}
                  className="grid items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition hover:border-primary/40 sm:grid-cols-[auto_1fr_auto]"
                >
                  <Avatar className="h-8 w-8">
                    {opp.avatar_url ? <AvatarImage src={opp.avatar_url} alt={name} /> : null}
                    <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
                  </Avatar>
                  <p className="truncate font-medium">{name}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">{opp.wins}-{opp.losses} · {opp.played}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent matches</h3>
          <p className="text-xs text-muted-foreground">{stats.totalPlayed} total · {stats.totalWins}-{stats.totalLosses}</p>
        </div>
        {myMatches.length ? (
          <div className="grid gap-2">
            {myMatches.slice(0, 8).map((match) => (
              <MatchCard
                key={match.match_id}
                match={match}
                preferNicknames={preferNicknames}
                onOpen={(id) => {
                  setEntryMatchId(id);
                  setEntryOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-sm">No matches yet.</div>
        )}
      </section>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link to="/scores">All club matches</Link>
        </Button>
      </div>

      <ScoreEntry open={entryOpen} onOpenChange={setEntryOpen} matchId={entryMatchId} />
    </div>
  );
}
