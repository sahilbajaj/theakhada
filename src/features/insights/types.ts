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

// Rivalry & Social ---------------------------------------------------------

export interface FiercestRivalry {
  player_a: InsightPlayer;
  player_b: InsightPlayer;
  meetings: number;
  a_wins: number;
  b_wins: number;
}

export interface NemesisLeader {
  player: InsightPlayer;
  opponent: InsightPlayer;
  losses: number;
}

export interface KryptoniteDuo {
  player_a: InsightPlayer;
  player_b: InsightPlayer;
  wins: number;
  matches: number;
}

export interface RivalryInsights {
  fiercest_rivalry: FiercestRivalry | null;
  nemesis: NemesisLeader | null;
  kryptonite_duo: KryptoniteDuo | null;
}

// Form & Momentum ----------------------------------------------------------

export interface HotHandLeader {
  player: InsightPlayer;
  wins: number;
  matches: number;
}

export interface ComebackLeader {
  player: InsightPlayer;
  comebacks: number;
}

export interface GiantSlayerLeader {
  player: InsightPlayer;
  upsets: number;
}

export interface OnTheRiseLeader {
  player: InsightPlayer;
  past_seed: number;
  current_seed: number;
  climb: number;
}

export interface FormInsights {
  hot_hand: HotHandLeader | null;
  comeback_kid: ComebackLeader | null;
  giant_slayer: GiantSlayerLeader | null;
  on_the_rise: OnTheRiseLeader | null;
}

// Playing Style ------------------------------------------------------------

export interface TiebreakLeader {
  player: InsightPlayer;
  tb_wins: number;
  tb_sets: number;
}

export interface GrinderLeader {
  player: InsightPlayer;
  long_matches: number;
  matches: number;
}

export interface CloserLeader {
  player: InsightPlayer;
  decider_wins: number;
  deciders: number;
}

export interface BagelLeader {
  player: InsightPlayer;
  bagels: number;
}

export interface StyleInsights {
  tiebreak_king: TiebreakLeader | null;
  grinder: GrinderLeader | null;
  closer: CloserLeader | null;
  bagel_king: BagelLeader | null;
}

// Participation & Community ------------------------------------------------

export interface HourLeader {
  player: InsightPlayer;
  matches: number;
}

export interface WeekendLeader {
  player: InsightPlayer;
  weekend_matches: number;
  matches: number;
}

export interface SocialButterflyLeader {
  player: InsightPlayer;
  partners: number;
}

export interface NewFaceLeader {
  player: InsightPlayer;
  matches: number;
  joined_at: string;
}

export interface ParticipationInsights {
  early_bird: HourLeader | null;
  night_owl: HourLeader | null;
  weekend_warrior: WeekendLeader | null;
  social_butterfly: SocialButterflyLeader | null;
  new_face: NewFaceLeader | null;
}

// Milestones ---------------------------------------------------------------

export type MilestoneKind =
  | "nth_match"
  | "first_win"
  | "first_straight_win"
  | "first_doubles_win";

export interface MilestoneItem {
  player: InsightPlayer;
  kind: MilestoneKind;
  value: number;
  at: string;
  match_id: string;
}

export interface MilestonesInsights {
  items: MilestoneItem[];
}
