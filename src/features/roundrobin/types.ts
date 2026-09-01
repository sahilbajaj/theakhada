export type RoundRobinPoints = 16 | 24 | 32;
export type RoundRobinStatus = "live" | "completed";
export type RoundRobinMatchStatus = "pending" | "completed";
export type RoundRobinStage = "group" | "semi" | "final";
export type RoundRobinFormat = "points" | "set" | "bo3" | "bo3_mtb";

export interface SetScore {
  a: number;
  b: number;
}

export interface RoundRobinTournamentSummary {
  id: string;
  name: string;
  points_per_match: RoundRobinPoints;
  court_count: number;
  group_count: number;
  group_format: RoundRobinFormat;
  semi_format: RoundRobinFormat;
  final_format: RoundRobinFormat;
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
  sets_for: number;
  sets_against: number;
  games_for: number;
  games_against: number;
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
  format: RoundRobinFormat;
  team_a_points: number | null;
  team_b_points: number | null;
  team_a_sets: number | null;
  team_b_sets: number | null;
  set_scores: SetScore[] | null;
  status: RoundRobinMatchStatus;
}

export interface RoundRobinTournamentDetail {
  id: string;
  name: string;
  points_per_match: RoundRobinPoints;
  court_count: number;
  group_count: number;
  group_format: RoundRobinFormat;
  semi_format: RoundRobinFormat;
  final_format: RoundRobinFormat;
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

export const FORMAT_LABELS: Record<RoundRobinFormat, string> = {
  points: "Points per match",
  set: "1 set (to 6)",
  bo3: "Best of 3 sets",
  bo3_mtb: "Best of 3 (3rd set = match tiebreak)",
};

export const FORMAT_SHORT: Record<RoundRobinFormat, string> = {
  points: "Points",
  set: "1 set",
  bo3: "BO3",
  bo3_mtb: "BO3 · MTB",
};

export function isSetFormat(format: RoundRobinFormat): boolean {
  return format !== "points";
}

export type RRSubmitPayload =
  | { format: "points"; teamAPoints: number; teamBPoints: number }
  | { format: "set"; setScores: SetScore[] };
