import type { RoundRobinFormat, SetScore } from "@/features/roundrobin/types";

export interface SetValidation {
  ok: boolean;
  reason?: string;
}

/** Standard tennis set to 6, win-by-2, tiebreak at 6-6 (recorded as 7-6). */
export function validateStandardSet(a: number, b: number): SetValidation {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return { ok: false, reason: "Games must be non-negative integers" };
  }
  if (a === b) return { ok: false, reason: "Set cannot be tied" };
  const [hi, lo] = a > b ? [a, b] : [b, a];
  if (hi === 6 && lo <= 4) return { ok: true };
  if (hi === 7 && (lo === 5 || lo === 6)) return { ok: true };
  return { ok: false, reason: `${a}-${b} isn't a valid set (need 6-0..6-4, 7-5, or 7-6)` };
}

/** 10-point match tiebreak, win-by-2, min 10. */
export function validateMatchTiebreak(a: number, b: number): SetValidation {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return { ok: false, reason: "Points must be non-negative integers" };
  }
  if (a === b) return { ok: false, reason: "Tiebreak cannot be tied" };
  const [hi, lo] = a > b ? [a, b] : [b, a];
  if (hi >= 10 && hi - lo >= 2) return { ok: true };
  return { ok: false, reason: "Match tiebreak: first to 10, win by 2" };
}

export interface MatchValidation {
  ok: boolean;
  reason?: string;
  setsA: number;
  setsB: number;
  needsMoreSets: boolean;
  maxSets: number;
  neededWins: number;
}

/** Validate a full sequence of sets for a set-based format. */
export function validateSetMatch(format: RoundRobinFormat, sets: SetScore[]): MatchValidation {
  const maxSets = format === "set" ? 1 : 3;
  const neededWins = format === "set" ? 1 : 2;
  const base = { setsA: 0, setsB: 0, maxSets, neededWins };

  if (sets.length === 0) {
    return { ok: false, reason: "No sets entered", needsMoreSets: true, ...base };
  }
  if (sets.length > maxSets) {
    return { ok: false, reason: "Too many sets for this format", needsMoreSets: false, ...base };
  }

  let setsA = 0;
  let setsB = 0;
  for (let i = 0; i < sets.length; i += 1) {
    const { a, b } = sets[i];
    const isMtb = format === "bo3_mtb" && i === 2;
    const check = isMtb ? validateMatchTiebreak(a, b) : validateStandardSet(a, b);
    if (!check.ok) {
      return { ok: false, reason: `Set ${i + 1}: ${check.reason}`, needsMoreSets: false, setsA, setsB, maxSets, neededWins };
    }
    if (a > b) setsA += 1;
    else setsB += 1;

    // No dead rubbers: if a side has already won the required sets, no further entries allowed.
    if (Math.max(setsA, setsB) === neededWins && i < sets.length - 1) {
      return { ok: false, reason: "Match already decided — remove extra sets", needsMoreSets: false, setsA, setsB, maxSets, neededWins };
    }
  }

  const decided = Math.max(setsA, setsB) === neededWins;
  return {
    ok: decided,
    reason: decided ? undefined : `Match not decided — one team must win ${neededWins} set${neededWins === 1 ? "" : "s"}`,
    needsMoreSets: !decided,
    setsA,
    setsB,
    maxSets,
    neededWins,
  };
}

export function isSetFilled(set: SetScore): boolean {
  return Number.isFinite(set.a) && Number.isFinite(set.b);
}
