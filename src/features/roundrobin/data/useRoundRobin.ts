import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  GeneratedRRMatch,
  RoundRobinFormat,
  RoundRobinPoints,
  RoundRobinTournamentDetail,
  RoundRobinTournamentSummary,
  SetScore,
} from "@/features/roundrobin/types";

const LIST_KEY = ["roundrobin", "list"] as const;
const detailKey = (id: string) => ["roundrobin", "detail", id] as const;

export function useRoundRobinTournaments() {
  return useQuery({
    queryKey: LIST_KEY,
    enabled: Boolean(supabase),
    queryFn: async (): Promise<RoundRobinTournamentSummary[]> => {
      const { data, error } = await supabase!.rpc("list_roundrobin_tournaments" as never);
      if (error) throw error;
      return (data as RoundRobinTournamentSummary[] | null) ?? [];
    },
  });
}

export function useRoundRobinTournament(tournamentId: string | null) {
  return useQuery({
    queryKey: detailKey(tournamentId ?? "none"),
    enabled: Boolean(supabase && tournamentId),
    queryFn: async (): Promise<RoundRobinTournamentDetail | null> => {
      const { data, error } = await supabase!.rpc("get_roundrobin_tournament" as never, {
        p_tournament_id: tournamentId,
      } as never);
      if (error) throw error;
      return (data as RoundRobinTournamentDetail | null) ?? null;
    },
  });
}

interface CreateInput {
  name: string;
  teamNames: [string, string][];
  groupAssignments: number[];
  pointsPerMatch: RoundRobinPoints;
  courtCount: number;
  groupCount: number;
  matches: GeneratedRRMatch[];
  groupFormat: RoundRobinFormat;
  semiFormat: RoundRobinFormat;
  finalFormat: RoundRobinFormat;
}

export function useCreateRoundRobinTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput): Promise<string> => {
      const { data, error } = await supabase!.rpc("create_roundrobin_tournament" as never, {
        p_name: input.name,
        p_team_names: input.teamNames,
        p_group_assignments: input.groupAssignments,
        p_points_per_match: input.pointsPerMatch,
        p_court_count: input.courtCount,
        p_group_count: input.groupCount,
        p_matches: input.matches,
        p_group_format: input.groupFormat,
        p_semi_format: input.semiFormat,
        p_final_format: input.finalFormat,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

interface RegenerateInput {
  tournamentId: string;
  teamNames: [string, string][];
  groupAssignments: number[];
  matches: GeneratedRRMatch[];
}

export function useRegenerateRoundRobinPairings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegenerateInput): Promise<void> => {
      const { error } = await supabase!.rpc("regenerate_roundrobin_pairings" as never, {
        p_tournament_id: input.tournamentId,
        p_team_names: input.teamNames,
        p_group_assignments: input.groupAssignments,
        p_matches: input.matches,
      } as never);
      if (error) throw error;
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: detailKey(input.tournamentId) });
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

interface SubmitInput {
  tournamentId: string;
  matchId: string;
  teamAPoints: number;
  teamBPoints: number;
}

export function useSubmitRoundRobinScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitInput): Promise<void> => {
      const { error } = await supabase!.rpc("submit_roundrobin_score" as never, {
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

interface SubmitSetInput {
  tournamentId: string;
  matchId: string;
  setScores: SetScore[];
}

export function useSubmitRoundRobinSetScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitSetInput): Promise<void> => {
      const { error } = await supabase!.rpc("submit_roundrobin_set_score" as never, {
        p_match_id: input.matchId,
        p_set_scores: input.setScores,
      } as never);
      if (error) throw error;
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: detailKey(input.tournamentId) });
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useReopenRoundRobinMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tournamentId: string; matchId: string }): Promise<void> => {
      const { error } = await supabase!.rpc("reopen_roundrobin_match" as never, {
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

export function useDeleteRoundRobinTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tournamentId: string): Promise<void> => {
      const { error } = await supabase!.rpc("delete_roundrobin_tournament" as never, {
        p_tournament_id: tournamentId,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
