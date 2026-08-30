export type RoundRobinPoints = 16 | 24 | 32;
export type RoundRobinStatus = "live" | "completed";
export type RoundRobinMatchStatus = "pending" | "completed";
export type RoundRobinStage = "group" | "semi" | "final";

export interface RoundRobinTournamentSummary {
  id: string;
  name: string;
  points_per_match: RoundRobinPoints;
  court_count: number;
  group_count: number;
  status: RoundRobinStatus;
  created_at: string;
  team_count: number;
  match_count: number;
  completed_count: number;
}

export interface RoundRobinTeam {
  id: string;
  team_number: number;
  group_no: number;
  player_a: string;
  player_b: string;
  total_points: number;
  points_for: number;
  points_against: number;
  wins: number;
  losses: number;
}

export interface RoundRobinMatch {
  id: string;
  stage: RoundRobinStage;
  group_no: number | null;
  round_number: number;
  court_number: number;
  bracket_slot: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_points: number | null;
  team_b_points: number | null;
  status: RoundRobinMatchStatus;
}

export interface RoundRobinTournamentDetail {
  id: string;
  name: string;
  points_per_match: RoundRobinPoints;
  court_count: number;
  group_count: number;
  status: RoundRobinStatus;
  created_at: string;
  teams: RoundRobinTeam[];
  matches: RoundRobinMatch[];
}

export interface GeneratedRRMatch {
  round: number;
  court: number;
  group: number;
  team_a: number;
  team_b: number;
}

export interface GeneratedTeam {
  players: [string, string];
  group: number;
}
