import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClubInsights } from "@/features/insights/types";

const EMPTY: ClubInsights = {
  player_of_week: null,
  player_of_month: null,
  most_consistent: null,
  most_dedicated: null,
  longest_streak: null,
  best_partner: null,
};

export function useClubInsights() {
  return useQuery({
    queryKey: ["club-insights"],
    enabled: Boolean(supabase),
    staleTime: 60_000,
    queryFn: async (): Promise<ClubInsights> => {
      const { data, error } = await supabase!.rpc("get_club_insights" as never);
      if (error) throw error;
      return { ...EMPTY, ...((data as Partial<ClubInsights> | null) ?? {}) };
    },
  });
}
