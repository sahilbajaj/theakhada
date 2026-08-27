import { useMemo } from "react";
import { Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AmericanoTournamentDetail } from "@/features/americano/types";

const MEDAL_STYLES = [
  "bg-[hsl(45_92%_52%)] text-[hsl(45_92%_12%)]",
  "bg-[hsl(210_10%_75%)] text-[hsl(210_10%_18%)]",
  "bg-[hsl(28_60%_52%)] text-[hsl(28_60%_12%)]",
];

export function Leaderboard({ tournament }: { tournament: AmericanoTournamentDetail }) {
  const standings = useMemo(
    () =>
      [...tournament.players].sort(
        (a, b) => b.total_points - a.total_points || a.name.localeCompare(b.name),
      ),
    [tournament.players],
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-card">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Trophy className="h-4 w-4 text-accent" />
        <h3 className="font-semibold">Leaderboard standings</h3>
        <span className="ml-auto text-xs text-muted-foreground">{tournament.points_per_match} pts per match</span>
      </header>
      <ol className="divide-y divide-border/60">
        {standings.map((player, index) => (
          <li key={player.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                index < 3 ? MEDAL_STYLES[index] : "bg-secondary text-muted-foreground",
              )}
            >
              {index < 3 ? <Medal className="h-4 w-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{player.name}</p>
              <p className="text-xs text-muted-foreground">{player.matches_played} matches played</p>
            </div>
            <span className="text-lg font-semibold tabular-nums">{player.total_points}</span>
          </li>
        ))}
        {standings.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No players yet.</li>
        ) : null}
      </ol>
    </section>
  );
}
