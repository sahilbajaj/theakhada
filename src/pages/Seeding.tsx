import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useClubRoster } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { useClearAllSeeds, useSetAllSeeds } from "@/features/seeding/data/useSeeding";
import { suggestedOrder } from "@/features/seeding/logic/computeSuggested";
import { SeedingBoard } from "@/features/seeding/ui/SeedingBoard";

function initialOrder(roster: { profile_id: string; seed: number | null }[], suggestion: string[]): string[] {
  const withSeed = roster.filter((m) => m.seed != null).sort((a, b) => (a.seed as number) - (b.seed as number));
  const withoutSeed = roster.filter((m) => m.seed == null);
  const seededIds = withSeed.map((m) => m.profile_id);
  const unseededSuggestion = suggestion.filter((id) => withoutSeed.some((m) => m.profile_id === id));
  const orphanUnseeded = withoutSeed
    .map((m) => m.profile_id)
    .filter((id) => !unseededSuggestion.includes(id));
  return [...seededIds, ...unseededSuggestion, ...orphanUnseeded];
}

export default function Seeding() {
  const { role } = useAuth();
  const isAdmin = role === "owner" || role === "admin";
  const rosterQuery = useClubRoster();
  const matchesQuery = useRecentMatches(200);
  const { preferNicknames } = useClubSettings();
  const setAllSeeds = useSetAllSeeds();
  const clearAllSeeds = useClearAllSeeds();

  const roster = rosterQuery.data ?? [];
  const matches = matchesQuery.data ?? [];

  const suggestion = useMemo(() => suggestedOrder(roster, matches), [roster, matches]);
  const suggestedSeedById = useMemo(() => {
    const map = new Map<string, number>();
    suggestion.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [suggestion]);
  const membersById = useMemo(() => new Map(roster.map((r) => [r.profile_id, r])), [roster]);

  const [order, setOrder] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<string[]>([]);

  useEffect(() => {
    if (!roster.length) return;
    const next = initialOrder(roster, suggestion);
    setOrder(next);
    setBaseline(next);
  }, [roster, suggestion]);

  const anyUnseeded = roster.some((m) => m.seed == null);
  const dirty =
    order.length > 0 &&
    (anyUnseeded || order.length !== baseline.length || order.some((id, i) => baseline[i] !== id));

  function handleRecompute() {
    setOrder(suggestion);
    toast.success("Applied suggested order (not yet saved)");
  }

  async function handleSave() {
    try {
      await setAllSeeds.mutateAsync(order);
      setBaseline(order);
      toast.success("Seeding saved");
    } catch (err) {
      toast.error("Could not save seeding", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  async function handleClear() {
    try {
      await clearAllSeeds.mutateAsync();
      toast.success("Seeds cleared");
    } catch (err) {
      toast.error("Could not clear seeds", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Seeding</h2>
            <p className="text-sm text-muted-foreground">Seeds recompute automatically as matches finalize (rating + recent form + recency). Drag and Save to override until the next match settles.</p>
            {isAdmin && anyUnseeded ? (
              <p className="mt-1 text-xs text-muted-foreground">No seeds yet — hit Save to publish the suggested order.</p>
            ) : null}
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleRecompute} disabled={setAllSeeds.isPending}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Recompute
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || setAllSeeds.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={clearAllSeeds.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all seeds?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removes seed numbers from every member. You can always recompute from the suggestion afterwards.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={clearAllSeeds.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClear} disabled={clearAllSeeds.isPending}>Clear</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
      </section>

      {rosterQuery.isLoading || matchesQuery.isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : order.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">No members to seed yet.</div>
      ) : (
        <SeedingBoard
          order={order}
          onOrderChange={setOrder}
          membersById={membersById}
          suggestedSeedById={suggestedSeedById}
          preferNicknames={preferNicknames}
          editable={isAdmin}
        />
      )}
    </div>
  );
}
