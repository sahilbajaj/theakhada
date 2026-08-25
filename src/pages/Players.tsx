import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubRoster } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { computeStats } from "@/features/stats/logic/computeStats";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";

export default function Players() {
  const rosterQuery = useClubRoster();
  const matchesQuery = useRecentMatches(100);
  const { preferNicknames } = useClubSettings();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const roster = rosterQuery.data ?? [];
    const matches = matchesQuery.data ?? [];
    const q = query.trim().toLowerCase();
    return roster
      .filter((m) => {
        if (!q) return true;
        return (
          m.full_name.toLowerCase().includes(q) ||
          (m.nickname?.toLowerCase().includes(q) ?? false)
        );
      })
      .map((member) => ({
        member,
        stats: computeStats(matches, member.profile_id),
      }))
      .sort((a, b) => {
        const sa = a.member.seed;
        const sb = b.member.seed;
        if (sa != null && sb != null) return sa - sb;
        if (sa != null) return -1;
        if (sb != null) return 1;
        return (b.member.rating ?? 0) - (a.member.rating ?? 0);
      });
  }, [rosterQuery.data, matchesQuery.data, query]);

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Players</h2>
            <p className="text-sm text-muted-foreground">Club roster with recent form. Tap a player for their stats.</p>
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="pl-8"
            />
          </div>
        </div>
      </section>

      {rosterQuery.isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
          No matching players.
        </div>
      ) : (
        <div className="grid gap-2">
          {rows.map(({ member, stats }) => {
            const name = displayName(member, { preferNicknames });
            return (
              <Link
                key={member.profile_id}
                to={`/players/${member.profile_id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card transition hover:border-primary/40 hover:shadow-card-hover"
              >
                <Badge variant={member.seed != null ? "default" : "outline"} className="w-9 shrink-0 justify-center tabular-nums">
                  {member.seed != null ? `#${member.seed}` : "—"}
                </Badge>
                <Avatar className="h-9 w-9 shrink-0">
                  {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name} /> : null}
                  <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {stats.totalPlayed
                      ? `${stats.totalWins}-${stats.totalLosses} · ${stats.totalPlayed} match${stats.totalPlayed === 1 ? "" : "es"}`
                      : "No matches yet"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex gap-0.5">
                    {stats.form.slice(0, 3).map((r, i) => (
                      <span
                        key={i}
                        className={
                          "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold " +
                          (r === "W" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
                        }
                      >
                        {r}
                      </span>
                    ))}
                    {stats.form.slice(3, 5).map((r, i) => (
                      <span
                        key={i + 3}
                        className={
                          "hidden h-5 w-5 place-items-center rounded-full text-[10px] font-bold sm:grid " +
                          (r === "W" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
                        }
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <Badge variant="outline" className="tabular-nums">
                    {member.rating != null ? member.rating.toFixed(1) : "—"}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
