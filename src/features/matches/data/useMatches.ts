import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BestOf, MatchFormat, MatchListItem } from "@/features/matches/types";

const MATCHES_KEY = ["matches", "recent"] as const;

export function useRecentMatches(limit = 25) {
  return useQuery({
    queryKey: [...MATCHES_KEY, limit],
    enabled: Boolean(supabase),
    queryFn: async (): Promise<MatchListItem[]> => {
      const { data, error } = await supabase!.rpc("list_recent_matches" as never, { p_limit: limit } as never);
      if (error) throw error;
      return (data as MatchListItem[] | null) ?? [];
    },
  });
}

interface CreateMatchInput {
  format: MatchFormat;
  sideA: string[];
  sideB: string[];
  bestOf: BestOf;
  courtId?: string | null;
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMatchInput): Promise<string> => {
      const { data, error } = await supabase!.rpc("create_match" as never, {
        p_format: input.format,
        p_side_a: input.sideA,
        p_side_b: input.sideB,
        p_best_of: input.bestOf,
        p_court_id: input.courtId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
    },
  });
}

export function useReopenMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string): Promise<void> => {
      const { error } = await supabase!.rpc("reopen_match" as never, { p_match_id: matchId } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
    },
  });
}

interface RecordSetInput {
  matchId: string;
  setIndex: number;
  sideAGames: number;
  sideBGames: number;
  tiebreakA?: number | null;
  tiebreakB?: number | null;
}

export function useRecordSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordSetInput): Promise<void> => {
      const { error } = await supabase!.rpc("record_set" as never, {
        p_match_id: input.matchId,
        p_set_index: input.setIndex,
        p_side_a_games: input.sideAGames,
        p_side_b_games: input.sideBGames,
        p_tiebreak_a: input.tiebreakA ?? null,
        p_tiebreak_b: input.tiebreakB ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
    },
  });
}

export function useFinalizeMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string): Promise<void> => {
      const { error } = await supabase!.rpc("finalize_match" as never, { p_match_id: matchId } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
    },
  });
}
