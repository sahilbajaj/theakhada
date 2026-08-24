export type MemberRole = "owner" | "admin" | "coach" | "player" | "guest";
export type BookingStatus = "confirmed" | "checked_in" | "completed" | "cancelled";
export type CourtSurface = "hard" | "clay" | "grass" | "synthetic";
export type MatchFormat = "singles" | "doubles";
export type TournamentStatus = "draft" | "registration" | "seeding" | "live" | "completed";

export interface Club {
  id: string;
  name: string;
  city: string;
  timezone: string;
}

export interface Court {
  id: string;
  clubId: string;
  name: string;
  surface: CourtSurface;
  indoor: boolean;
  active: boolean;
}

export interface Player {
  id: string;
  clubId: string;
  fullName: string;
  role: MemberRole;
  rating: number;
  seed: number | null;
  status: "active" | "paused" | "visitor";
  attendanceRate: number;
  wins: number;
  losses: number;
}

export interface Booking {
  id: string;
  clubId: string;
  courtId: string;
  courtName: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  players: string[];
  purpose: "practice" | "coaching" | "league" | "tournament" | "social";
}

export interface ScoreSet {
  home: number;
  away: number;
  tieBreak?: string;
}

export interface Match {
  id: string;
  clubId: string;
  format: MatchFormat;
  courtName: string;
  startsAt: string;
  status: "scheduled" | "live" | "final";
  home: string[];
  away: string[];
  sets: ScoreSet[];
  tournamentId?: string;
}

export interface AttendanceSession {
  id: string;
  clubId: string;
  name: string;
  startsAt: string;
  expectedCount: number;
  checkedInCount: number;
}

export interface Tournament {
  id: string;
  clubId: string;
  name: string;
  status: TournamentStatus;
  format: MatchFormat;
  entrants: number;
  seeded: number;
  startsAt: string;
}

export interface ClubSnapshot {
  club: Club;
  courts: Court[];
  players: Player[];
  bookings: Booking[];
  matches: Match[];
  attendance: AttendanceSession[];
  tournaments: Tournament[];
}
