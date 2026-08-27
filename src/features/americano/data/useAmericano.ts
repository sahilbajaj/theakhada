import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AmericanoPoints,
  AmericanoTournamentDetail,
  AmericanoTournamentSummary,
  GeneratedMatch,
} from "@/features/americano/types";

const LIST_KEY = ["americano", "list"] as const;
const detailKey = (id: string) => ["americano", "detail", id] as const;

export function useAmericanoTournaments() {
  return useQuery({
    queryKey: LIST_KEY,
    enabled: Boolean(supabase),
    queryFn: async (): Promise<AmericanoTournamentSummary[]> => {
      const { data, error } = await supabase!.rpc("list_americano_tournaments" as never);
      if (error) throw error;
      return (data as AmericanoTournamentSummary[] | null) ?? [];
    },
  });
}

export function useAmericanoTournament(tournamentId: string | null) {
  return useQuery({
    queryKey: detailKey(tournamentId ?? "none"),
    enabled: Boolean(supabase && tournamentId),
    queryFn: async (): Promise<AmericanoTournamentDetail | null> => {
      const { data, error } = await supabase!.rpc("get_americano_tournament" as never, {
        p_tournament_id: tournamentId,
      } as never);
      if (error) throw error;
      return (data as AmericanoTournamentDetail | null) ?? null;
    },
  });
}

interface CreateTournamentInput {
  name: string;
  playerNames: string[];
  pointsPerMatch: AmericanoPoints;
  courtCount: number;
  matches: GeneratedMatch[];
}

export function useCreateAmericanoTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTournamentInput): Promise<string> => {
      const { data, error } = await supabase!.rpc("create_americano_tournament" as never, {
        p_name: input.name,
        p_player_names: input.playerNames,
        p_points_per_match: input.pointsPerMatch,
        p_court_count: input.courtCount,
        p_matches: input.matches,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

interface SubmitScoreInput {
  tournamentId: string;
  matchId: string;
  teamAPoints: number;
  teamBPoints: number;
}

export function useSubmitAmericanoScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitScoreInput): Promise<void> => {
      const { error } = await supabase!.rpc("submit_americano_score" as never, {
        p_match_id: input.matchId,
        p_team_a_points: input.teamAPoints,
        p_team_b_points: input.teamBPoints,
      } as never);
      if (error) throw error;
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: detailKey(input.tournamentId) });
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useReopenAmericanoMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tournamentId: string; matchId: string }): Promise<void> => {
      const { error } = await supabase!.rpc("reopen_americano_match" as never, {
        p_match_id: input.matchId,
      } as never);
      if (error) throw error;
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: detailKey(input.tournamentId) });
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteAmericanoTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tournamentId: string): Promise<void> => {
      const { error } = await supabase!.rpc("delete_americano_tournament" as never, {
        p_tournament_id: tournamentId,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
