import { useQuery } from "@tanstack/react-query";
import { demoClubSnapshot } from "@/data/demoData";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import type { ClubSnapshot, Match, ScoreSet } from "@/types/club";

const DEMO_DELAY_MS = 180;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isScoreSets(value: unknown): value is ScoreSet[] {
  return Array.isArray(value) && value.every((set) => {
    if (!set || typeof set !== "object") return false;
    const candidate = set as Partial<ScoreSet>;
    return typeof candidate.home === "number" && typeof candidate.away === "number";
  });
}

export function useClubSnapshot() {
  return useQuery({
    queryKey: ["club-snapshot"],
    staleTime: 60_000,
    queryFn: async (): Promise<ClubSnapshot> => {
      if (!hasSupabaseConfig || !supabase) {
        await wait(DEMO_DELAY_MS);
        return demoClubSnapshot;
      }

      const { data: clubs, error: clubError } = await supabase.from("clubs").select("*").limit(1);
      if (clubError) throw clubError;

      const club = clubs?.[0];
      if (!club) return demoClubSnapshot;

      const [courtsResult, playersResult, bookingsResult, matchesResult, attendanceResult, tournamentsResult] = await Promise.all([
        supabase.from("courts").select("*").eq("club_id", club.id).order("name"),
        supabase.from("profiles").select("*").order("rating", { ascending: false }),
        supabase.from("bookings").select("*").eq("club_id", club.id).order("starts_at"),
        supabase.from("matches").select("*").eq("club_id", club.id).order("starts_at"),
        supabase.from("attendance_sessions").select("*").eq("club_id", club.id).order("starts_at"),
        supabase.from("tournaments").select("*").eq("club_id", club.id).order("starts_at"),
      ]);

      const firstError = [courtsResult, playersResult, bookingsResult, matchesResult, attendanceResult, tournamentsResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const courts = courtsResult.data ?? [];

      return {
        club: {
          id: club.id,
          name: club.name,
          city: club.city ?? "",
          timezone: club.timezone,
        },
        courts: courts.map((court) => ({
          id: court.id,
          clubId: court.club_id,
          name: court.name,
          surface: court.surface as ClubSnapshot["courts"][number]["surface"],
          indoor: court.indoor,
          active: court.active,
        })),
        players: (playersResult.data ?? []).map((player) => ({
          id: player.id,
          clubId: club.id,
          fullName: player.full_name,
          role: player.role as ClubSnapshot["players"][number]["role"],
          rating: player.rating,
          seed: player.seed,
          status: player.status as ClubSnapshot["players"][number]["status"],
          attendanceRate: player.attendance_rate,
          wins: player.wins,
          losses: player.losses,
        })),
        bookings: (bookingsResult.data ?? []).map((booking) => ({
          id: booking.id,
          clubId: booking.club_id,
          courtId: booking.court_id,
          courtName: courts.find((court) => court.id === booking.court_id)?.name ?? "Court",
          startsAt: booking.starts_at,
          endsAt: booking.ends_at,
          status: booking.status as ClubSnapshot["bookings"][number]["status"],
          players: booking.players,
          purpose: booking.purpose as ClubSnapshot["bookings"][number]["purpose"],
        })),
        matches: (matchesResult.data ?? []).map((match): Match => ({
          id: match.id,
          clubId: match.club_id,
          format: match.format as Match["format"],
          courtName: courts.find((court) => court.id === match.court_id)?.name ?? "Court",
          startsAt: match.starts_at,
          status: match.status as Match["status"],
          home: match.home_players,
          away: match.away_players,
          sets: isScoreSets(match.sets) ? match.sets : [],
          tournamentId: match.tournament_id ?? undefined,
        })),
        attendance: (attendanceResult.data ?? []).map((session) => ({
          id: session.id,
          clubId: session.club_id,
          name: session.name,
          startsAt: session.starts_at,
          expectedCount: session.expected_count,
          checkedInCount: session.checked_in_count,
        })),
        tournaments: (tournamentsResult.data ?? []).map((tournament) => ({
          id: tournament.id,
          clubId: tournament.club_id,
          name: tournament.name,
          status: tournament.status as ClubSnapshot["tournaments"][number]["status"],
          format: tournament.format as ClubSnapshot["tournaments"][number]["format"],
          entrants: tournament.entrants,
          seeded: tournament.seeded,
          startsAt: tournament.starts_at,
        })),
      };
    },
  });
}
