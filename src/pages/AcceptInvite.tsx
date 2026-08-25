import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function AcceptInvite() {
  const { accessStatus, profile, refreshAccess, session, signInWithGoogle, signInWithMagicLink } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const redirectTo = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) return <Navigate to="/auth" replace />;
  if (accessStatus === "approved") return <Navigate to="/app" replace />;

  async function submitMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithMagicLink(email, redirectTo);
      toast.success("Magic link sent", { description: "Open the link from your email to accept this invite." });
    } catch (error) {
      toast.error("Could not send magic link", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase!.rpc("accept_invite" as never, {
        p_token: token,
        p_full_name: fullName,
      } as never);
      if (error) throw error;
      await refreshAccess();
      toast.success("Invite accepted");
      navigate("/app", { replace: true });
    } catch (error) {
      toast.error("Could not accept invite", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid w-full max-w-md content-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Accept invite</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with the invited email address to join The Akhada.</p>
        </div>

        {!session ? (
          <div className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-card">
            <Button variant="outline" onClick={() => void signInWithGoogle(redirectTo)} disabled={isSubmitting}>
              Continue with Google
            </Button>
            <form className="grid gap-3" onSubmit={submitMagicLink}>
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                <Mail className="mr-2 h-4 w-4" />
                Send magic link
              </Button>
            </form>
          </div>
        ) : (
          <form className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-card" onSubmit={acceptInvite}>
            <div className="grid gap-2">
              <Label htmlFor="invite-name">Full name</Label>
              <Input id="invite-name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              <Check className="mr-2 h-4 w-4" />
              Accept invite
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
