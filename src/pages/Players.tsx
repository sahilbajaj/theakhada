import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListOrdered, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarUploadButton } from "@/components/AvatarUploadButton";
import { useAuth } from "@/contexts/AuthContext";
import { useClubRoster } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { computeStats } from "@/features/stats/logic/computeStats";
import type { SeedFormat } from "@/features/seeding/data/useSeeding";
import { computeScores, suggestedOrder } from "@/features/seeding/logic/computeSuggested";
import { SeedingPane, seedFor } from "@/features/seeding/ui/SeedingPane";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";

export default function Players() {
  const { role, profile } = useAuth();
  const isAdmin = role === "owner" || role === "admin";
  const rosterQuery = useClubRoster();
  const matchesQuery = useRecentMatches(200);
  const { preferNicknames } = useClubSettings();
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<SeedFormat>("combined");
  const [mode, setMode] = useState<"view" | "manage">("view");

  const roster = useMemo(
    () => (rosterQuery.data ?? []).filter((m) => m.role !== "guest"),
    [rosterQuery.data],
  );
  const matches = matchesQuery.data ?? [];

  const playedIdsForFormat = useMemo(() => {
    if (format === "combined") return null;
    return new Set(suggestedOrder(roster, matches, format));
  }, [roster, matches, format]);

  const pointsByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of computeScores(roster, matches, format)) map.set(s.profile_id, s.score);
    return map;
  }, [roster, matches, format]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter((m) => {
        if (playedIdsForFormat && seedFor(m, format) == null && !playedIdsForFormat.has(m.profile_id)) {
          return false;
        }
        if (!q) return true;
        return (
          m.full_name.toLowerCase().includes(q) ||
          (m.nickname?.toLowerCase().includes(q) ?? false)
        );
      })
      .map((member) => ({
        member,
        stats: computeStats(matches, member.profile_id, undefined, format === "combined" ? undefined : format),
      }))
      .sort((a, b) => {
        const sa = seedFor(a.member, format);
        const sb = seedFor(b.member, format);
        if (sa != null && sb != null) return sa - sb;
        if (sa != null) return -1;
        if (sb != null) return 1;
        return (b.member.rating ?? 0) - (a.member.rating ?? 0);
      });
  }, [roster, matches, query, format, playedIdsForFormat]);

  const managing = isAdmin && mode === "manage";

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Players</h2>
            <p className="text-sm text-muted-foreground">
              {managing
                ? "Drag to reorder. Save to publish."
                : "Club roster with recent form. Tap a player for their stats."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!managing ? (
              <div className="relative sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className="pl-8"
                />
              </div>
             ) : null}
            {!managing && profile?.id ? (
              <AvatarUploadButton profileId={profile.id} label="My photo" />
            ) : null}
            {isAdmin ? (
              <Button
                variant={managing ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(managing ? "view" : "manage")}
              >
                {managing ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Done
                  </>
                ) : (
                  <>
                    <ListOrdered className="mr-2 h-4 w-4" />
                    Edit seeding
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <Tabs value={format} onValueChange={(v) => setFormat(v as SeedFormat)}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="combined">Combined</TabsTrigger>
          <TabsTrigger value="singles">Singles</TabsTrigger>
          <TabsTrigger value="doubles">Doubles</TabsTrigger>
        </TabsList>
      </Tabs>

      {rosterQuery.isLoading || matchesQuery.isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : managing ? (
        <SeedingPane
          format={format}
          roster={roster}
          matches={matches}
          preferNicknames={preferNicknames}
          isAdmin={isAdmin}
        />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
          {format === "combined"
            ? "No matching players."
            : `No members have played a ${format} match yet.`}
        </div>
      ) : (
        <div className="grid gap-2">
          {rows.map(({ member, stats }) => {
            const name = displayName(member, { preferNicknames });
            const seed = seedFor(member, format);
            const points = pointsByProfile.get(member.profile_id) ?? 0;
            return (
              <Link
                key={member.profile_id}
                to={`/players/${member.profile_id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card transition hover:border-primary/40 hover:shadow-card-hover"
              >
                <Badge variant={seed != null ? "default" : "outline"} className="w-9 shrink-0 justify-center tabular-nums">
                  {seed != null ? `#${seed}` : "—"}
                </Badge>
                <Avatar className="h-9 w-9 shrink-0">
                  {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name} /> : null}
                  <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {stats.totalPlayed
                      ? `${stats.totalWins}-${stats.totalLosses} · ${stats.totalPlayed} match${stats.totalPlayed === 1 ? "" : "es"} · ${points.toFixed(1)} pts`
                      : `No matches yet · ${points.toFixed(1)} pts`}
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
