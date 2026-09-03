import type { BestOf, MatchSetRow, MatchSide } from "@/features/matches/types";

export function setWinner(set: MatchSetRow): MatchSide | null {
  const { side_a_games: a, side_b_games: b, tiebreak_a: ta, tiebreak_b: tb } = set;
  if (a === b) {
    if (ta == null || tb == null || ta === tb) return null;
    return ta > tb ? "A" : "B";
  }
  return a > b ? "A" : "B";
}

export function isSetComplete(set: MatchSetRow): boolean {
  const { side_a_games: a, side_b_games: b } = set;
  if (a === 7 && b <= 5) return true;
  if (b === 7 && a <= 5) return true;
  if (a === 6 && b <= 4) return true;
  if (b === 6 && a <= 4) return true;
  if (a === 7 && b === 6 && set.tiebreak_a != null && set.tiebreak_b != null && set.tiebreak_a > set.tiebreak_b) return true;
  if (b === 7 && a === 6 && set.tiebreak_a != null && set.tiebreak_b != null && set.tiebreak_b > set.tiebreak_a) return true;
  return false;
}

/** A set with no games entered at all (not yet played). */
export function isSetEmpty(set: MatchSetRow): boolean {
  return (
    set.side_a_games === 0 &&
    set.side_b_games === 0 &&
    (set.tiebreak_a ?? 0) === 0 &&
    (set.tiebreak_b ?? 0) === 0
  );
}

/** Human-readable reason a set score isn't a legal finished set, or null when it is. */
export function invalidSetReason(set: MatchSetRow): string | null {
  const { side_a_games: a, side_b_games: b } = set;
  if (isSetComplete(set)) return null;
  if (a === 6 && b === 6) return "6–6 needs a tiebreak score";
  if ((a === 7 && b === 6) || (b === 7 && a === 6)) return "7–6 needs a tiebreak winner";
  return `${a}–${b} isn't a completed set (need 6–0…6–4, 7–5 or 7–6)`;
}

export function tallySets(sets: MatchSetRow[]): { a: number; b: number } {
  return sets.reduce(
    (acc, set) => {
      const w = setWinner(set);
      if (w === "A") acc.a += 1;
      else if (w === "B") acc.b += 1;
      return acc;
    },
    { a: 0, b: 0 },
  );
}

export function setsToWin(bestOf: BestOf): number {
  return Math.ceil(bestOf / 2);
}

export function matchWinner(sets: MatchSetRow[], bestOf: BestOf = 3): MatchSide | null {
  const target = setsToWin(bestOf);
  const { a, b } = tallySets(sets);
  if (a >= target) return "A";
  if (b >= target) return "B";
  return null;
}
