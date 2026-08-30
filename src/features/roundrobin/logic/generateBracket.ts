import type { GeneratedRRMatch, GeneratedTeam } from "@/features/roundrobin/types";

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Randomly pair player names into fixed doubles teams, then split into k groups. */
export function generateTeamsAndGroups(playerNames: string[], groupCount: number): GeneratedTeam[] {
  if (playerNames.length < 8) return [];
  if (playerNames.length % 2 !== 0) return [];
  const shuffled = shuffle(playerNames);
  const teams: [string, string][] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    teams.push([shuffled[i], shuffled[i + 1]]);
  }
  const groups = Math.max(1, Math.min(groupCount, Math.floor(teams.length / 2)));
  return teams.map((players, idx) => ({
    players,
    group: (idx % groups) + 1,
  }));
}

/**
 * Round-robin schedule for a single group using the circle method.
 * Returns rounds, each round is a list of [teamIndexInGroup, teamIndexInGroup] pairings.
 */
function scheduleGroup(teamCount: number): [number, number][][] {
  if (teamCount < 2) return [];
  const withBye = teamCount % 2 === 1 ? [...Array(teamCount).keys(), -1] : [...Array(teamCount).keys()];
  const m = withBye.length;
  const rounds: [number, number][][] = [];
  let arr = [...withBye];
  for (let r = 0; r < m - 1; r += 1) {
    const round: [number, number][] = [];
    for (let i = 0; i < m / 2; i += 1) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a !== -1 && b !== -1) round.push([a, b]);
    }
    rounds.push(round);
    arr = [arr[0], arr[m - 1], ...arr.slice(1, m - 1)];
  }
  return rounds;
}

/**
 * Given the team list (index = global team index in creation order) and their group,
 * generate a group-stage schedule. Rounds are per-group; courts cycle within a round.
 */
export function generateRoundRobinSchedule(teams: GeneratedTeam[], courtCount: number): GeneratedRRMatch[] {
  if (teams.length < 4) return [];
  const courts = Math.max(1, courtCount);
  const byGroup = new Map<number, number[]>();
  teams.forEach((t, idx) => {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(idx);
  });

  const matches: GeneratedRRMatch[] = [];
  Array.from(byGroup.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([groupNo, teamIndexes]) => {
      const rounds = scheduleGroup(teamIndexes.length);
      rounds.forEach((round, rIdx) => {
        round.forEach(([localA, localB], mIdx) => {
          matches.push({
            round: rIdx + 1,
            court: ((mIdx) % courts) + 1,
            group: groupNo,
            team_a: teamIndexes[localA],
            team_b: teamIndexes[localB],
          });
        });
      });
    });

  return matches;
}

/** Max distinct groups the given team count can be split into (min 2 teams per group). */
export function maxGroupCountFor(teamCount: number): number {
  return Math.max(1, Math.floor(teamCount / 2));
}
