import { Fragment, useMemo, type ReactNode } from "react";
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
  // Re-mount the app only when the hidden set actually changes, so every
  // name and photo picks up the new privacy state right away.
  return <Fragment key={key}>{children}</Fragment>;
}
