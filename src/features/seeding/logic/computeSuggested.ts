import type { MatchListItem } from "@/features/matches/types";
import type { RosterMember } from "@/hooks/useClubRoster";

const RATING_WEIGHT = 0.4;
const FORM_WEIGHT = 0.45;
const RECENCY_WEIGHT = 0.15;
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // two weeks

interface Scored {
  profile_id: string;
  score: number;
}

// suggestedOrder returns an ordered list of profile_ids (best first) based on
// rating, dominance-weighted form across all finalized matches (14-day
// per-match half-life), and how recently the member played. Pure — feed it
// the same inputs and get the same output.
export function suggestedOrder(
  members: RosterMember[],
  matches: MatchListItem[],
  now: Date = new Date(),
): string[] {
  if (!members.length) return [];

  const eligible = members.filter((m) => m.role !== "guest");
  const nowMs = now.getTime();

  const scored: Scored[] = eligible.map((member) => {
    let weightedDominance = 0;
    let totalWeight = 0;
    let mostRecentMs: number | null = null;

    for (const match of matches) {
      if (match.status !== "final") continue;
      const onA = match.side_a.some((p) => p.profile_id === member.profile_id);
      const onB = !onA && match.side_b.some((p) => p.profile_id === member.profile_id);
      if (!onA && !onB) continue;

      let gamesA = 0;
      let gamesB = 0;
      for (const set of match.sets) {
        gamesA += set.side_a_games;
        gamesB += set.side_b_games;
      }
      const total = gamesA + gamesB;
      if (total <= 0) continue;

      const dominance = onA ? (gamesA - gamesB) / total : (gamesB - gamesA) / total;
      const ageMs = Math.max(0, nowMs - new Date(match.starts_at).getTime());
      const weight = Math.pow(0.5, ageMs / HALF_LIFE_MS);
      weightedDominance += dominance * weight;
      totalWeight += weight;

      const matchMs = new Date(match.starts_at).getTime();
      if (mostRecentMs == null || matchMs > mostRecentMs) mostRecentMs = matchMs;
    }

    const form = totalWeight > 0 ? weightedDominance / totalWeight : 0;
    const recency = mostRecentMs != null
      ? Math.pow(0.5, Math.max(0, nowMs - mostRecentMs) / HALF_LIFE_MS)
      : 0;
    const rating = member.rating ?? 0;

    const score = rating * RATING_WEIGHT + form * 5 * FORM_WEIGHT + recency * RECENCY_WEIGHT;
    return { profile_id: member.profile_id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.profile_id);
}
