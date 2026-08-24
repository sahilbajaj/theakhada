import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import type { MemberRole } from "@/types/club";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AccessProfile | null;
  role: MemberRole | null;
  clubId: string | null;
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
  role: MemberRole | null;
  full_name: string | null;
  email: string | null;
  has_membership: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>(hasSupabaseConfig ? "loading" : "demo");
  const [isLoading, setIsLoading] = useState(hasSupabaseConfig);

  const loadAccess = useCallback(async (nextSession: Session | null) => {
    if (!supabase) {
      setAccessStatus("demo");
      setIsLoading(false);
      return;
    }

    if (!nextSession) {
      setProfile(null);
      setRole(null);
      setClubId(null);
      setAccessStatus("unauthenticated");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.rpc("claim_current_access" as never);
    if (error) {
      console.error(error);
      setProfile(null);
      setRole(null);
      setClubId(null);
      setAccessStatus("pending");
      setIsLoading(false);
      return;
    }

    const access = (data?.[0] ?? null) as AccessRow | null;
    setProfile(access?.profile_id ? {
      id: access.profile_id,
      fullName: access.full_name ?? access.email ?? "Member",
      email: access.email ?? nextSession.user.email ?? "",
    } : null);
    setRole(access?.role ?? null);
    setClubId(access?.club_id ?? null);
    setAccessStatus(access?.has_membership ? "approved" : "pending");
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

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    profile,
    role,
    clubId,
    accessStatus,
    isConfigured: hasSupabaseConfig,
    isLoading,
    demoMode: !hasSupabaseConfig,
    signInWithMagicLink,
    signInWithGoogle,
    signOut,
    refreshAccess,
  }), [accessStatus, clubId, isLoading, profile, refreshAccess, role, session, signInWithGoogle, signInWithMagicLink, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
