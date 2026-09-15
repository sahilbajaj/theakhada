import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { BestOf, MatchFormat } from "@/features/matches/types";

const CHALLENGES_KEY = ["challenges", "mine"] as const;
const MATCHES_KEY = ["matches", "recent"] as const;
const NOTIFICATIONS_KEY = ["notifications"] as const;

export interface ChallengeParticipant {
  profile_id: string;
  side: "A" | "B";
  position: number;
  response: "pending" | "accepted" | "declined";
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export interface Challenge {
  id: string;
  club_id: string;
  format: MatchFormat;
  best_of: BestOf;
  starts_at: string;
  court_id: string | null;
  court_name: string | null;
  created_by: string;
  creator_full_name: string | null;
  creator_nickname: string | null;
  creator_avatar_url: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  match_id: string | null;
  created_at: string;
  my_response: "pending" | "accepted" | "declined";
  participants: ChallengeParticipant[];
}

export function useMyChallenges(limit = 20) {
  return useQuery({
    queryKey: [...CHALLENGES_KEY, limit],
    enabled: Boolean(supabase),
    queryFn: async (): Promise<Challenge[]> => {
      const { data, error } = await supabase!.rpc("list_my_challenges" as never, { p_limit: limit } as never);
      if (error) throw error;
      return (data as Challenge[] | null) ?? [];
    },
  });
}

interface CreateChallengeInput {
  format: MatchFormat;
  sideA: string[];
  sideB: string[];
  bestOf: BestOf;
  startsAt: string;
  courtId?: string | null;
}

export function useCreateChallenge() {
  const { clubId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateChallengeInput): Promise<string> => {
      const { data, error } = await supabase!.rpc("create_challenge" as never, {
        p_club_id: clubId,
        p_format: input.format,
        p_side_a: input.sideA,
        p_side_b: input.sideB,
        p_best_of: input.bestOf,
        p_starts_at: input.startsAt,
        p_court_id: input.courtId ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CHALLENGES_KEY });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useRespondToChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { challengeId: string; response: "accepted" | "declined" }): Promise<string | null> => {
      const { data, error } = await supabase!.rpc("respond_to_challenge" as never, {
        p_challenge_id: input.challengeId,
        p_response: input.response,
      } as never);
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CHALLENGES_KEY });
      await queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useCancelChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string): Promise<void> => {
      const { error } = await supabase!.rpc("cancel_challenge" as never, { p_challenge_id: challengeId } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CHALLENGES_KEY });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
