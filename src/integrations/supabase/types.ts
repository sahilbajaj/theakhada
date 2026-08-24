export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      attendance_records: {
        Row: {
          checked_in_at: string;
          guest_name: string | null;
          id: string;
          profile_id: string | null;
          session_id: string;
        };
        Insert: {
          checked_in_at?: string;
          guest_name?: string | null;
          id?: string;
          profile_id?: string | null;
          session_id: string;
        };
        Update: {
          checked_in_at?: string;
          guest_name?: string | null;
          id?: string;
          profile_id?: string | null;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_sessions: {
        Row: {
          checked_in_count: number;
          club_id: string;
          created_at: string;
          expected_count: number;
          id: string;
          name: string;
          starts_at: string;
        };
        Insert: {
          checked_in_count?: number;
          club_id: string;
          created_at?: string;
          expected_count?: number;
          id?: string;
          name: string;
          starts_at: string;
        };
        Update: {
          checked_in_count?: number;
          club_id?: string;
          created_at?: string;
          expected_count?: number;
          id?: string;
          name?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          club_id: string;
          court_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          players: string[];
          purpose: string;
          starts_at: string;
          status: string;
        };
        Insert: {
          club_id: string;
          court_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          players?: string[];
          purpose?: string;
          starts_at: string;
          status?: string;
        };
        Update: {
          club_id?: string;
          court_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          players?: string[];
          purpose?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
        ];
      };
      club_memberships: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          profile_id: string;
          role: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          profile_id: string;
          role?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          profile_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_memberships_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          city: string | null;
          created_at: string;
          id: string;
          name: string;
          timezone: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          timezone?: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      courts: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          indoor: boolean;
          name: string;
          surface: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          indoor?: boolean;
          name: string;
          surface?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          indoor?: boolean;
          name?: string;
          surface?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courts_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          away_players: string[];
          club_id: string;
          court_id: string | null;
          created_at: string;
          format: string;
          home_players: string[];
          id: string;
          sets: Json;
          starts_at: string;
          status: string;
          tournament_id: string | null;
        };
        Insert: {
          away_players?: string[];
          club_id: string;
          court_id?: string | null;
          created_at?: string;
          format?: string;
          home_players?: string[];
          id?: string;
          sets?: Json;
          starts_at: string;
          status?: string;
          tournament_id?: string | null;
        };
        Update: {
          away_players?: string[];
          club_id?: string;
          court_id?: string | null;
          created_at?: string;
          format?: string;
          home_players?: string[];
          id?: string;
          sets?: Json;
          starts_at?: string;
          status?: string;
          tournament_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_tournament_fk";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          attendance_rate: number;
          auth_user_id: string | null;
          created_at: string;
          full_name: string;
          id: string;
          losses: number;
          rating: number;
          role: string;
          seed: number | null;
          status: string;
          wins: number;
        };
        Insert: {
          attendance_rate?: number;
          auth_user_id?: string | null;
          created_at?: string;
          full_name: string;
          id?: string;
          losses?: number;
          rating?: number;
          role?: string;
          seed?: number | null;
          status?: string;
          wins?: number;
        };
        Update: {
          attendance_rate?: number;
          auth_user_id?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          losses?: number;
          rating?: number;
          role?: string;
          seed?: number | null;
          status?: string;
          wins?: number;
        };
        Relationships: [];
      };
      tournaments: {
        Row: {
          club_id: string;
          created_at: string;
          entrants: number;
          format: string;
          id: string;
          name: string;
          seeded: number;
          starts_at: string;
          status: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          entrants?: number;
          format?: string;
          id?: string;
          name: string;
          seeded?: number;
          starts_at: string;
          status?: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          entrants?: number;
          format?: string;
          id?: string;
          name?: string;
          seeded?: number;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
