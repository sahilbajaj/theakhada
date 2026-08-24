export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      clubs: {
        Row: { id: string; name: string; city: string | null; timezone: string; created_at: string };
        Insert: { id?: string; name: string; city?: string | null; timezone?: string; created_at?: string };
        Update: { id?: string; name?: string; city?: string | null; timezone?: string; created_at?: string };
      };
      courts: {
        Row: { id: string; club_id: string; name: string; surface: string; indoor: boolean; active: boolean; created_at: string };
        Insert: { id?: string; club_id: string; name: string; surface?: string; indoor?: boolean; active?: boolean; created_at?: string };
        Update: { id?: string; club_id?: string; name?: string; surface?: string; indoor?: boolean; active?: boolean; created_at?: string };
      };
      profiles: {
        Row: { id: string; full_name: string; role: string; rating: number; seed: number | null; status: string; attendance_rate: number; wins: number; losses: number; created_at: string };
        Insert: { id?: string; full_name: string; role?: string; rating?: number; seed?: number | null; status?: string; attendance_rate?: number; wins?: number; losses?: number; created_at?: string };
        Update: { id?: string; full_name?: string; role?: string; rating?: number; seed?: number | null; status?: string; attendance_rate?: number; wins?: number; losses?: number; created_at?: string };
      };
      bookings: {
        Row: { id: string; club_id: string; court_id: string; starts_at: string; ends_at: string; status: string; players: string[]; purpose: string; created_at: string };
        Insert: { id?: string; club_id: string; court_id: string; starts_at: string; ends_at: string; status?: string; players?: string[]; purpose?: string; created_at?: string };
        Update: { id?: string; club_id?: string; court_id?: string; starts_at?: string; ends_at?: string; status?: string; players?: string[]; purpose?: string; created_at?: string };
      };
      matches: {
        Row: { id: string; club_id: string; tournament_id: string | null; court_id: string | null; format: string; starts_at: string; status: string; home_players: string[]; away_players: string[]; sets: Json; created_at: string };
        Insert: { id?: string; club_id: string; tournament_id?: string | null; court_id?: string | null; format?: string; starts_at: string; status?: string; home_players?: string[]; away_players?: string[]; sets?: Json; created_at?: string };
        Update: { id?: string; club_id?: string; tournament_id?: string | null; court_id?: string | null; format?: string; starts_at?: string; status?: string; home_players?: string[]; away_players?: string[]; sets?: Json; created_at?: string };
      };
      attendance_sessions: {
        Row: { id: string; club_id: string; name: string; starts_at: string; expected_count: number; checked_in_count: number; created_at: string };
        Insert: { id?: string; club_id: string; name: string; starts_at: string; expected_count?: number; checked_in_count?: number; created_at?: string };
        Update: { id?: string; club_id?: string; name?: string; starts_at?: string; expected_count?: number; checked_in_count?: number; created_at?: string };
      };
      tournaments: {
        Row: { id: string; club_id: string; name: string; status: string; format: string; entrants: number; seeded: number; starts_at: string; created_at: string };
        Insert: { id?: string; club_id: string; name: string; status?: string; format?: string; entrants?: number; seeded?: number; starts_at: string; created_at?: string };
        Update: { id?: string; club_id?: string; name?: string; status?: string; format?: string; entrants?: number; seeded?: number; starts_at?: string; created_at?: string };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
