import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { RoundRobinTeam, RoundRobinTournamentDetail } from "@/features/roundrobin/types";

function rankTeams(teams: RoundRobinTeam[]): RoundRobinTeam[] {
  return [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.points_for - a.points_against;
    const diffB = b.points_for - b.points_against;
    if (diffB !== diffA) return diffB - diffA;
    if (b.points_for !== a.points_for) return b.points_for - a.points_for;
    return a.team_number - b.team_number;
  });
}

export function Standings({ tournament }: { tournament: RoundRobinTournamentDetail }) {
  const byGroup = useMemo(() => {
    const map = new Map<number, RoundRobinTeam[]>();
    tournament.teams.forEach((team) => {
      if (!map.has(team.group_no)) map.set(team.group_no, []);
      map.get(team.group_no)!.push(team);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([group, teams]) => ({ group, teams: rankTeams(teams) }));
  }, [tournament.teams]);

  return (
    <div className="grid gap-4">
      {byGroup.map(({ group, teams }) => (
        <section key={group} className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Group {String.fromCharCode(64 + group)}</h3>
            <Badge variant="outline">{teams.length} teams</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Team</th>
                  <th className="py-2 pr-2 text-right">W</th>
                  <th className="py-2 pr-2 text-right">L</th>
                  <th className="py-2 pr-2 text-right">PF</th>
                  <th className="py-2 pr-2 text-right">PA</th>
                  <th className="py-2 pr-2 text-right">±</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, idx) => (
                  <tr key={team.id} className="border-t border-border/60">
                    <td className="py-2 pr-2 font-semibold tabular-nums">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      <span className="font-medium">{team.player_a}</span> & <span className="font-medium">{team.player_b}</span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{team.wins}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{team.losses}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{team.points_for}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{team.points_against}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{team.points_for - team.points_against}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
