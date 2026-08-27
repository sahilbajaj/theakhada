import type { GeneratedMatch } from "@/features/americano/types";

/**
 * Americano rotation generator.
 *
 * Greedy scheduler that, round by round, picks the players who have played the
 * least and pairs them so that repeated partners and repeated opponents are
 * minimised. Resting players (when the count is not a multiple of 4) rotate
 * automatically because "games played" drives selection.
 */
export function maxCourtsFor(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 4));
}

export function roundsFor(playerCount: number): number {
  if (playerCount < 4) return 0;
  if (playerCount % 4 === 0) return Math.max(3, playerCount - 1);
  return playerCount;
}

export function generateAmericanoRounds(
  playerCount: number,
  courtCount: number,
  roundCount = roundsFor(playerCount),
): GeneratedMatch[] {
  if (playerCount < 4) return [];

  const courts = Math.max(1, Math.min(courtCount, maxCourtsFor(playerCount)));
  const perRound = Math.min(courts, Math.floor(playerCount / 4));
  const played = new Array<number>(playerCount).fill(0);
  const partner = keyMap(playerCount);
  const opponent = keyMap(playerCount);
  const matches: GeneratedMatch[] = [];

  for (let round = 1; round <= roundCount; round += 1) {
    const pool = rankPool(playerCount, played, round);
    const active = pool.slice(0, perRound * 4);

    for (let court = 1; court <= perRound; court += 1) {
      if (active.length < 4) break;
      const p1 = active.shift() as number;
      const p2 = pickBest(active, (c) => partner[p1][c] * 10 + opponent[p1][c]);
      remove(active, p2);
      const p3 = pickBest(active, (c) => (opponent[p1][c] + opponent[p2][c]) * 10);
      remove(active, p3);
      const p4 = pickBest(
        active,
        (c) => partner[p3][c] * 100 + (opponent[p1][c] + opponent[p2][c]) * 10 + opponent[p3][c],
      );
      remove(active, p4);

      matches.push({ round, court, team_a: [p1, p2], team_b: [p3, p4] });

      partner[p1][p2] += 1;
      partner[p2][p1] += 1;
      partner[p3][p4] += 1;
      partner[p4][p3] += 1;
      for (const a of [p1, p2]) {
        for (const b of [p3, p4]) {
          opponent[a][b] += 1;
          opponent[b][a] += 1;
        }
      }
      for (const p of [p1, p2, p3, p4]) played[p] += 1;
    }
  }

  return matches;
}

function keyMap(size: number): number[][] {
  return Array.from({ length: size }, () => new Array<number>(size).fill(0));
}

function rankPool(playerCount: number, played: number[], round: number): number[] {
  const all = Array.from({ length: playerCount }, (_, i) => i);
  return all.sort((a, b) => {
    if (played[a] !== played[b]) return played[a] - played[b];
    // rotate the tiebreak so resting slots move around the field
    const ra = (a + round) % playerCount;
    const rb = (b + round) % playerCount;
    return ra - rb;
  });
}

function pickBest(pool: number[], cost: (candidate: number) => number): number {
  let best = pool[0];
  let bestCost = Number.POSITIVE_INFINITY;
  for (const candidate of pool) {
    const value = cost(candidate);
    if (value < bestCost) {
      bestCost = value;
      best = candidate;
    }
  }
  return best;
}

function remove(pool: number[], value: number): void {
  const index = pool.indexOf(value);
  if (index >= 0) pool.splice(index, 1);
}
