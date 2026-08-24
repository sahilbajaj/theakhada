import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ArrowRight, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

function GoogleMark() {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-background text-[13px] font-semibold text-foreground">
      G
    </span>
  );
}

export default function Auth() {
  const { accessStatus, signInWithGoogle, signInWithMagicLink } = useAuth();
  const location = useLocation();
  const from = typeof location.state === "object" && location.state && "from" in location.state
    ? String(location.state.from)
    : "/";
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(from)}`;
  const [email, setEmail] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (accessStatus === "approved") return <Navigate to={from} replace />;

  async function submitMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithMagicLink(email, redirectTo);
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
      setRequestEmail("");
      setFullName("");
    } catch (error) {
      toast.error("Could not request access", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid w-full max-w-md content-center gap-6">
        <div>
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">The Akhada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in or request access to club operations.</p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Button className="w-full" variant="outline" onClick={() => void signInWithGoogle(redirectTo)} disabled={isSubmitting}>
            <GoogleMark />
            <span className="ml-2">Continue with Google</span>
          </Button>

          <div className="my-4 h-px bg-border" />

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Magic link</TabsTrigger>
              <TabsTrigger value="request">Request access</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <form className="grid gap-3" onSubmit={submitMagicLink}>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send magic link
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="request" className="mt-4">
              <form className="grid gap-3" onSubmit={submitAccessRequest}>
                <div className="grid gap-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input id="full-name" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="request-email">Email</Label>
                  <Input id="request-email" type="email" autoComplete="email" required value={requestEmail} onChange={(event) => setRequestEmail(event.target.value)} />
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  Request access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  );
}
