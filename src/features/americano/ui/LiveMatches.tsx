import { useMemo, useState } from "react";
import { CheckCircle2, LockOpen, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { AmericanoMatch, AmericanoTournamentDetail } from "@/features/americano/types";

interface LiveMatchesProps {
  tournament: AmericanoTournamentDetail;
  onSubmit: (matchId: string, a: number, b: number) => void;
  onReopen: (matchId: string) => void;
  isPending?: boolean;
}

export function LiveMatches({ tournament, onSubmit, onReopen, isPending }: LiveMatchesProps) {
  const rounds = useMemo(() => {
    const map = new Map<number, AmericanoMatch[]>();
    for (const match of tournament.matches) {
      const list = map.get(match.round_number) ?? [];
      list.push(match);
      map.set(match.round_number, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [tournament.matches]);

  return (
    <div className="grid gap-5">
      {rounds.map(([round, matches]) => {
        const done = matches.every((m) => m.status === "completed");
        return (
          <section key={round} className="grid gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Round {round}</h3>
              <Badge variant={done ? "secondary" : "outline"}>{done ? "Complete" : `${matches.filter((m) => m.status === "completed").length}/${matches.length}`}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {matches.map((match) => (
                <MatchScoreCard
                  key={match.id}
                  match={match}
                  pointsPerMatch={tournament.points_per_match}
                  onSubmit={onSubmit}
                  onReopen={onReopen}
                  isPending={isPending}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MatchScoreCard({
  match,
  pointsPerMatch,
  onSubmit,
  onReopen,
  isPending,
}: {
  match: AmericanoMatch;
  pointsPerMatch: number;
  onSubmit: (matchId: string, a: number, b: number) => void;
  onReopen: (matchId: string) => void;
  isPending?: boolean;
}) {
  const locked = match.status === "completed";
  const [scoreA, setScoreA] = useState(locked ? String(match.team_a[0]?.points_scored ?? "") : "");
  const [scoreB, setScoreB] = useState(locked ? String(match.team_b[0]?.points_scored ?? "") : "");

  const a = Number(scoreA);
  const b = Number(scoreB);
  const filled = scoreA !== "" && scoreB !== "";
  const valid = filled && Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a + b === pointsPerMatch;

  function submit() {
    if (!valid) {
      toast.error(`Scores must add up to exactly ${pointsPerMatch}`);
      return;
    }
    onSubmit(match.id, a, b);
  }

  return (
    <article
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover",
        locked && "border-primary/40",
      )}
    >
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-primary" />Court {match.court_number}
        </span>
        <Badge variant={locked ? "default" : "outline"}>{locked ? "Completed" : "Pending"}</Badge>
      </header>

      <div className="mt-3 grid gap-2">
        <TeamRow
          label="Team A"
          names={match.team_a.map((p) => p.name)}
          value={scoreA}
          onChange={setScoreA}
          disabled={locked}
        />
        <TeamRow
          label="Team B"
          names={match.team_b.map((p) => p.name)}
          value={scoreB}
          onChange={setScoreB}
          disabled={locked}
        />
      </div>

      {locked ? (
        <Button variant="outline" className="mt-3 w-full" onClick={() => onReopen(match.id)} disabled={isPending}>
          <LockOpen className="mr-2 h-4 w-4" />Edit score
        </Button>
      ) : (
        <>
          <p
            className={cn(
              "mt-2 text-xs",
              filled && !valid ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {filled && !valid
              ? `Total is ${a + b} — must equal ${pointsPerMatch}`
              : `Scores must total ${pointsPerMatch} points`}
          </p>
          <Button className="mt-2 w-full" onClick={submit} disabled={isPending || !valid}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Submit Score
          </Button>
        </>
      )}
    </article>
  );
}

function TeamRow({
  label,
  names,
  value,
  onChange,
  disabled,
}: {
  label: string;
  names: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{names.join(" · ")}</p>
      </div>
      <Input
        inputMode="numeric"
        className="h-11 w-16 text-center text-lg font-semibold tabular-nums"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
        aria-label={`${label} score`}
      />
    </div>
  );
}
