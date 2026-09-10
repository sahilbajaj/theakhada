import { LogOut, Search, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function PendingAccess() {
  const { profile, signOut, user, isSuperadmin } = useAuth();
  const email = profile?.email || user?.email || "this account";

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid w-full max-w-md content-center gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
          <h1 className="text-xl font-semibold">Access pending</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {email} is signed in, but does not have an approved club membership yet.
          </p>
          {isSuperadmin ? (
            <Button asChild className="mt-5">
              <Link to="/superadmin">
                <Shield className="mr-2 h-4 w-4" />
                Open superadmin console
              </Link>
            </Button>
          ) : (
            <Button asChild className="mt-5">
              <Link to="/join-clubs">
                <Search className="mr-2 h-4 w-4" />
                Browse clubs to join
              </Link>
            </Button>
          )}
          <Button className="mt-3" variant="outline" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}
