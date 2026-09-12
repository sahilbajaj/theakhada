import type { MatchListItem } from "@/features/matches/types";
import type { RosterMember } from "@/hooks/useClubRoster";
import type { SeedFormat } from "@/features/seeding/data/useSeeding";

const RATING_WEIGHT = 0.4;
const FORM_WEIGHT = 0.45;
const RECENCY_WEIGHT = 0.15;
const EXPERIENCE_WEIGHT = 0.35;
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // two weeks
// Number of matches at which form is trusted ~half way. With few matches the
// form signal is shrunk towards the middle so a single lucky win can't top the
// list.
const FORM_CONFIDENCE_K = 4;
// Matches needed before a member is considered fully "established". Below this
// they get a proportionally smaller experience bonus.
const EXPERIENCE_FULL_AT = 6;

interface Scored {
  profile_id: string;
  score: number;
  played: boolean;
  matchCount: number;
}

// suggestedOrder returns an ordered list of profile_ids (best first) based on
// rating, dominance-weighted form across finalized matches in the requested
// format (14-day per-match half-life), and how recently the member played.
// For "singles"/"doubles" formats, members who haven't played that format are
// excluded from the result. Pure — feed it the same inputs and get the same
// output.
export function suggestedOrder(
  members: RosterMember[],
  matches: MatchListItem[],
  format: SeedFormat = "combined",
  now: Date = new Date(),
): string[] {
  if (!members.length) return [];

  const eligible = members.filter((m) => m.role !== "guest");
  const nowMs = now.getTime();

  const scored: Scored[] = eligible.map((member) => {
    let weightedDominance = 0;
    let totalWeight = 0;
    let mostRecentMs: number | null = null;
    let played = false;
    let matchCount = 0;

    for (const match of matches) {
      if (match.status !== "final") continue;
      if (format !== "combined" && match.format !== format) continue;
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
      played = true;
      matchCount += 1;

      const matchMs = new Date(match.starts_at).getTime();
      if (mostRecentMs == null || matchMs > mostRecentMs) mostRecentMs = matchMs;
    }

    const form = totalWeight > 0 ? weightedDominance / totalWeight : 0;
    const recency = mostRecentMs != null
      ? Math.pow(0.5, Math.max(0, nowMs - mostRecentMs) / HALF_LIFE_MS)
      : 0;
    const rating = member.rating ?? 0;

    const score = rating * RATING_WEIGHT + form * 5 * FORM_WEIGHT + recency * RECENCY_WEIGHT;
    return { profile_id: member.profile_id, score, played };
  });

  const filtered = format === "combined" ? scored : scored.filter((s) => s.played);
  filtered.sort((a, b) => b.score - a.score);
  return filtered.map((s) => s.profile_id);
}
