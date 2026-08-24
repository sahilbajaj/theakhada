import type { MatchListItem, MatchSide } from "@/features/matches/types";

export type Result = "W" | "L";

export interface OpponentTally {
  profile_id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  played: number;
  wins: number;
  losses: number;
}

export interface PlayerStats {
  totalPlayed: number;
  totalWins: number;
  totalLosses: number;
  monthPlayed: number;
  monthWins: number;
  monthLosses: number;
  currentStreak: { kind: Result; length: number } | null;
  form: Result[]; // most recent first, up to 10
  topOpponents: OpponentTally[]; // top by played, up to 3
  bestWin: { rating: number; opponentName: string; matchId: string } | null;
}

const EMPTY: PlayerStats = {
  totalPlayed: 0,
  totalWins: 0,
  totalLosses: 0,
  monthPlayed: 0,
  monthWins: 0,
  monthLosses: 0,
  currentStreak: null,
  form: [],
  topOpponents: [],
  bestWin: null,
};

function selfSideOf(match: MatchListItem, selfId: string): MatchSide | null {
  if (match.side_a.some((p) => p.profile_id === selfId)) return "A";
  if (match.side_b.some((p) => p.profile_id === selfId)) return "B";
  return null;
}

function inCurrentMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function matchesForProfile(matches: MatchListItem[], profileId: string): MatchListItem[] {
  return matches.filter((m) => selfSideOf(m, profileId) !== null);
}

export function computeStats(
  matches: MatchListItem[],
  profileId: string,
  now: Date = new Date(),
): PlayerStats {
  const mine = matchesForProfile(matches, profileId);
  if (!mine.length) return EMPTY;

  // matches sorted most recent first (as delivered by list_recent_matches).
  let totalWins = 0;
  let totalLosses = 0;
  let monthPlayed = 0;
  let monthWins = 0;
  let monthLosses = 0;
  const form: Result[] = [];
  const opponentMap = new Map<string, OpponentTally>();

  for (const match of mine) {
    if (match.status !== "final" || !match.winner_side) continue;
    const selfSide = selfSideOf(match, profileId)!;
    const won = selfSide === match.winner_side;
    if (won) totalWins += 1;
    else totalLosses += 1;

    if (inCurrentMonth(match.starts_at, now)) {
      monthPlayed += 1;
      if (won) monthWins += 1;
      else monthLosses += 1;
    }

    if (form.length < 10) form.push(won ? "W" : "L");

    const opponents = selfSide === "A" ? match.side_b : match.side_a;
    for (const opp of opponents) {
      const tally = opponentMap.get(opp.profile_id) ?? {
        profile_id: opp.profile_id,
        full_name: opp.full_name,
        nickname: opp.nickname,
        avatar_url: opp.avatar_url,
        played: 0,
        wins: 0,
        losses: 0,
      };
      tally.played += 1;
      if (won) tally.wins += 1;
      else tally.losses += 1;
      opponentMap.set(opp.profile_id, tally);
    }
  }

  let currentStreak: PlayerStats["currentStreak"] = null;
  if (form.length) {
    const first = form[0];
    let length = 1;
    for (let i = 1; i < form.length; i += 1) {
      if (form[i] === first) length += 1;
      else break;
    }
    currentStreak = { kind: first, length };
  }

  const topOpponents = Array.from(opponentMap.values())
    .sort((a, b) => b.played - a.played)
    .slice(0, 3);

  return {
    totalPlayed: totalWins + totalLosses,
    totalWins,
    totalLosses,
    monthPlayed,
    monthWins,
    monthLosses,
    currentStreak,
    form,
    topOpponents,
    bestWin: null, // needs opponent ratings, not on match rows; wire later.
  };
}
