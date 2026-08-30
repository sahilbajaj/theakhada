import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface RosterMember {
  profile_id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  rating: number | null;
  seed: number | null;
  role: string;
}

interface MembershipRow {
  profile_id: string;
  role: string;
  profiles: {
    id: string;
    full_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    rating: number | null;
    seed: number | null;
    email: string | null;
    role: string | null;
  } | null;
}

export function useClubRoster() {
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["club-roster", clubId],
    enabled: Boolean(supabase) && Boolean(clubId),
    queryFn: async (): Promise<RosterMember[]> => {
      const { data, error } = await supabase!
        .from("club_memberships" as never)
        .select("profile_id, role, profiles:profile_id(id, full_name, nickname, avatar_url, rating, seed, email, role)")
        .eq("club_id", clubId!);
      if (error) throw error;
      const rows = (data as MembershipRow[] | null) ?? [];
      return rows
        .filter((row) => row.profiles)
        .map((row) => ({
          profile_id: row.profiles!.id,
          full_name: row.profiles!.full_name ?? row.profiles!.email ?? "Member",
          nickname: row.profiles!.nickname,
          avatar_url: row.profiles!.avatar_url,
          rating: row.profiles!.rating,
          seed: row.profiles!.seed,
          role: row.role ?? row.profiles!.role ?? "player",
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });
}
