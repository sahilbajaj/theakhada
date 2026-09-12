import type { MatchListItem } from "@/features/matches/types";
import type { RosterMember } from "@/hooks/useClubRoster";
import type { SeedFormat } from "@/features/seeding/data/useSeeding";

const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
const LENGTH_WEIGHTS: Record<number, number> = { 1: 0.67, 3: 1.0, 5: 1.33 };
const RATING_PRIOR_SCALE = 2;
const RATING_PRIOR_FADE_AT = 8;

export interface ScoredMember {
  profile_id: string;
  score: number;
  played: boolean;
  matchCount: number;
}

function seedForFormat(m: RosterMember, format: SeedFormat): number | null {
  if (format === "singles") return m.singles_seed;
  if (format === "doubles") return m.doubles_seed;
  return m.seed;
}

// computeScores returns the raw points-based score for each eligible
// (non-guest) member. Formula: per-match points = (1 + margin) *
// opp_strength * length_weight * decay, summed across finalized matches
// in the requested format, plus a cold-start rating prior that fades to
// zero by RATING_PRIOR_FADE_AT matches. Losses contribute 0 points but
// still count toward matchCount (fading the prior). Opponent strength
// uses each opponent's currently-stored seed for the format being
// ranked. Mirrors public.recompute_seeds in the database.
export function computeScores(
  members: RosterMember[],
  matches: MatchListItem[],
  format: SeedFormat = "combined",
  now: Date = new Date(),
): ScoredMember[] {
  if (!members.length) return [];

  const eligible = members.filter((m) => m.role !== "guest");
  const N = Math.max(eligible.length, 1);
  const nowMs = now.getTime();

  const rankByProfile = new Map<string, number>();
  for (const m of members) {
    const rank = seedForFormat(m, format);
    if (rank != null) rankByProfile.set(m.profile_id, rank);
  }
  const opponentRank = (profileId: string): number => rankByProfile.get(profileId) ?? N;

  const scored: ScoredMember[] = eligible.map((member) => {
    let totalPoints = 0;
    let matchCount = 0;

    for (const match of matches) {
      if (match.status !== "final") continue;
      if (format !== "combined" && match.format !== format) continue;
      const onA = match.side_a.some((p) => p.profile_id === member.profile_id);
      const onB = !onA && match.side_b.some((p) => p.profile_id === member.profile_id);
      if (!onA && !onB) continue;

      matchCount += 1;

      let gamesA = 0;
      let gamesB = 0;
      for (const set of match.sets) {
        gamesA += set.side_a_games;
        gamesB += set.side_b_games;
      }
      const total = gamesA + gamesB;
      if (total <= 0) continue;

      const margin = onA ? (gamesA - gamesB) / total : (gamesB - gamesA) / total;
      if (margin <= 0) continue;

      const opponents = onA ? match.side_b : match.side_a;
      const avgOppRank = opponents.length
        ? opponents.reduce((s, p) => s + opponentRank(p.profile_id), 0) / opponents.length
        : N;
      const oppStrength = 1 + (N - avgOppRank) / N;

      const lengthWeight = LENGTH_WEIGHTS[match.best_of] ?? 1;

      const ageMs = Math.max(0, nowMs - new Date(match.starts_at).getTime());
      const decay = Math.pow(0.5, ageMs / HALF_LIFE_MS);

      totalPoints += (1 + margin) * oppStrength * lengthWeight * decay;
    }

    const rating = member.rating ?? 0;
    const priorScale = Math.max(0, 1 - matchCount / RATING_PRIOR_FADE_AT);
    const score = totalPoints + rating * RATING_PRIOR_SCALE * priorScale;

    return { profile_id: member.profile_id, score, played: matchCount > 0, matchCount };
  });

  return scored;
}

export function suggestedOrder(
  members: RosterMember[],
  matches: MatchListItem[],
  format: SeedFormat = "combined",
  now: Date = new Date(),
): string[] {
  const scored = computeScores(members, matches, format, now);
  const filtered = format === "combined" ? scored : scored.filter((s) => s.played);
  filtered.sort((a, b) => b.score - a.score || b.matchCount - a.matchCount);
  return filtered.map((s) => s.profile_id);
}
