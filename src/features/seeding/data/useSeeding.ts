import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSetAllSeeds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedProfileIds: string[]): Promise<void> => {
      const { error } = await supabase!.rpc("set_all_seeds" as never, {
        p_profile_ids: orderedProfileIds,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-roster"] });
      await queryClient.invalidateQueries({ queryKey: ["club-members"] });
    },
  });
}

export function useClearAllSeeds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase!.rpc("clear_all_seeds" as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-roster"] });
      await queryClient.invalidateQueries({ queryKey: ["club-members"] });
    },
  });
}
