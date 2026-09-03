import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { useRecentMatches, useReviewDay, useReviewMatch, useUnreviewedMatches } from "@/features/matches/data/useMatches";
import { MatchCard } from "@/features/matches/ui/MatchCard";
import { ReviewQueue } from "@/features/matches/ui/ReviewQueue";
import { ScoreEntry } from "@/features/matches/ui/ScoreEntry";
import { useAuth } from "@/contexts/AuthContext";
import { useClubSettings } from "@/hooks/useClubSettings";

export default function Scores() {
  const { preferNicknames } = useClubSettings();
  const { role } = useAuth();
  const isAdmin = role === "owner" || role === "admin";
  const matchesQuery = useRecentMatches(50);
  const reviewQueue = useUnreviewedMatches(isAdmin);
  const reviewMatch = useReviewMatch();
  const reviewDay = useReviewDay();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMatchId, setEntryMatchId] = useState<string | null>(null);

  const { live, recent } = useMemo(() => {
    const rows = matchesQuery.data ?? [];
    const order: Record<string, number> = { live: 0, suspended: 1, scheduled: 2 };
    const liveRows = rows
      .filter((m) => m.status !== "final")
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    return {
      live: liveRows,
      recent: rows.filter((m) => m.status === "final"),
    };
  }, [matchesQuery.data]);

  const unreviewed = reviewQueue.data ?? [];
  const reviewPending = reviewMatch.isPending || reviewDay.isPending;

  function handleReviewMatch(matchId: string) {
    reviewMatch.mutate(matchId, {
      onSuccess: () => toast.success("Match marked reviewed"),
      onError: (error) => toast.error("Could not mark reviewed", { description: error instanceof Error ? error.message : "Try again." }),
    });
  }

  function handleReviewDay(day: string) {
    reviewDay.mutate(day, {
      onSuccess: (count) => toast.success(`${count} match${count === 1 ? "" : "es"} marked reviewed`),
      onError: (error) => toast.error("Could not review the day", { description: error instanceof Error ? error.message : "Try again." }),
    });
  }


  function openNew() {
    setEntryMatchId(null);
    setEntryOpen(true);
  }

  function openExisting(matchId: string) {
    setEntryMatchId(matchId);
    setEntryOpen(true);
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Score keeping</h2>
            <p className="text-sm text-muted-foreground">Anyone can start a match. Any set can be corrected later.</p>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />New match</Button>
        </div>
      </section>

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live ({live.length})</TabsTrigger>
          <TabsTrigger value="recent">Recent ({recent.length})</TabsTrigger>
          {isAdmin ? <TabsTrigger value="review">To review ({unreviewed.length})</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="live" className="mt-4 grid gap-3">
          {matchesQuery.isLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : live.length ? (
            live.map((match) => (
              <MatchCard key={match.match_id} match={match} preferNicknames={preferNicknames} onOpen={openExisting} />
            ))
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
              No live matches. Tap “New match” to start one.
            </div>
          )}
        </TabsContent>
        <TabsContent value="recent" className="mt-4 grid gap-3">
          {matchesQuery.isLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : recent.length ? (
            recent.map((match) => (
              <MatchCard
                key={match.match_id}
                match={match}
                preferNicknames={preferNicknames}
                onOpen={openExisting}
                showReviewState={isAdmin}
              />
            ))
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
              Finalized matches appear here.
            </div>
          )}
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="review" className="mt-4">
            {reviewQueue.isLoading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : (
              <ReviewQueue
                matches={unreviewed}
                preferNicknames={preferNicknames}
                onOpen={openExisting}
                onReviewMatch={handleReviewMatch}
                onReviewDay={handleReviewDay}
                isPending={reviewPending}
              />
            )}
          </TabsContent>
        ) : null}
      </Tabs>

      <ScoreEntry open={entryOpen} onOpenChange={setEntryOpen} matchId={entryMatchId} />
    </div>
  );
}
