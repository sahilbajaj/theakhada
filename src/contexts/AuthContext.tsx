import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import type { MemberRole } from "@/types/club";

export interface Membership {
  clubId: string;
  clubName: string;
  role: MemberRole;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AccessProfile | null;
  memberships: Membership[];
  currentClubId: string | null;
  setCurrentClubId: (clubId: string) => void;
  role: MemberRole | null;
  clubId: string | null;
  isSuperadmin: boolean;
  accessStatus: AccessStatus;
  isConfigured: boolean;
  isLoading: boolean;
  demoMode: boolean;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

type AccessStatus = "loading" | "unauthenticated" | "pending" | "approved" | "demo";

interface AccessProfile {
  id: string;
  fullName: string;
  email: string;
}

interface AccessRow {
  profile_id: string | null;
  club_id: string | null;
  club_name: string | null;
  role: MemberRole | null;
  full_name: string | null;
  email: string | null;
  has_membership: boolean;
  is_superadmin: boolean;
}

const CURRENT_CLUB_STORAGE_KEY = "akhada.currentClubId";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [currentClubId, setCurrentClubIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(CURRENT_CLUB_STORAGE_KEY);
  });
  const [accessStatus, setAccessStatus] = useState<AccessStatus>(hasSupabaseConfig ? "loading" : "demo");
  const [isLoading, setIsLoading] = useState(hasSupabaseConfig);

  const setCurrentClubId = useCallback((clubId: string) => {
    setCurrentClubIdState(clubId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CURRENT_CLUB_STORAGE_KEY, clubId);
    }
  }, []);

  const loadAccess = useCallback(async (nextSession: Session | null) => {
    if (!supabase) {
      setAccessStatus("demo");
      setIsLoading(false);
      return;
    }

    if (!nextSession) {
      setProfile(null);
      setMemberships([]);
      setIsSuperadmin(false);
      setAccessStatus("unauthenticated");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.rpc("claim_current_access" as never);
    if (error) {
      console.error(error);
      setProfile(null);
      setMemberships([]);
      setIsSuperadmin(false);
      setAccessStatus("pending");
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as AccessRow[];
    const first = rows[0] ?? null;

    setProfile(first?.profile_id ? {
      id: first.profile_id,
      fullName: first.full_name ?? first.email ?? "Member",
      email: first.email ?? nextSession.user.email ?? "",
    } : null);

    const nextMemberships: Membership[] = rows
      .filter((r): r is AccessRow & { club_id: string; role: MemberRole; club_name: string } =>
        Boolean(r.has_membership && r.club_id && r.role))
      .map((r) => ({
        clubId: r.club_id,
        clubName: r.club_name ?? "",
        role: r.role,
      }));

    setMemberships(nextMemberships);
    setIsSuperadmin(Boolean(first?.is_superadmin));
    setAccessStatus(nextMemberships.length > 0 ? "approved" : "pending");

    setCurrentClubIdState((prev) => {
      if (prev && nextMemberships.some((m) => m.clubId === prev)) return prev;
      const fallback = nextMemberships[0]?.clubId ?? null;
      if (typeof window !== "undefined") {
        if (fallback) window.localStorage.setItem(CURRENT_CLUB_STORAGE_KEY, fallback);
        else window.localStorage.removeItem(CURRENT_CLUB_STORAGE_KEY);
      }
      return fallback;
    });

    setIsLoading(false);
  }, []);

  const refreshAccess = useCallback(async () => {
    await loadAccess(session);
  }, [loadAccess, session]);

  const signInWithMagicLink = useCallback(async (email: string, redirectTo = `${window.location.origin}/auth/callback`) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async (redirectTo = `${window.location.origin}/auth/callback`) => {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_CLUB_STORAGE_KEY);
    }
    setCurrentClubIdState(null);
    setIsSuperadmin(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      setAccessStatus("demo");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadAccess(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadAccess(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadAccess]);

  const currentMembership = useMemo(
    () => memberships.find((m) => m.clubId === currentClubId) ?? null,
    [memberships, currentClubId],
  );

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    profile,
    memberships,
    currentClubId,
    setCurrentClubId,
    role: currentMembership?.role ?? null,
    clubId: currentMembership?.clubId ?? null,
    isSuperadmin,
    accessStatus,
    isConfigured: hasSupabaseConfig,
    isLoading,
    demoMode: !hasSupabaseConfig,
    signInWithMagicLink,
    signInWithGoogle,
    signOut,
    refreshAccess,
  }), [
    accessStatus,
    currentClubId,
    currentMembership,
    isLoading,
    isSuperadmin,
    memberships,
    profile,
    refreshAccess,
    session,
    setCurrentClubId,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
