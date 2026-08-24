import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ClubSettings {
  prefer_nicknames: boolean;
}

export function useClubSettings() {
  const { clubId } = useAuth();
  const query = useQuery({
    queryKey: ["club-settings", clubId],
    enabled: Boolean(supabase) && Boolean(clubId),
    queryFn: async (): Promise<ClubSettings> => {
      const { data, error } = await supabase!
        .from("clubs" as never)
        .select("prefer_nicknames")
        .eq("id", clubId!)
        .single();
      if (error) throw error;
      return (data as ClubSettings) ?? { prefer_nicknames: true };
    },
  });
  return {
    ...query,
    preferNicknames: query.data?.prefer_nicknames ?? true,
  };
}
