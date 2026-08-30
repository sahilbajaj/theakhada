export interface InsightPlayer {
  profile_id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export interface WindowLeader {
  player: InsightPlayer;
  wins: number;
  matches: number;
}

export interface ConsistentLeader {
  player: InsightPlayer;
  wins: number;
  straight_wins: number;
}

export interface DedicationLeader {
  player: InsightPlayer;
  matches: number;
}

export interface StreakLeader {
  player: InsightPlayer;
  streak: number;
}

export interface PartnerLeader {
  player_a: InsightPlayer;
  player_b: InsightPlayer;
  wins: number;
  matches: number;
}

export interface ClubInsights {
  player_of_week: WindowLeader | null;
  player_of_month: WindowLeader | null;
  most_consistent: ConsistentLeader | null;
  most_dedicated: DedicationLeader | null;
  longest_streak: StreakLeader | null;
  best_partner: PartnerLeader | null;
}
