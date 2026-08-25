import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function PendingAccess() {
  const { profile, signOut, user } = useAuth();
  const email = profile?.email || user?.email || "this account";

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid w-full max-w-md content-center gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
          <h1 className="text-xl font-semibold">Access pending</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {email} is signed in, but it does not have an approved The Akhada membership yet.
          </p>
          <Button className="mt-5" variant="outline" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}
