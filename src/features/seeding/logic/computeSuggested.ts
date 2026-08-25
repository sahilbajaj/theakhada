import { computeStats } from "@/features/stats/logic/computeStats";
import type { MatchListItem } from "@/features/matches/types";
import type { RosterMember } from "@/hooks/useClubRoster";

const RATING_WEIGHT = 0.6;
const FORM_WEIGHT = 0.3;
const RECENCY_WEIGHT = 0.1;
const RECENCY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // two weeks

interface Scored {
  profile_id: string;
  score: number;
}

// suggestedOrder returns an ordered list of profile_ids (best first) based on
// rating, last-10 win rate, and how recently the member played. Pure — feed it
// the same inputs and get the same output.
export function suggestedOrder(
  members: RosterMember[],
  matches: MatchListItem[],
  now: Date = new Date(),
): string[] {
  if (!members.length) return [];

  const scored: Scored[] = members.map((member) => {
    const stats = computeStats(matches, member.profile_id, now);
    const rating = member.rating ?? 0;
    const decided = stats.form.length;
    const wins = stats.form.filter((r) => r === "W").length;
    const winRate = decided > 0 ? wins / decided : 0;
    const mostRecent = matches
      .find((m) => m.side_a.some((p) => p.profile_id === member.profile_id) || m.side_b.some((p) => p.profile_id === member.profile_id));
    const recencyMs = mostRecent ? Math.max(0, now.getTime() - new Date(mostRecent.starts_at).getTime()) : Infinity;
    const recency = Number.isFinite(recencyMs) ? Math.pow(0.5, recencyMs / RECENCY_HALF_LIFE_MS) : 0;

    const score = rating * RATING_WEIGHT + winRate * 5 * FORM_WEIGHT + recency * RECENCY_WEIGHT;
    return { profile_id: member.profile_id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.profile_id);
}
