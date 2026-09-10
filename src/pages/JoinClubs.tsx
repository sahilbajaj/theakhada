import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface JoinClubsProps {
  variant?: "standalone" | "embedded";
}

interface JoinableClub {
  id: string;
  name: string;
  city: string | null;
  has_pending_request: boolean;
}

export default function JoinClubs({ variant = "standalone" }: JoinClubsProps) {
  const { session, signOut } = useAuth();
  const queryClient = useQueryClient();
  const embedded = variant === "embedded";

  const clubsQuery = useQuery({
    queryKey: ["joinable-clubs"],
    enabled: Boolean(supabase && session),
    queryFn: async (): Promise<JoinableClub[]> => {
      const { data, error } = await supabase!.rpc("list_joinable_clubs" as never);
      if (error) throw error;
      return (data as JoinableClub[] | null) ?? [];
    },
  });

  const requestMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const { error } = await supabase!.rpc("request_club_join" as never, {
        p_club_id: clubId,
        p_requested_role: "player",
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["joinable-clubs"] });
      toast.success("Request sent — an admin will review it");
    },
    onError: (error) => toast.error("Could not send request", { description: error instanceof Error ? error.message : "Try again." }),
  });

  if (!session) return <Navigate to="/auth" replace />;

  const clubs = clubsQuery.data ?? [];

  const content = (
    <section className={embedded ? "grid gap-4" : "mx-auto grid w-full max-w-lg content-start gap-4"}>
      <div>
        <h1 className="text-2xl font-semibold">
          {embedded ? "Explore clubs" : "Choose a club to join"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {embedded
            ? "Request to join any club below. Admins will review your request."
            : "Request access to any club below. An admin will approve you."}
        </p>
      </div>

      <div className="grid gap-3">
        {clubsQuery.isLoading ? (
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
            Loading clubs…
          </div>
        ) : clubs.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
            {embedded ? "You're already in every club." : "No clubs available right now."}
          </div>
        ) : (
          clubs.map((club) => (
            <div key={club.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{club.name}</p>
                {club.city ? <p className="truncate text-xs text-muted-foreground">{club.city}</p> : null}
              </div>
              {club.has_pending_request ? (
                <Badge variant="secondary">Requested</Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => requestMutation.mutate(club.id)}
                  disabled={requestMutation.isPending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Request to join
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {embedded ? null : (
        <Button variant="outline" onClick={() => void signOut()} className="justify-self-start">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      )}
    </section>
  );

  if (embedded) return content;

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 text-foreground">
      {content}
    </main>
  );
}
