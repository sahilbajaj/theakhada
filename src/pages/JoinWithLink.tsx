import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ShareablePreview {
  club_id: string | null;
  club_name: string | null;
  role: string;
  status: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  is_full: boolean;
}

export default function JoinWithLink() {
  const { profile, refreshAccess, session, signInWithGoogle, signInWithMagicLink } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const redirectTo = `${window.location.origin}/join?token=${encodeURIComponent(token)}`;
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    if (profile?.fullName) setFullName(profile.fullName);
  }, [profile?.fullName]);

  const previewQuery = useQuery({
    queryKey: ["shareable-invite-preview", token],
    enabled: Boolean(supabase && token),
    queryFn: async (): Promise<ShareablePreview | null> => {
      const { data, error } = await supabase!.rpc("preview_shareable_invite" as never, { p_token: token } as never);
      if (error) throw error;
      return ((data as ShareablePreview[] | null)?.[0]) ?? null;
    },
  });
  const preview = previewQuery.data ?? null;
  const invalid = !previewQuery.isLoading && !preview;
  const expired = preview ? new Date(preview.expires_at).getTime() <= Date.now() : false;
  const revoked = preview?.status === "revoked";
  const full = preview?.is_full === true;
  const unusable = invalid || expired || revoked || full;

  if (!token) return <Navigate to="/auth" replace />;

  async function submitMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithMagicLink(email, redirectTo);
      toast.success("Magic link sent", { description: "Open the link from your email to continue." });
    } catch (error) {
      toast.error("Could not send magic link", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase!.rpc("redeem_shareable_invite" as never, {
        p_token: token,
        p_full_name: fullName,
      } as never);
      if (error) throw error;
      setRedeemed(true);
      await refreshAccess();
      toast.success("You're in — pick a club to join");
      navigate("/join-clubs", { replace: true });
    } catch (error) {
      toast.error("Could not redeem link", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const suggestion = preview?.club_name
    ? `You'll request to join ${preview.club_name} as ${preview.role}.`
    : `Sign up and pick a club to join.`;
  const headline = preview?.club_name ? `Join ${preview.club_name}` : "Join a club";

  const disabledMessage = invalid
    ? "This link isn't valid."
    : revoked
      ? "This link has been revoked."
      : expired
        ? "This link has expired."
        : full
          ? "This link has reached its usage limit."
          : null;

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid w-full max-w-md content-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{headline}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {disabledMessage ?? (previewQuery.isLoading ? "Loading…" : suggestion)}
          </p>
        </div>

        {unusable || redeemed ? null : !session ? (
          <div className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-card">
            <Button variant="outline" onClick={() => void signInWithGoogle(redirectTo)} disabled={isSubmitting}>
              Continue with Google
            </Button>
            <form className="grid gap-3" onSubmit={submitMagicLink}>
              <div className="grid gap-2">
                <Label htmlFor="join-email">Email</Label>
                <Input id="join-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                <Mail className="mr-2 h-4 w-4" />
                Send magic link
              </Button>
            </form>
          </div>
        ) : (
          <form className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-card" onSubmit={redeem}>
            <div className="grid gap-2">
              <Label htmlFor="join-name">Full name</Label>
              <Input id="join-name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
