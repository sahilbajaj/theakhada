import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SeedFormat = "combined" | "singles" | "doubles";

export function useSetAllSeeds() {
  const { clubId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderedProfileIds: string[]; format: SeedFormat }): Promise<void> => {
      const { error } = await supabase!.rpc("set_all_seeds" as never, {
        p_club_id: clubId,
        p_profile_ids: input.orderedProfileIds,
        p_format: input.format,
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
  const { clubId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (format: SeedFormat): Promise<void> => {
      const { error } = await supabase!.rpc("clear_all_seeds" as never, {
        p_club_id: clubId,
        p_format: format,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["club-roster"] });
      await queryClient.invalidateQueries({ queryKey: ["club-members"] });
    },
  });
}
