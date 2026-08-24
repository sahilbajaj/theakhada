export type MatchFormat = "singles" | "doubles";
export type MatchStatus = "scheduled" | "live" | "final";
export type MatchSide = "A" | "B";
export type BestOf = 1 | 3 | 5;

export interface MatchParticipant {
  profile_id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  position: number;
}

export interface MatchSetRow {
  set_index: number;
  side_a_games: number;
  side_b_games: number;
  tiebreak_a: number | null;
  tiebreak_b: number | null;
}

export interface MatchListItem {
  match_id: string;
  format: MatchFormat;
  status: MatchStatus;
  starts_at: string;
  court_id: string | null;
  best_of: BestOf;
  side_a: MatchParticipant[];
  side_b: MatchParticipant[];
  sets: MatchSetRow[];
  winner_side: MatchSide | null;
}
