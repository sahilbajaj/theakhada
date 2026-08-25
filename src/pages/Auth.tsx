import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Official Google "G" mark — from Google Identity brand assets.
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

export default function Auth() {
  const { accessStatus, signInWithGoogle, signInWithMagicLink } = useAuth();
  const location = useLocation();
  const from = typeof location.state === "object" && location.state && "from" in location.state
    ? String(location.state.from)
    : "/app";
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(from)}`;
  const [email, setEmail] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
  const [accessRequestedFor, setAccessRequestedFor] = useState<string | null>(null);

  if (accessStatus === "approved") return <Navigate to={from} replace />;

  async function submitMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithMagicLink(email, redirectTo);
      setMagicLinkSentTo(email);
      toast.success("Magic link sent", { description: "Check your email to continue." });
    } catch (error) {
      toast.error("Could not send magic link", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitAccessRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase!.rpc("request_access" as never, {
        p_email: requestEmail,
        p_full_name: fullName,
      } as never);
      if (error) throw error;
      toast.success("Request sent", { description: "An admin can approve your access from the Admin page." });
      setAccessRequestedFor(requestEmail);
      setRequestEmail("");
      setFullName("");
    } catch (err) {
      const msg =
        err && typeof err === "object"
          ? [
              (err as { message?: string }).message,
              (err as { details?: string }).details,
              (err as { hint?: string }).hint,
              (err as { code?: string }).code ? `code ${(err as { code?: string }).code}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : String(err);
      toast.error("Could not request access", { description: msg || "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-court-wash" aria-hidden />

      <Link to="/" className="relative z-10 flex items-center gap-2.5 self-start">
        <img
          src="/logo.jpg"
          alt="The Akhada logo"
          className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/60 shadow-card"
        />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-sm font-bold tracking-tight">The Akhada</span>
          <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Tennis club</span>
        </div>
      </Link>

      <section className="relative mx-auto grid w-full max-w-md content-center gap-6">
        <div>
          <Badge variant="status" className="mb-3">Members only</Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Welcome back.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to score matches, watch rankings shift, and see who's playing.</p>
        </div>

        <div className="card-elevated p-5">
          <Button className="w-full" variant="outline" size="lg" onClick={() => void signInWithGoogle(redirectTo)} disabled={isSubmitting}>
            <GoogleMark />
            <span>Continue with Google</span>
          </Button>

          <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>Or by email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Magic link</TabsTrigger>
              <TabsTrigger value="request">Request access</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              {magicLinkSentTo ? (
                <ConfirmationCard
                  title="Check your email"
                  body={<>We sent a magic link to <span className="font-medium text-foreground">{magicLinkSentTo}</span>. Open it on this device to sign in.</>}
                  onReset={() => setMagicLinkSentTo(null)}
                  resetLabel="Use a different email"
                />
              ) : (
                <form className="grid gap-3" onSubmit={submitMagicLink}>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                  <Button type="submit" size="lg" disabled={isSubmitting}>
                    <Mail className="h-4 w-4" />
                    Send magic link
                  </Button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="request" className="mt-4">
              {accessRequestedFor ? (
                <ConfirmationCard
                  title="Request received"
                  body={<>We saved your access request for <span className="font-medium text-foreground">{accessRequestedFor}</span>. A club admin will review it and email you when you're approved.</>}
                  onReset={() => setAccessRequestedFor(null)}
                  resetLabel="Submit another"
                />
              ) : (
                <form className="grid gap-3" onSubmit={submitAccessRequest}>
                  <div className="grid gap-2">
                    <Label htmlFor="full-name">Full name</Label>
                    <Input id="full-name" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="request-email">Email</Label>
                    <Input id="request-email" type="email" autoComplete="email" required value={requestEmail} onChange={(event) => setRequestEmail(event.target.value)} />
                  </div>
                  <Button type="submit" size="lg" disabled={isSubmitting}>
                    Request access
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By signing in you agree to our{" "}
          <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link>
          {" "}and{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
        </p>
      </section>
    </main>
  );
}

function ConfirmationCard({ title, body, onReset, resetLabel }: { title: string; body: React.ReactNode; onReset: () => void; resetLabel: string }) {
  return (
    <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={2.4} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="justify-self-end" onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  );
}
