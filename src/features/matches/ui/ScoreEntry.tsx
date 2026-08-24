import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Sparkles } from "lucide-react";
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
import { useClubRoster, type RosterMember } from "@/hooks/useClubRoster";
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
import { useRecentOpponents } from "@/features/matches/data/useRecentOpponents";
import { PickerSheet } from "@/features/matches/ui/PickerSheet";
import { PlayerSlot } from "@/features/matches/ui/PlayerSlot";
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
type SlotAddress = { side: MatchSide; index: number };

interface DraftSet {
  set_index: number;
  side_a_games: number;
  side_b_games: number;
  tiebreak_a: number | null;
  tiebreak_b: number | null;
}

const GAME_STRIP: number[] = [0, 1, 2, 3, 4, 5, 6, 7];

function toDraftSets(sets: MatchSetRow[]): DraftSet[] {
  if (!sets.length) return [{ set_index: 1, side_a_games: 0, side_b_games: 0, tiebreak_a: null, tiebreak_b: null }];
  return sets.map((s) => ({ ...s }));
}

export function ScoreEntry({ open, onOpenChange, matchId }: Props) {
  const { profile } = useAuth();
  const rosterQuery = useClubRoster();
  const { preferNicknames } = useClubSettings();
  const matchesQuery = useRecentMatches(25);
  const recentIds = useRecentOpponents(8);
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
  const [sideA, setSideA] = useState<(string | null)[]>([]);
  const [sideB, setSideB] = useState<(string | null)[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(matchId ?? null);
  const [drafts, setDrafts] = useState<DraftSet[]>([]);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<SlotAddress | null>(null);

  const activeStatus = existingMatch?.status ?? (activeMatchId ? "live" : "scheduled");
  const perSide = format === "doubles" ? 2 : 1;

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
      setSideA([selfId ?? null]);
      setSideB([null]);
      setDrafts([{ set_index: 1, side_a_games: 0, side_b_games: 0, tiebreak_a: null, tiebreak_b: null }]);
      setCurrentSetIdx(0);
    }
  }, [open, matchId, existingMatch, profile?.id]);

  // Resize slot arrays when format changes (setup phase only).
  useEffect(() => {
    if (phase !== "setup") return;
    setSideA((prev) => resizeSlots(prev, perSide, profile?.id ?? null, true));
    setSideB((prev) => resizeSlots(prev, perSide, null, false));
  }, [phase, perSide, profile?.id]);

  const roster = rosterQuery.data ?? [];
  const rosterById = useMemo(() => new Map(roster.map((r) => [r.profile_id, r])), [roster]);
  const currentSet = drafts[currentSetIdx];

  const memberFor = (id: string | null): RosterMember | undefined => (id ? rosterById.get(id) : undefined);
  const nameFor = (id: string | null): string => {
    const member = memberFor(id);
    return member ? displayName(member, { preferNicknames }) : "Player";
  };

  const filledA = sideA.filter(Boolean) as string[];
  const filledB = sideB.filter(Boolean) as string[];
  const setupValid = filledA.length === perSide && filledB.length === perSide;
  const allSelectedIds = [...filledA, ...filledB];

  function assignSlot(addr: SlotAddress, profileId: string) {
    const setter = addr.side === "A" ? setSideA : setSideB;
    setter((prev) => {
      const next = [...prev];
      // Prevent duplicating an already-picked player elsewhere.
      const otherSide = addr.side === "A" ? sideB : sideA;
      if (otherSide.includes(profileId)) return prev;
      // Remove any earlier occurrence of this id on the same side.
      for (let i = 0; i < next.length; i += 1) {
        if (i !== addr.index && next[i] === profileId) next[i] = null;
      }
      next[addr.index] = profileId;
      return next;
    });
  }

  function clearSlot(addr: SlotAddress) {
    const setter = addr.side === "A" ? setSideA : setSideB;
    setter((prev) => {
      const next = [...prev];
      next[addr.index] = null;
      return next;
    });
  }

  async function handleStart() {
    if (!setupValid) return;
    try {
      const id = await createMatch.mutateAsync({ format, sideA: filledA, sideB: filledB, bestOf });
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

  function setGames(side: MatchSide, value: number) {
    setDrafts((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const set = next[currentSetIdx];
      if (side === "A") set.side_a_games = value;
      else set.side_b_games = value;
      return next;
    });
  }

  function bumpTiebreak(side: MatchSide, delta: number) {
    setDrafts((prev) => {
      const next = prev.map((s) => ({ ...s }));
      const set = next[currentSetIdx];
      const current = side === "A" ? set.tiebreak_a ?? 0 : set.tiebreak_b ?? 0;
      const nextValue = Math.max(0, current + delta);
      if (side === "A") set.tiebreak_a = nextValue;
      else set.tiebreak_b = nextValue;
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
      if (nextIndex > bestOf) return prev;
      return [...prev, { set_index: nextIndex, side_a_games: 0, side_b_games: 0, tiebreak_a: null, tiebreak_b: null }];
    });
    setCurrentSetIdx((prev) => Math.min(prev + 1, bestOf - 1));
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
  const currentAtDeuce = currentSet ? currentSet.side_a_games === 6 && currentSet.side_b_games === 6 : false;
  const showTiebreakUI = currentAtDeuce || (currentSet ? currentSet.tiebreak_a != null || currentSet.tiebreak_b != null : false);
  const targetSets = setsToWin(bestOf);
  const canAddMoreSets = drafts.length < bestOf && !projectedWinner;
  const isFinal = activeStatus === "final";
  const hasAnyGames = tally.a + tally.b > 0 || (currentSet ? currentSet.side_a_games + currentSet.side_b_games > 0 : false);

  const disabledForPicker = pickerFor
    ? allSelectedIds.filter((id) => id && id !== (pickerFor.side === "A" ? sideA[pickerFor.index] : sideB[pickerFor.index]))
    : [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{phase === "setup" ? "New match" : isFinal ? "Match finalized" : "Score match"}</DrawerTitle>
        </DrawerHeader>

        <div className="grid gap-4 overflow-y-auto px-4 pb-2">
          {phase === "setup" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Format</p>
                  <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v as MatchFormat)} className="w-full">
                    <ToggleGroupItem value="singles" className="flex-1">Singles</ToggleGroupItem>
                    <ToggleGroupItem value="doubles" className="flex-1">Doubles</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Sets</p>
                  <ToggleGroup type="single" value={String(bestOf)} onValueChange={(v) => v && setBestOf(Number(v) as BestOf)} className="w-full">
                    <ToggleGroupItem value="1" className="flex-1">1</ToggleGroupItem>
                    <ToggleGroupItem value="3" className="flex-1">BO3</ToggleGroupItem>
                    <ToggleGroupItem value="5" className="flex-1">BO5</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your side</p>
                {sideA.map((id, i) => (
                  <PlayerSlot
                    key={`A-${i}`}
                    member={memberFor(id)}
                    preferNicknames={preferNicknames}
                    locked={i === 0 && id === profile?.id}
                    label={i === 0 ? "Pick you" : "Add partner"}
                    onPick={() => setPickerFor({ side: "A", index: i })}
                    onClear={() => clearSlot({ side: "A", index: i })}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                vs
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Opponents</p>
                {sideB.map((id, i) => (
                  <PlayerSlot
                    key={`B-${i}`}
                    member={memberFor(id)}
                    preferNicknames={preferNicknames}
                    label={i === 0 ? "Pick opponent" : "Add opponent"}
                    onPick={() => setPickerFor({ side: "B", index: i })}
                    onClear={() => clearSlot({ side: "B", index: i })}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground">First to {targetSets} set{targetSets === 1 ? "" : "s"} wins.</p>
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
                    Set {set.set_index} · {set.side_a_games}–{set.side_b_games}
                    {set.tiebreak_a != null || set.tiebreak_b != null ? ` (${set.tiebreak_a ?? 0}–${set.tiebreak_b ?? 0})` : ""}
                  </button>
                ))}
                {!isFinal && !showTiebreakUI ? (
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
                    <Sparkles className="mr-1 h-3 w-3" />
                    Tiebreak
                  </Button>
                ) : null}
              </div>

              <SideScoreCard
                label="Side A"
                names={filledA.map((id) => nameFor(id))}
                avatars={filledA.map((id) => memberFor(id)?.avatar_url ?? null)}
                games={currentSet?.side_a_games ?? 0}
                onSetGames={(v) => setGames("A", v)}
                tiebreak={currentSet?.tiebreak_a ?? null}
                onTiebreakDelta={(d) => bumpTiebreak("A", d)}
                showTiebreak={showTiebreakUI}
                highlight={projectedWinner === "A"}
              />
              <SideScoreCard
                label="Side B"
                names={filledB.map((id) => nameFor(id))}
                avatars={filledB.map((id) => memberFor(id)?.avatar_url ?? null)}
                games={currentSet?.side_b_games ?? 0}
                onSetGames={(v) => setGames("B", v)}
                tiebreak={currentSet?.tiebreak_b ?? null}
                onTiebreakDelta={(d) => bumpTiebreak("B", d)}
                showTiebreak={showTiebreakUI}
                highlight={projectedWinner === "B"}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                <span>Sets: {tally.a}–{tally.b} · first to {targetSets}</span>
                <div className="flex items-center gap-2">
                  {isFinal ? <Badge variant="secondary">Finalized</Badge> : null}
                  {currentComplete ? <Badge variant="secondary">Set complete</Badge> : null}
                  {projectedWinner ? <Badge>Side {projectedWinner} wins</Badge> : null}
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
              <Button
                className="ml-auto"
                onClick={() => setFinalizeOpen(true)}
                disabled={recordSet.isPending || finalizeMatch.isPending || !hasAnyGames}
              >
                End match
              </Button>
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>

      <PickerSheet
        open={Boolean(pickerFor)}
        onOpenChange={(nextOpen) => !nextOpen && setPickerFor(null)}
        candidates={roster}
        disabledIds={disabledForPicker as string[]}
        recentIds={recentIds}
        preferNicknames={preferNicknames}
        title={pickerFor?.side === "A" ? "Add to your side" : "Add opponent"}
        onPick={(id) => pickerFor && assignSlot(pickerFor, id)}
      />

      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this match?</AlertDialogTitle>
            <AlertDialogDescription>
              {projectedWinner
                ? `Sets ${tally.a}–${tally.b}. Winner: Side ${projectedWinner}. You can reopen later to correct anything.`
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

function resizeSlots(current: (string | null)[], size: number, defaultFirst: string | null, keepFirstAsSelf: boolean): (string | null)[] {
  const next: (string | null)[] = [];
  for (let i = 0; i < size; i += 1) {
    if (i === 0 && keepFirstAsSelf) next.push(current[0] ?? defaultFirst);
    else next.push(current[i] ?? null);
  }
  return next;
}

function SideScoreCard({
  label,
  names,
  avatars,
  games,
  onSetGames,
  tiebreak,
  onTiebreakDelta,
  showTiebreak,
  highlight,
}: {
  label: string;
  names: string[];
  avatars: (string | null)[];
  games: number;
  onSetGames: (v: number) => void;
  tiebreak: number | null;
  onTiebreakDelta: (delta: number) => void;
  showTiebreak: boolean;
  highlight: boolean;
}) {
  return (
    <div className={"rounded-lg border p-3 shadow-sm " + (highlight ? "border-primary bg-primary/5" : "bg-card")}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex -space-x-2">
          {avatars.map((src, i) => (
            <Avatar key={i} className="h-8 w-8 border-2 border-background">
              {src ? <AvatarImage src={src} alt={names[i] ?? ""} /> : null}
              <AvatarFallback>{initialsFrom(names[i] ?? "")}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate font-medium">{names.length ? names.join(" / ") : "—"}</p>
        </div>
        <div className="text-3xl font-bold tabular-nums">{games}</div>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {GAME_STRIP.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSetGames(n)}
            className={
              "h-9 rounded-md border text-sm font-medium transition " +
              (n === games ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50")
            }
          >
            {n}
          </button>
        ))}
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

