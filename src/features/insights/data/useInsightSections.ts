import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  FormInsights,
  MilestonesInsights,
  ParticipationInsights,
  RivalryInsights,
  StyleInsights,
} from "@/features/insights/types";

const EMPTY_RIVALRY: RivalryInsights = {
  fiercest_rivalry: null,
  nemesis: null,
  kryptonite_duo: null,
};

const EMPTY_FORM: FormInsights = {
  hot_hand: null,
  comeback_kid: null,
  giant_slayer: null,
  on_the_rise: null,
};

const EMPTY_STYLE: StyleInsights = {
  tiebreak_king: null,
  grinder: null,
  closer: null,
  bagel_king: null,
};

const EMPTY_PARTICIPATION: ParticipationInsights = {
  early_bird: null,
  night_owl: null,
  weekend_warrior: null,
  social_butterfly: null,
  new_face: null,
};

export function useRivalryInsights(enabled = true) {
  return useQuery({
    queryKey: ["club-insights", "rivalry"],
    enabled: Boolean(supabase) && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<RivalryInsights> => {
      const { data, error } = await supabase!.rpc("get_club_insights_rivalry" as never);
      if (error) throw error;
      return { ...EMPTY_RIVALRY, ...((data as Partial<RivalryInsights> | null) ?? {}) };
    },
  });
}

export function useFormInsights(enabled = true) {
  return useQuery({
    queryKey: ["club-insights", "form"],
    enabled: Boolean(supabase) && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<FormInsights> => {
      const { data, error } = await supabase!.rpc("get_club_insights_form" as never);
      if (error) throw error;
      return { ...EMPTY_FORM, ...((data as Partial<FormInsights> | null) ?? {}) };
    },
  });
}

export function useStyleInsights(enabled = true) {
  return useQuery({
    queryKey: ["club-insights", "style"],
    enabled: Boolean(supabase) && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<StyleInsights> => {
      const { data, error } = await supabase!.rpc("get_club_insights_style" as never);
      if (error) throw error;
      return { ...EMPTY_STYLE, ...((data as Partial<StyleInsights> | null) ?? {}) };
    },
  });
}

export function useParticipationInsights(enabled = true) {
  return useQuery({
    queryKey: ["club-insights", "participation"],
    enabled: Boolean(supabase) && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ParticipationInsights> => {
      const { data, error } = await supabase!.rpc("get_club_insights_participation" as never);
      if (error) throw error;
      return {
        ...EMPTY_PARTICIPATION,
        ...((data as Partial<ParticipationInsights> | null) ?? {}),
      };
    },
  });
}

export function useMilestonesInsights(enabled = true) {
  return useQuery({
    queryKey: ["club-insights", "milestones"],
    enabled: Boolean(supabase) && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<MilestonesInsights> => {
      const { data, error } = await supabase!.rpc("get_club_insights_milestones" as never);
      if (error) throw error;
      const raw = (data as Partial<MilestonesInsights> | null) ?? {};
      return { items: raw.items ?? [] };
    },
  });
}
