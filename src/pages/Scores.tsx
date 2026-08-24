import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { MatchCard } from "@/features/matches/ui/MatchCard";
import { ScoreEntry } from "@/features/matches/ui/ScoreEntry";
import { useClubSettings } from "@/hooks/useClubSettings";

export default function Scores() {
  const { preferNicknames } = useClubSettings();
  const matchesQuery = useRecentMatches(50);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMatchId, setEntryMatchId] = useState<string | null>(null);

  const { live, recent } = useMemo(() => {
    const rows = matchesQuery.data ?? [];
    return {
      live: rows.filter((m) => m.status !== "final"),
      recent: rows.filter((m) => m.status === "final"),
    };
  }, [matchesQuery.data]);

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
      <section className="rounded-lg border bg-card p-4 shadow-sm">
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
        </TabsList>
        <TabsContent value="live" className="mt-4 grid gap-3">
          {matchesQuery.isLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : live.length ? (
            live.map((match) => (
              <MatchCard key={match.match_id} match={match} preferNicknames={preferNicknames} onOpen={openExisting} />
            ))
          ) : (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
              No live matches. Tap “New match” to start one.
            </div>
          )}
        </TabsContent>
        <TabsContent value="recent" className="mt-4 grid gap-3">
          {matchesQuery.isLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : recent.length ? (
            recent.map((match) => (
              <MatchCard key={match.match_id} match={match} preferNicknames={preferNicknames} onOpen={openExisting} />
            ))
          ) : (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground shadow-sm">
              Finalized matches appear here.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ScoreEntry open={entryOpen} onOpenChange={setEntryOpen} matchId={entryMatchId} />
    </div>
  );
}
