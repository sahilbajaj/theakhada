import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["club-insights", clubId],
    enabled: Boolean(supabase && clubId),
    staleTime: 60_000,
    queryFn: async (): Promise<ClubInsights> => {
      const { data, error } = await supabase!.rpc("get_club_insights" as never, { p_club_id: clubId } as never);
      if (error) throw error;
      return { ...EMPTY, ...((data as Partial<ClubInsights> | null) ?? {}) };
    },
  });
}
