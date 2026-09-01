import { useMemo, useState } from "react";
import { CheckCircle2, LockOpen, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type {
  RRSubmitPayload,
  RoundRobinMatch,
  RoundRobinTeam,
  RoundRobinTournamentDetail,
} from "@/features/roundrobin/types";
import { FORMAT_SHORT, isSetFormat } from "@/features/roundrobin/types";
import { SetScoreEditor } from "@/features/roundrobin/ui/SetScoreEditor";

interface LiveMatchesProps {
  tournament: RoundRobinTournamentDetail;
  onSubmit: (matchId: string, payload: RRSubmitPayload) => void;
  onReopen: (matchId: string) => void;
  isPending?: boolean;
}

function teamLabel(team: RoundRobinTeam | undefined): string {
  if (!team) return "TBD";
  return `${team.player_a} & ${team.player_b}`;
}

export function LiveMatches({ tournament, onSubmit, onReopen, isPending }: LiveMatchesProps) {
  const teamsById = useMemo(() => new Map(tournament.teams.map((t) => [t.id, t])), [tournament.teams]);
  const groupMatches = tournament.matches.filter((m) => m.stage === "group");
  const rounds = useMemo(() => {
    const map = new Map<number, RoundRobinMatch[]>();
    for (const match of groupMatches) {
      const list = map.get(match.round_number) ?? [];
      list.push(match);
      map.set(match.round_number, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [groupMatches]);

  if (!rounds.length) {
    return <p className="text-sm text-muted-foreground">No group matches — teams may not have been generated yet.</p>;
  }

  return (
    <div className="grid gap-5">
      {rounds.map(([round, matches]) => {
        const done = matches.every((m) => m.status === "completed");
        return (
          <section key={round} className="grid gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Round {round}</h3>
              <Badge variant={done ? "secondary" : "outline"}>
                {done ? "Complete" : `${matches.filter((m) => m.status === "completed").length}/${matches.length}`}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {matches.map((match) => (
                <MatchScoreCard
                  key={match.id}
                  match={match}
                  teamA={teamsById.get(match.team_a_id ?? "")}
                  teamB={teamsById.get(match.team_b_id ?? "")}
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
  teamA,
  teamB,
  pointsPerMatch,
  onSubmit,
  onReopen,
  isPending,
}: {
  match: RoundRobinMatch;
  teamA?: RoundRobinTeam;
  teamB?: RoundRobinTeam;
  pointsPerMatch: number;
  onSubmit: (matchId: string, payload: RRSubmitPayload) => void;
  onReopen: (matchId: string) => void;
  isPending?: boolean;
}) {
  const locked = match.status === "completed";
  const setBased = isSetFormat(match.format);

  return (
    <article className={cn("rounded-xl border border-border/60 bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover", locked && "border-primary/40")}>
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-primary" />Court {match.court_number}
        </span>
        <div className="flex items-center gap-1">
          {match.group_no != null ? <Badge variant="outline">Group {String.fromCharCode(64 + match.group_no)}</Badge> : null}
          <Badge variant="outline">{FORMAT_SHORT[match.format]}</Badge>
          <Badge variant={locked ? "default" : "outline"}>{locked ? "Completed" : "Pending"}</Badge>
        </div>
      </header>

      <div className="mt-3 grid gap-2">
        <TeamNameRow label="Team A" name={teamLabel(teamA)} />
        <TeamNameRow label="Team B" name={teamLabel(teamB)} />
      </div>

      {setBased ? (
        <div className="mt-3">
          {locked ? (
            <ReadOnlySetSummary match={match} />
          ) : (
            <SetScoreEditor
              format={match.format as Exclude<RoundRobinMatch["format"], "points">}
              teamALabel={teamLabel(teamA)}
              teamBLabel={teamLabel(teamB)}
              initialSets={match.set_scores}
              disabled={!teamA || !teamB}
              isPending={isPending}
              onSubmit={(sets) => onSubmit(match.id, { format: "set", setScores: sets })}
            />
          )}
        </div>
      ) : (
        <PointsEditor
          match={match}
          pointsPerMatch={pointsPerMatch}
          disabled={locked}
          isPending={isPending}
          onSubmit={(a, b) => onSubmit(match.id, { format: "points", teamAPoints: a, teamBPoints: b })}
        />
      )}

      {locked ? (
        <Button variant="outline" className="mt-3 w-full" onClick={() => onReopen(match.id)} disabled={isPending}>
          <LockOpen className="mr-2 h-4 w-4" />Edit score
        </Button>
      ) : null}
    </article>
  );
}

function TeamNameRow({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{name}</p>
      </div>
    </div>
  );
}

function ReadOnlySetSummary({ match }: { match: RoundRobinMatch }) {
  const sets = match.set_scores ?? [];
  return (
    <div className="grid gap-1 rounded-lg bg-secondary/50 p-2.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sets</span>
        <span className="font-semibold tabular-nums">
          {match.team_a_sets ?? 0} – {match.team_b_sets ?? 0}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sets.map((s, i) => (
          <span key={i} className="rounded-full border border-border/60 px-2 py-0.5 text-xs tabular-nums">
            {s.a}-{s.b}
          </span>
        ))}
      </div>
    </div>
  );
}

function PointsEditor({
  match,
  pointsPerMatch,
  disabled,
  isPending,
  onSubmit,
}: {
  match: RoundRobinMatch;
  pointsPerMatch: number;
  disabled: boolean;
  isPending?: boolean;
  onSubmit: (a: number, b: number) => void;
}) {
  const [scoreA, setScoreA] = useState(disabled ? String(match.team_a_points ?? "") : "");
  const [scoreB, setScoreB] = useState(disabled ? String(match.team_b_points ?? "") : "");

  const a = Number(scoreA);
  const b = Number(scoreB);
  const filled = scoreA !== "" && scoreB !== "";
  const valid =
    filled && Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a + b === pointsPerMatch && a !== b;

  function submit() {
    if (!valid) {
      toast.error(a === b ? "No ties allowed" : `Scores must add up to exactly ${pointsPerMatch}`);
      return;
    }
    onSubmit(a, b);
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Points</span>
        <Input
          inputMode="numeric"
          className="h-10 w-16 text-center text-base font-semibold tabular-nums"
          value={scoreA}
          disabled={disabled}
          onChange={(event) => setScoreA(event.target.value.replace(/[^0-9]/g, ""))}
          aria-label="Team A score"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          inputMode="numeric"
          className="h-10 w-16 text-center text-base font-semibold tabular-nums"
          value={scoreB}
          disabled={disabled}
          onChange={(event) => setScoreB(event.target.value.replace(/[^0-9]/g, ""))}
          aria-label="Team B score"
        />
      </div>
      {!disabled ? (
        <>
          <p className={cn("text-xs", filled && !valid ? "text-destructive" : "text-muted-foreground")}>
            {filled && !valid
              ? a === b
                ? "Tie not allowed — one team must win"
                : `Total is ${a + b} — must equal ${pointsPerMatch}`
              : `Scores must total ${pointsPerMatch} · no ties`}
          </p>
          <Button className="w-full" onClick={submit} disabled={isPending || !valid}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Submit Score
          </Button>
        </>
      ) : null}
    </div>
  );
}
