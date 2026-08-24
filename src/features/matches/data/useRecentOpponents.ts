import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRecentMatches } from "@/features/matches/data/useMatches";

// Returns up to `limit` distinct profile_ids the current user has recently
// played with or against, most recent first. Excludes the current user.
export function useRecentOpponents(limit = 8): string[] {
  const { profile } = useAuth();
  const { data } = useRecentMatches(50);
  return useMemo(() => {
    const selfId = profile?.id;
    if (!selfId || !data?.length) return [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const match of data) {
      const involvesSelf = match.side_a.some((p) => p.profile_id === selfId) || match.side_b.some((p) => p.profile_id === selfId);
      if (!involvesSelf) continue;
      for (const p of [...match.side_a, ...match.side_b]) {
        if (p.profile_id === selfId || seen.has(p.profile_id)) continue;
        seen.add(p.profile_id);
        ordered.push(p.profile_id);
        if (ordered.length >= limit) return ordered;
      }
    }
    return ordered;
  }, [data, profile?.id, limit]);
}
