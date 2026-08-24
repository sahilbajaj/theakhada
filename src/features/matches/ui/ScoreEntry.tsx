import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/contexts/AuthContext";
import { useClubRoster } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import {
  useCreateMatch,
  useFinalizeMatch,
  useRecentMatches,
  useRecordSet,
  useReopenMatch,
} from "@/features/matches/data/useMatches";
import { OpponentPicker } from "@/features/matches/ui/OpponentPicker";
import { isSetComplete, matchWinner, setsToWin, tallySets } from "@/features/matches/logic/scoreRules";
import type {
  BestOf,
  MatchFormat,
  MatchListItem,
  MatchParticipant,
  MatchSetRow,
  MatchSide,
} from "@/features/matches/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId?: string | null;
}

type Phase = "setup" | "scoring";

interface DraftSet {
  set_index: number;
  side_a_games: number;
  side_b_games: number;
  tiebreak_a: number | null;
  tiebreak_b: number | null;
}

function toDraftSets(sets: MatchSetRow[]): DraftSet[] {
  if (!sets.length) return [{ set_index: 1, side_a_games: 0, side_b_games: 0, tiebreak_a: null, tiebreak_b: null }];
  return sets.map((s) => ({ ...s }));
}

export function ScoreEntry({ open, onOpenChange, matchId }: Props) {
  const { profile } = useAuth();
  const rosterQuery = useClubRoster();
  const { preferNicknames } = useClubSettings();
  const matchesQuery = useRecentMatches(25);
  const createMatch = useCreateMatch();
  const recordSet = useRecordSet();
  const finalizeMatch = useFinalizeMatch();
  const reopenMatch = useReopenMatch();

  const existingMatch: MatchListItem | undefined = useMemo(
    () => matchesQuery.data?.find((m) => m.match_id === matchId) ?? undefined,
    [matchesQuery.data, matchId],
  );

  const [phase, setPhase] = useState<Phase>(matchId ? "scoring" : "setup");
  const [format, setFormat] = useState<MatchFormat>("singles");
  const [bestOf, setBestOf] = useState<BestOf>(3);
  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(matchId ?? null);
  const [drafts, setDrafts] = useState<DraftSet[]>([]);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const activeStatus = existingMatch?.status ?? (activeMatchId ? "live" : "scheduled");

  // Reset when the drawer opens fresh, or hydrate when opening onto an existing match.
  useEffect(() => {
    if (!open) return;
    if (matchId && existingMatch) {
      setPhase("scoring");
      setFormat(existingMatch.format);
      setBestOf(existingMatch.best_of);
      setActiveMatchId(matchId);
      setSideA(existingMatch.side_a.map((p: MatchParticipant) => p.profile_id));
      setSideB(existingMatch.side_b.map((p: MatchParticipant) => p.profile_id));
      const hydrated = toDraftSets(existingMatch.sets);
      setDrafts(hydrated);
      setCurrentSetIdx(hydrated.length - 1);
    } else if (!matchId) {
      setPhase("setup");
      setFormat("singles");
      setBestOf(3);
      setActiveMatchId(null);
      const selfId = profile?.id;
      setSideA(selfId ? [selfId] : []);
      setSideB([]);
      setDrafts([{ set_index: 1, side_a_games: 0, side_b_games: 0, tiebreak_a: null, tiebreak_b: null }]);
      setCurrentSetIdx(0);
    }
  }, [open, matchId, existingMatch, profile?.id]);

  const perSide = format === "doubles" ? 2 : 1;
  const roster = rosterQuery.data ?? [];
  const currentSet = drafts[currentSetIdx];

  const nameFor = (id: string) => {
    const member = roster.find((r) => r.profile_id === id);
    if (!member) return "Player";
    return displayName(member, { preferNicknames });
  };

  const avatarFor = (id: string) => roster.find((r) => r.profile_id === id)?.avatar_url ?? null;

  const setupValid = sideA.length === perSide && sideB.length === perSide;

  async function handleStart() {
    if (!setupValid) return;
    try {
      const id = await createMatch.mutateAsync({ format, sideA, sideB, bestOf });
      setActiveMatchId(id);
      setPhase("scoring");
      toast.success("Match started");
    } catch (err) {
      toast.error("Could not start match", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  async function handleReopen() {
    if (!activeMatchId) return;
    try {
      await reopenMatch.mutateAsync(activeMatchId);
      toast.success("Match reopened");
    } catch (err) {
      toast.error("Could not reopen", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  function bumpGame(side: MatchSide, delta: number) {
    setDrafts((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const set = next[currentSetIdx];
      if (side === "A") set.side_a_games = Math.max(0, Math.min(7, set.side_a_games + delta));
      else set.side_b_games = Math.max(0, Math.min(7, set.side_b_games + delta));
      return next;
    });
  }

  function bumpTiebreak(side: MatchSide, delta: number) {
    setDrafts((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const set = next[currentSetIdx];
      if (side === "A") set.tiebreak_a = Math.max(0, (set.tiebreak_a ?? 0) + delta);
      else set.tiebreak_b = Math.max(0, (set.tiebreak_b ?? 0) + delta);
      return next;
    });
  }

  async function saveCurrentSet(): Promise<boolean> {
    if (!activeMatchId || !currentSet) return false;
    try {
      await recordSet.mutateAsync({
        matchId: activeMatchId,
        setIndex: currentSet.set_index,
        sideAGames: currentSet.side_a_games,
        sideBGames: currentSet.side_b_games,
        tiebreakA: currentSet.tiebreak_a,
        tiebreakB: currentSet.tiebreak_b,
      });
      return true;
    } catch (err) {
      toast.error("Could not save set", { description: err instanceof Error ? err.message : "Try again." });
      return false;
    }
  }

  async function nextSet() {
    const ok = await saveCurrentSet();
    if (!ok) return;
    setDrafts((prev) => {
      const nextIndex = prev.length + 1;
      if (nextIndex > 5) return prev;
      return [...prev, { set_index: nextIndex, side_a_games: 0, side_b_games: 0, tiebreak_a: null, tiebreak_b: null }];
    });
    setCurrentSetIdx((prev) => Math.min(prev + 1, 4));
    toast.success("Set saved");
  }

  async function endMatch() {
    if (!activeMatchId) return;
    const ok = await saveCurrentSet();
    if (!ok) return;
    try {
      await finalizeMatch.mutateAsync(activeMatchId);
      toast.success("Match finalized");
      setFinalizeOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not finalize", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  const tally = tallySets(drafts);
  const projectedWinner = matchWinner(drafts, bestOf);
  const currentComplete = currentSet ? isSetComplete(currentSet) : false;
  const showTiebreak = currentSet ? currentSet.side_a_games === 6 && currentSet.side_b_games === 6 : false;
  const targetSets = setsToWin(bestOf);
  const canAddMoreSets = drafts.length < bestOf && !projectedWinner;
  const isFinal = activeStatus === "final";
  const showTiebreakUI =
    showTiebreak ||
    (currentSet ? currentSet.tiebreak_a != null || currentSet.tiebreak_b != null : false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader>
          <DrawerTitle>{phase === "setup" ? "New match" : "Score match"}</DrawerTitle>
        </DrawerHeader>

        <div className="grid gap-4 overflow-y-auto px-4 pb-2">
          {phase === "setup" ? (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">Format</p>
                <ToggleGroup type="single" value={format} onValueChange={(value) => value && setFormat(value as MatchFormat)}>
                  <ToggleGroupItem value="singles">Singles</ToggleGroupItem>
                  <ToggleGroupItem value="doubles">Doubles</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Sets</p>
                <ToggleGroup type="single" value={String(bestOf)} onValueChange={(value) => value && setBestOf(Number(value) as BestOf)}>
                  <ToggleGroupItem value="1">1 set</ToggleGroupItem>
                  <ToggleGroupItem value="3">Best of 3</ToggleGroupItem>
                  <ToggleGroupItem value="5">Best of 5</ToggleGroupItem>
                </ToggleGroup>
                <p className="mt-1 text-xs text-muted-foreground">First to {setsToWin(bestOf)} set{setsToWin(bestOf) === 1 ? "" : "s"} wins.</p>
              </div>
              <SidePicker
                label={`Side A (${sideA.length}/${perSide})`}
                selected={sideA}
                onToggle={(id) => setSideA((prev) => toggleWithinLimit(prev, id, perSide))}
                candidates={roster}
                disabledIds={sideB}
                preferNicknames={preferNicknames}
                nameFor={nameFor}
                avatarFor={avatarFor}
              />
              <SidePicker
                label={`Side B (${sideB.length}/${perSide})`}
                selected={sideB}
                onToggle={(id) => setSideB((prev) => toggleWithinLimit(prev, id, perSide))}
                candidates={roster}
                disabledIds={sideA}
                preferNicknames={preferNicknames}
                nameFor={nameFor}
                avatarFor={avatarFor}
              />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {drafts.map((set, index) => (
                  <button
                    key={set.set_index}
                    type="button"
                    onClick={() => setCurrentSetIdx(index)}
                    className={
                      "rounded-md border px-3 py-1 text-sm " +
                      (index === currentSetIdx ? "border-primary bg-primary/10 font-semibold" : "border-border")
                    }
                  >
                    Set {set.set_index} · {set.side_a_games}-{set.side_b_games}
                    {set.tiebreak_a != null || set.tiebreak_b != null ? ` (${set.tiebreak_a ?? 0}-${set.tiebreak_b ?? 0})` : ""}
                  </button>
                ))}
              </div>
              <SideCounter
                label="Side A"
                names={sideA.map(nameFor)}
                avatars={sideA.map(avatarFor)}
                games={currentSet?.side_a_games ?? 0}
                tiebreak={currentSet?.tiebreak_a}
                onGameDelta={(d) => bumpGame("A", d)}
                onTiebreakDelta={(d) => bumpTiebreak("A", d)}
                showTiebreak={showTiebreakUI}
              />
              <SideCounter
                label="Side B"
                names={sideB.map(nameFor)}
                avatars={sideB.map(avatarFor)}
                games={currentSet?.side_b_games ?? 0}
                tiebreak={currentSet?.tiebreak_b}
                onGameDelta={(d) => bumpGame("B", d)}
                onTiebreakDelta={(d) => bumpTiebreak("B", d)}
                showTiebreak={showTiebreakUI}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                <span>Sets: {tally.a}–{tally.b} · first to {targetSets}</span>
                <div className="flex items-center gap-2">
                  {isFinal ? <Badge variant="secondary">Finalized</Badge> : null}
                  {currentComplete ? <Badge variant="secondary">Set complete</Badge> : null}
                  {projectedWinner ? <Badge>{projectedWinner === "A" ? "Side A wins" : "Side B wins"}</Badge> : null}
                  {!isFinal ? (
                    showTiebreakUI ? (
                      !showTiebreak ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDrafts((prev) => {
                              const next = prev.map((s) => ({ ...s }));
                              next[currentSetIdx].tiebreak_a = null;
                              next[currentSetIdx].tiebreak_b = null;
                              return next;
                            })
                          }
                        >
                          Clear tiebreak
                        </Button>
                      ) : null
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDrafts((prev) => {
                            const next = prev.map((s) => ({ ...s }));
                            next[currentSetIdx].tiebreak_a = 0;
                            next[currentSetIdx].tiebreak_b = 0;
                            return next;
                          })
                        }
                      >
                        Add tiebreak
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>

        <DrawerFooter>
          {phase === "setup" ? (
            <Button onClick={handleStart} disabled={!setupValid || createMatch.isPending}>
              Start match
            </Button>
          ) : isFinal ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button className="ml-auto" onClick={handleReopen} disabled={reopenMatch.isPending}>
                Reopen to edit
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => saveCurrentSet().then((ok) => ok && toast.success("Set saved"))} disabled={recordSet.isPending}>
                Save set
              </Button>
              <Button variant="outline" onClick={nextSet} disabled={recordSet.isPending || !canAddMoreSets}>
                Next set
              </Button>
              <Button className="ml-auto" onClick={() => setFinalizeOpen(true)} disabled={recordSet.isPending || finalizeMatch.isPending || tally.a + tally.b === 0 && (currentSet?.side_a_games ?? 0) === 0 && (currentSet?.side_b_games ?? 0) === 0}>
                End match
              </Button>
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>

      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this match?</AlertDialogTitle>
            <AlertDialogDescription>
              {projectedWinner
                ? `Sets ${tally.a}–${tally.b}. Winner: Side ${projectedWinner}. You can reopen the match later if you need to correct anything.`
                : `Sets ${tally.a}–${tally.b}. No clear winner yet — you can still finalize based on the current sets.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizeMatch.isPending || recordSet.isPending}>Keep scoring</AlertDialogCancel>
            <AlertDialogAction onClick={endMatch} disabled={finalizeMatch.isPending || recordSet.isPending}>
              End match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}

function toggleWithinLimit(prev: string[], id: string, limit: number): string[] {
  if (prev.includes(id)) return prev.filter((x) => x !== id);
  if (prev.length >= limit) return [...prev.slice(1), id];
  return [...prev, id];
}

function SidePicker({
  label,
  selected,
  onToggle,
  candidates,
  disabledIds,
  preferNicknames,
  nameFor,
  avatarFor,
}: {
  label: string;
  selected: string[];
  onToggle: (id: string) => void;
  candidates: import("@/hooks/useClubRoster").RosterMember[];
  disabledIds: string[];
  preferNicknames: boolean;
  nameFor: (id: string) => string;
  avatarFor: (id: string) => string | null;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => (
            <Badge key={id} variant="secondary" className="flex items-center gap-2 pl-1 pr-2">
              <Avatar className="h-5 w-5">
                {avatarFor(id) ? <AvatarImage src={avatarFor(id)!} alt={nameFor(id)} /> : null}
                <AvatarFallback className="text-[10px]">{initialsFrom(nameFor(id))}</AvatarFallback>
              </Avatar>
              {nameFor(id)}
              <button type="button" onClick={() => onToggle(id)} aria-label="Remove" className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </Badge>
          ))}
        </div>
      ) : null}
      <OpponentPicker
        candidates={candidates}
        selectedIds={selected}
        onToggle={onToggle}
        preferNicknames={preferNicknames}
        disabledIds={disabledIds}
      />
    </div>
  );
}

function SideCounter({
  label,
  names,
  avatars,
  games,
  tiebreak,
  onGameDelta,
  onTiebreakDelta,
  showTiebreak,
}: {
  label: string;
  names: string[];
  avatars: (string | null)[];
  games: number;
  tiebreak: number | null | undefined;
  onGameDelta: (delta: number) => void;
  onTiebreakDelta: (delta: number) => void;
  showTiebreak: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex -space-x-2">
          {names.map((n, i) => (
            <Avatar key={i} className="h-7 w-7 border-2 border-background">
              {avatars[i] ? <AvatarImage src={avatars[i]!} alt={n} /> : null}
              <AvatarFallback>{initialsFrom(n)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate font-medium">{names.length ? names.join(" / ") : "—"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button size="icon" variant="outline" onClick={() => onGameDelta(-1)} disabled={games === 0} aria-label="Decrement games">
          <Minus className="h-4 w-4" />
        </Button>
        <div className="text-4xl font-bold tabular-nums">{games}</div>
        <Button size="icon" onClick={() => onGameDelta(1)} disabled={games >= 7} aria-label="Increment games">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {showTiebreak ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tiebreak</p>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => onTiebreakDelta(-1)} disabled={(tiebreak ?? 0) === 0} aria-label="Decrement tiebreak">
              <Minus className="h-4 w-4" />
            </Button>
            <div className="min-w-[2rem] text-center text-lg font-semibold tabular-nums">{tiebreak ?? 0}</div>
            <Button size="icon" onClick={() => onTiebreakDelta(1)} aria-label="Increment tiebreak">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
