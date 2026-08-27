export type AmericanoPoints = 16 | 24 | 32;
export type AmericanoMatchStatus = "pending" | "completed";
export type AmericanoStatus = "live" | "completed";

export interface AmericanoTournamentSummary {
  id: string;
  name: string;
  points_per_match: AmericanoPoints;
  court_count: number;
  status: AmericanoStatus;
  created_at: string;
  player_count: number;
  match_count: number;
  completed_count: number;
}

export interface AmericanoPlayer {
  id: string;
  name: string;
  total_points: number;
  matches_played: number;
}

export interface AmericanoMatchPlayer {
  player_id: string;
  name: string;
  points_scored: number;
}

export interface AmericanoMatch {
  id: string;
  round_number: number;
  court_number: number;
  status: AmericanoMatchStatus;
  team_a: AmericanoMatchPlayer[];
  team_b: AmericanoMatchPlayer[];
}

export interface AmericanoTournamentDetail {
  id: string;
  name: string;
  points_per_match: AmericanoPoints;
  court_count: number;
  status: AmericanoStatus;
  created_at: string;
  players: AmericanoPlayer[];
  matches: AmericanoMatch[];
}

/** A generated fixture, using indexes into the player-name array. */
export interface GeneratedMatch {
  round: number;
  court: number;
  team_a: [number, number];
  team_b: [number, number];
}
