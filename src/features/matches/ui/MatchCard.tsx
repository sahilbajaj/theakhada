import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import { setWinner, tallySets } from "@/features/matches/logic/scoreRules";
import type { MatchListItem, MatchParticipant, MatchSide } from "@/features/matches/types";

interface Props {
  match: MatchListItem;
  preferNicknames: boolean;
  onOpen?: (matchId: string) => void;
  /** Admin-only: show whether this match has been reviewed. */
  showReviewState?: boolean;
}

function SideRow({ side, roster, sets, matchStatus, winner, preferNicknames }: {
  side: MatchSide;
  roster: MatchParticipant[];
  sets: MatchListItem["sets"];
  matchStatus: MatchListItem["status"];
  winner: MatchSide | null;
  preferNicknames: boolean;
}) {
  const names = roster.map((p) => displayName(p, { preferNicknames }));
  const isWinner = winner === side;
  return (
    <div className={"flex items-center gap-3 " + (isWinner ? "font-semibold" : "")}>
      <div className="flex -space-x-2">
        {roster.map((p, i) => (
          <Avatar key={p.profile_id} className={"h-8 w-8 border-2 border-background " + (i > 0 ? "" : "")}>
            {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={displayName(p, { preferNicknames })} /> : null}
            <AvatarFallback>{initialsFrom(displayName(p, { preferNicknames }))}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <p className="min-w-0 flex-1 truncate">{names.join(" / ")}</p>
      <div className="flex items-center gap-1">
        {sets.map((set) => {
          const games = side === "A" ? set.side_a_games : set.side_b_games;
          const tiebreak = side === "A" ? set.tiebreak_a : set.tiebreak_b;
          const w = setWinner(set);
          const cls =
            matchStatus === "final" && w === side
              ? "text-primary"
              : matchStatus === "final" && w && w !== side
              ? "text-muted-foreground"
              : "";
          return (
            <span key={set.set_index} className={"min-w-[1.75rem] text-center tabular-nums " + cls}>
              {games}
              {tiebreak != null ? <sup className="text-xs">{tiebreak}</sup> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function MatchCard({ match, preferNicknames, onOpen, showReviewState }: Props) {
  const winner = match.status === "final" ? match.winner_side : null;
  const { a, b } = tallySets(match.sets);
  const startedAt = new Date(match.starts_at);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(match.match_id)}
      className="grid w-full gap-3 rounded-xl border border-border/60 bg-card p-4 text-left shadow-card transition hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={match.status === "live" ? "default" : match.status === "final" ? "secondary" : match.status === "suspended" ? "destructive" : "outline"} className="capitalize">
            {match.status}
          </Badge>
          {match.status === "suspended" && match.suspended_reason ? (
            <Badge variant="outline" className="capitalize">{match.suspended_reason}</Badge>
          ) : null}
          <Badge variant="outline" className="capitalize">{match.format}</Badge>
          {showReviewState && match.status === "final" ? (
            <Badge variant={match.reviewed_at ? "secondary" : "outline"} className="text-[10px]">
              {match.reviewed_at ? "Reviewed" : "Needs review"}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {startedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <div className="grid gap-2">
        <SideRow side="A" roster={match.side_a} sets={match.sets} matchStatus={match.status} winner={winner} preferNicknames={preferNicknames} />
        <SideRow side="B" roster={match.side_b} sets={match.sets} matchStatus={match.status} winner={winner} preferNicknames={preferNicknames} />
      </div>
      {match.status !== "final" && match.sets.length ? (
        <p className="text-xs text-muted-foreground">Sets {a}–{b}</p>
      ) : null}
    </button>
  );
}
