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
import { toast } from "@/components/ui/sonner";
import type { RosterMember } from "@/hooks/useClubRoster";
import { useClearAllSeeds, useSetAllSeeds, type SeedFormat } from "@/features/seeding/data/useSeeding";
import { suggestedOrder } from "@/features/seeding/logic/computeSuggested";
import { SeedingBoard } from "@/features/seeding/ui/SeedingBoard";
import type { MatchListItem } from "@/features/matches/types";

const FORMAT_LABEL: Record<SeedFormat, string> = {
  combined: "Combined",
  singles: "Singles",
  doubles: "Doubles",
};

export function seedFor(member: RosterMember, format: SeedFormat): number | null {
  if (format === "singles") return member.singles_seed;
  if (format === "doubles") return member.doubles_seed;
  return member.seed;
}

function initialOrder(
  roster: RosterMember[],
  format: SeedFormat,
  suggestion: string[],
): string[] {
  const eligibleIds = new Set(
    format === "combined" ? roster.map((m) => m.profile_id) : suggestion,
  );
  const eligible = roster.filter((m) => eligibleIds.has(m.profile_id));
  const withSeed = eligible
    .filter((m) => seedFor(m, format) != null)
    .sort((a, b) => (seedFor(a, format) as number) - (seedFor(b, format) as number));
  const withoutSeed = eligible.filter((m) => seedFor(m, format) == null);
  const seededIds = withSeed.map((m) => m.profile_id);
  const unseededSuggestion = suggestion.filter((id) => withoutSeed.some((m) => m.profile_id === id));
  const orphanUnseeded = withoutSeed
    .map((m) => m.profile_id)
    .filter((id) => !unseededSuggestion.includes(id));
  return [...seededIds, ...unseededSuggestion, ...orphanUnseeded];
}

interface Props {
  format: SeedFormat;
  roster: RosterMember[];
  matches: MatchListItem[];
  preferNicknames: boolean;
  isAdmin: boolean;
}

export function SeedingPane({ format, roster, matches, preferNicknames, isAdmin }: Props) {
  const setAllSeeds = useSetAllSeeds();
  const clearAllSeeds = useClearAllSeeds();

  const suggestion = useMemo(() => suggestedOrder(roster, matches, format), [roster, matches, format]);
  const suggestedSeedById = useMemo(() => {
    const map = new Map<string, number>();
    suggestion.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [suggestion]);
  const priorSeedById = useMemo(() => {
    const map = new Map<string, number | null>();
    roster.forEach((m) => map.set(m.profile_id, seedFor(m, format)));
    return map;
  }, [roster, format]);
  const membersById = useMemo(() => new Map(roster.map((r) => [r.profile_id, r])), [roster]);

  const [order, setOrder] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<string[]>([]);

  useEffect(() => {
    if (!roster.length) {
      setOrder([]);
      setBaseline([]);
      return;
    }
    const next = initialOrder(roster, format, suggestion);
    setOrder(next);
    setBaseline(next);
  }, [roster, format, suggestion]);

  const eligibleForFormat = useMemo(() => {
    if (format === "combined") return roster;
    const ids = new Set(suggestion);
    return roster.filter((m) => ids.has(m.profile_id));
  }, [roster, format, suggestion]);

  const anyUnseeded = eligibleForFormat.some((m) => seedFor(m, format) == null);
  const dirty =
    order.length > 0 &&
    (anyUnseeded || order.length !== baseline.length || order.some((id, i) => baseline[i] !== id));

  function handleRecompute() {
    setOrder(suggestion);
    toast.success("Applied suggested order (not yet saved)");
  }

  async function handleSave() {
    try {
      await setAllSeeds.mutateAsync({ orderedProfileIds: order, format });
      setBaseline(order);
      toast.success(`${FORMAT_LABEL[format]} seeding saved`);
    } catch (err) {
      toast.error("Could not save seeding", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  async function handleClear() {
    try {
      await clearAllSeeds.mutateAsync(format);
      toast.success(`${FORMAT_LABEL[format]} seeds cleared`);
    } catch (err) {
      toast.error("Could not clear seeds", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  const description =
    format === "combined"
      ? "Ranked across all finalized matches."
      : format === "singles"
        ? "Ranked from singles matches only. Members who haven't played a singles match yet are hidden."
        : "Ranked from doubles matches only. Members who haven't played a doubles match yet are hidden.";

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{description}</p>
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
                    <AlertDialogTitle>Clear {FORMAT_LABEL[format].toLowerCase()} seeds?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removes {FORMAT_LABEL[format].toLowerCase()} seed numbers from every member. You can always recompute from the suggestion afterwards.
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

      {order.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
          {format === "combined"
            ? "No members to seed yet."
            : `No members have played a ${FORMAT_LABEL[format].toLowerCase()} match yet.`}
        </div>
      ) : (
        <SeedingBoard
          order={order}
          onOrderChange={setOrder}
          membersById={membersById}
          suggestedSeedById={suggestedSeedById}
          priorSeedById={priorSeedById}
          preferNicknames={preferNicknames}
          editable={isAdmin}
        />
      )}
    </div>
  );
}
