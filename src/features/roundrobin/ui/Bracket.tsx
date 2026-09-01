import { useMemo, useState } from "react";
import { CheckCircle2, LockOpen, Trophy } from "lucide-react";
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

interface BracketProps {
  tournament: RoundRobinTournamentDetail;
  onSubmit: (matchId: string, payload: RRSubmitPayload) => void;
  onReopen: (matchId: string) => void;
  isPending?: boolean;
}

function teamLabel(team: RoundRobinTeam | undefined): string {
  if (!team) return "TBD";
  return `${team.player_a} & ${team.player_b}`;
}

function winnerOf(match: RoundRobinMatch, teamA?: RoundRobinTeam, teamB?: RoundRobinTeam): RoundRobinTeam | undefined {
  if (match.status !== "completed") return undefined;
  if (match.format === "points") {
    if ((match.team_a_points ?? 0) > (match.team_b_points ?? 0)) return teamA;
    if ((match.team_b_points ?? 0) > (match.team_a_points ?? 0)) return teamB;
    return undefined;
  }
  if ((match.team_a_sets ?? 0) > (match.team_b_sets ?? 0)) return teamA;
  if ((match.team_b_sets ?? 0) > (match.team_a_sets ?? 0)) return teamB;
  return undefined;
}

export function Bracket({ tournament, onSubmit, onReopen, isPending }: BracketProps) {
  const teamsById = useMemo(() => new Map(tournament.teams.map((t) => [t.id, t])), [tournament.teams]);
  const semis = tournament.matches.filter((m) => m.stage === "semi").sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0));
  const final = tournament.matches.find((m) => m.stage === "final") ?? null;

  const groupComplete = tournament.matches.filter((m) => m.stage === "group").every((m) => m.status === "completed");

  if (!semis.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        {groupComplete
          ? "Semi-finals will appear here — refresh if they don't show up shortly."
          : "Finish the group stage to unlock the bracket."}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Semi-finals</h3>
        {semis.map((match) => (
          <BracketMatch
            key={match.id}
            match={match}
            teamA={teamsById.get(match.team_a_id ?? "")}
            teamB={teamsById.get(match.team_b_id ?? "")}
            pointsPerMatch={tournament.points_per_match}
            onSubmit={onSubmit}
            onReopen={onReopen}
            isPending={isPending}
            label={`Semi-final ${match.bracket_slot ?? ""}`}
          />
        ))}
      </section>
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Final</h3>
        {final ? (
          <BracketMatch
            match={final}
            teamA={teamsById.get(final.team_a_id ?? "")}
            teamB={teamsById.get(final.team_b_id ?? "")}
            pointsPerMatch={tournament.points_per_match}
            onSubmit={onSubmit}
            onReopen={onReopen}
            isPending={isPending}
            label="Final"
            gold
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            Play both semi-finals to unlock the final.
          </div>
        )}
      </section>
    </div>
  );
}

function BracketMatch({
  match,
  teamA,
  teamB,
  pointsPerMatch,
  onSubmit,
  onReopen,
  isPending,
  label,
  gold,
}: {
  match: RoundRobinMatch;
  teamA?: RoundRobinTeam;
  teamB?: RoundRobinTeam;
  pointsPerMatch: number;
  onSubmit: (matchId: string, payload: RRSubmitPayload) => void;
  onReopen: (matchId: string) => void;
  isPending?: boolean;
  label: string;
  gold?: boolean;
}) {
  const locked = match.status === "completed";
  const setBased = isSetFormat(match.format);
  const winner = winnerOf(match, teamA, teamB);

  return (
    <article className={cn("rounded-xl border border-border/60 bg-card p-4 shadow-card", gold && "border-primary/60")}>
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {gold ? <Trophy className="h-4 w-4 text-primary" /> : null}
          {label}
        </span>
        <div className="flex items-center gap-1">
          <Badge variant="outline">{FORMAT_SHORT[match.format]}</Badge>
          <Badge variant={locked ? "default" : "outline"}>{locked ? "Completed" : "Pending"}</Badge>
        </div>
      </header>

      <div className="mt-3 grid gap-2">
        <TeamRow name={teamLabel(teamA)} highlight={locked && winner?.id === teamA?.id} />
        <TeamRow name={teamLabel(teamB)} highlight={locked && winner?.id === teamB?.id} />
      </div>

      <div className="mt-3">
        {setBased ? (
          locked ? (
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
          )
        ) : (
          <PointsBracketEditor
            match={match}
            pointsPerMatch={pointsPerMatch}
            teamA={teamA}
            teamB={teamB}
            disabled={locked}
            isPending={isPending}
            onSubmit={(a, b) => onSubmit(match.id, { format: "points", teamAPoints: a, teamBPoints: b })}
          />
        )}
      </div>

      {locked ? (
        <>
          {winner ? (
            <p className="mt-3 text-sm">
              <span className="font-semibold">{teamLabel(winner)}</span> {gold ? "wins the tournament" : "advances"}
            </p>
          ) : null}
          <Button variant="outline" className="mt-3 w-full" onClick={() => onReopen(match.id)} disabled={isPending}>
            <LockOpen className="mr-2 h-4 w-4" />Edit score
          </Button>
        </>
      ) : null}
    </article>
  );
}

function TeamRow({ name, highlight }: { name: string; highlight?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg bg-secondary/50 p-2.5", highlight && "ring-1 ring-primary")}>
      <p className="truncate text-sm font-medium">{name}</p>
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

function PointsBracketEditor({
  match,
  pointsPerMatch,
  teamA,
  teamB,
  disabled,
  isPending,
  onSubmit,
}: {
  match: RoundRobinMatch;
  pointsPerMatch: number;
  teamA?: RoundRobinTeam;
  teamB?: RoundRobinTeam;
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
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Points</span>
        <Input
          inputMode="numeric"
          className="h-10 w-16 text-center text-base font-semibold tabular-nums"
          value={scoreA}
          disabled={disabled || !teamA}
          onChange={(event) => setScoreA(event.target.value.replace(/[^0-9]/g, ""))}
          aria-label="Team A score"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          inputMode="numeric"
          className="h-10 w-16 text-center text-base font-semibold tabular-nums"
          value={scoreB}
          disabled={disabled || !teamB}
          onChange={(event) => setScoreB(event.target.value.replace(/[^0-9]/g, ""))}
          aria-label="Team B score"
        />
      </div>
      {!disabled ? (
        <>
          <p className={cn("text-xs", filled && !valid ? "text-destructive" : "text-muted-foreground")}>
            {filled && !valid
              ? a === b
                ? "Tie not allowed"
                : `Total is ${a + b} — must equal ${pointsPerMatch}`
              : `Scores must total ${pointsPerMatch} · no ties`}
          </p>
          <Button className="w-full" onClick={submit} disabled={isPending || !valid || !teamA || !teamB}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Submit Score
          </Button>
        </>
      ) : null}
    </div>
  );
}
