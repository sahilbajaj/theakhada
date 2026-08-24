import { displayName } from "@/lib/displayName";
import type { MatchListItem, MatchSide } from "@/features/matches/types";
import type { NotificationItem, NotificationKind } from "@/features/notifications/types";

interface Prefs {
  preferNicknames: boolean;
}

export function actorName(item: NotificationItem, prefs: Prefs): string {
  return displayName(
    {
      full_name: item.actor_full_name ?? undefined,
      nickname: item.actor_nickname ?? undefined,
      email: null,
    },
    prefs,
  ) || "Someone";
}

export function kindLabel(kind: NotificationKind): string {
  switch (kind) {
    case "match_created":
      return "Added to a match";
    case "match_finalized":
      return "Match finalized";
    case "match_reopened":
      return "Match reopened";
  }
}

export function summaryFor(item: NotificationItem, match: MatchListItem | undefined, selfId: string | null, prefs: Prefs): string {
  const actor = actorName(item, prefs);
  if (item.kind === "match_created") {
    return `${actor} started a match with you`;
  }
  if (item.kind === "match_reopened") {
    return `${actor} reopened your match to edit`;
  }
  // match_finalized — describe the result relative to self if possible.
  if (!match || !match.winner_side || !selfId) return `${actor} finalized your match`;
  const selfSide: MatchSide | null = match.side_a.some((p) => p.profile_id === selfId)
    ? "A"
    : match.side_b.some((p) => p.profile_id === selfId)
    ? "B"
    : null;
  if (!selfSide) return `${actor} finalized your match`;
  const won = selfSide === match.winner_side;
  const oppRoster = selfSide === "A" ? match.side_b : match.side_a;
  const oppNames = oppRoster.map((p) => displayName(p, prefs)).join(" / ");
  const scoreParts = match.sets
    .map((s) => (selfSide === "A" ? `${s.side_a_games}-${s.side_b_games}` : `${s.side_b_games}-${s.side_a_games}`))
    .join(", ");
  return `${won ? "You beat" : "You lost to"} ${oppNames} ${scoreParts}`;
}
