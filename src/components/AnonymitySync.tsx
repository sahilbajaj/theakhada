import { useMemo, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClubRoster } from "@/hooks/useClubRoster";
import { isHiddenFrom, setHiddenProfileIds } from "@/lib/anonymity";

/** Keeps the set of profiles hidden from the current viewer up to date. */
export function AnonymitySync({ children }: { children: ReactNode }) {
  const { profile, role } = useAuth();
  const { data } = useClubRoster();
  const key = useMemo(() => {
    const ids = new Set(
      (data ?? []).filter((m) => isHiddenFrom(m, { profileId: profile?.id, role })).map((m) => m.profile_id),
    );
    setHiddenProfileIds(ids);
    return [...ids].sort().join(",");
  }, [data, profile?.id, role]);
  // Remount-free re-render: children re-render whenever this component does.
  return <div className="contents" data-hidden-key={key}>{children}</div>;
}
