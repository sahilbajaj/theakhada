import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  RoundRobinFormat,
  RoundRobinTeam,
  RoundRobinTournamentDetail,
} from "@/features/roundrobin/types";
import { isSetFormat } from "@/features/roundrobin/types";

function rankTeams(teams: RoundRobinTeam[], setBased: boolean): RoundRobinTeam[] {
  return [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (setBased) {
      const setsA = a.sets_for - a.sets_against;
      const setsB = b.sets_for - b.sets_against;
      if (setsB !== setsA) return setsB - setsA;
      const gamesA = a.games_for - a.games_against;
      const gamesB = b.games_for - b.games_against;
      if (gamesB !== gamesA) return gamesB - gamesA;
      if (b.games_for !== a.games_for) return b.games_for - a.games_for;
    } else {
      const diffA = a.points_for - a.points_against;
      const diffB = b.points_for - b.points_against;
      if (diffB !== diffA) return diffB - diffA;
      if (b.points_for !== a.points_for) return b.points_for - a.points_for;
    }
    return a.team_number - b.team_number;
  });
}

export function Standings({ tournament }: { tournament: RoundRobinTournamentDetail }) {
  const groupFormat: RoundRobinFormat = tournament.group_format;
  const setBased = isSetFormat(groupFormat);

  const byGroup = useMemo(() => {
    const map = new Map<number, RoundRobinTeam[]>();
    tournament.teams.forEach((team) => {
      if (!map.has(team.group_no)) map.set(team.group_no, []);
      map.get(team.group_no)!.push(team);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([group, teams]) => ({ group, teams: rankTeams(teams, setBased) }));
  }, [tournament.teams, setBased]);

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
                  {setBased ? (
                    <>
                      <th className="py-2 pr-2 text-right" title="Sets won">SF</th>
                      <th className="py-2 pr-2 text-right" title="Sets lost">SA</th>
                      <th className="py-2 pr-2 text-right" title="Set difference">±S</th>
                      <th className="py-2 pr-2 text-right" title="Games won">GF</th>
                      <th className="py-2 pr-2 text-right" title="Games lost">GA</th>
                      <th className="py-2 pr-2 text-right" title="Game difference">±G</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 pr-2 text-right">PF</th>
                      <th className="py-2 pr-2 text-right">PA</th>
                      <th className="py-2 pr-2 text-right">±</th>
                    </>
                  )}
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
                    {setBased ? (
                      <>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.sets_for}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.sets_against}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.sets_for - team.sets_against}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.games_for}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.games_against}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.games_for - team.games_against}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.points_for}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.points_against}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{team.points_for - team.points_against}</td>
                      </>
                    )}
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
