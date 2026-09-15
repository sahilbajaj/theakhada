import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClubRoster, type RosterMember } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { PickerSheet } from "@/features/matches/ui/PickerSheet";
import { useCreateChallenge } from "@/features/challenges/data/useChallenges";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import type { BestOf, MatchFormat } from "@/features/matches/types";

interface Court {
  id: string;
  name: string;
}

function useCourts() {
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["courts", clubId],
    enabled: Boolean(supabase && clubId),
    queryFn: async (): Promise<Court[]> => {
      const { data, error } = await supabase!
        .from("courts")
        .select("id, name")
        .eq("club_id", clubId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data as Court[] | null) ?? [];
    },
  });
}

function defaultStartsAt(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opponentId?: string;
}

type Slot = "partner" | "opponent1" | "opponent2";

export function ChallengeSheet({ open, onOpenChange, opponentId }: Props) {
  const { profile } = useAuth();
  const rosterQuery = useClubRoster();
  const courtsQuery = useCourts();
  const { preferNicknames } = useClubSettings();
  const createChallenge = useCreateChallenge();

  const [format, setFormat] = useState<MatchFormat>("singles");
  const [bestOf, setBestOf] = useState<BestOf>(3);
  const [startsAt, setStartsAt] = useState(defaultStartsAt());
  const [courtId, setCourtId] = useState<string | "none">("none");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [opp1Id, setOpp1Id] = useState<string | null>(opponentId ?? null);
  const [opp2Id, setOpp2Id] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<Slot | null>(null);

  useEffect(() => {
    if (open) {
      setFormat("singles");
      setBestOf(3);
      setStartsAt(defaultStartsAt());
      setCourtId("none");
      setPartnerId(null);
      setOpp1Id(opponentId ?? null);
      setOpp2Id(null);
    }
  }, [open, opponentId]);

  const roster = useMemo(
    () => (rosterQuery.data ?? []).filter((m) => m.role !== "guest" && m.profile_id !== profile?.id),
    [rosterQuery.data, profile?.id],
  );

  const byId = useMemo(() => new Map(roster.map((m) => [m.profile_id, m])), [roster]);
  const partner = partnerId ? byId.get(partnerId) : null;
  const opp1 = opp1Id ? byId.get(opp1Id) : null;
  const opp2 = opp2Id ? byId.get(opp2Id) : null;

  const disabledIds = useMemo(() => {
    const ids: string[] = [];
    if (profile?.id) ids.push(profile.id);
    if (partnerId) ids.push(partnerId);
    if (opp1Id) ids.push(opp1Id);
    if (opp2Id) ids.push(opp2Id);
    return ids;
  }, [profile?.id, partnerId, opp1Id, opp2Id]);

  const canSubmit =
    !!profile?.id &&
    !!opp1Id &&
    !!startsAt &&
    (format === "singles" || (!!partnerId && !!opp2Id));

  async function handleSubmit() {
    if (!profile?.id || !opp1Id) return;
    const sideA = format === "doubles" && partnerId ? [profile.id, partnerId] : [profile.id];
    const sideB = format === "doubles" && opp2Id ? [opp1Id, opp2Id] : [opp1Id];
    try {
      await createChallenge.mutateAsync({
        format,
        sideA,
        sideB,
        bestOf,
        startsAt: new Date(startsAt).toISOString(),
        courtId: courtId === "none" ? null : courtId,
      });
      toast.success("Challenge sent");
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not send challenge", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  function handlePick(id: string) {
    if (pickerFor === "partner") setPartnerId(id);
    if (pickerFor === "opponent1") setOpp1Id(id);
    if (pickerFor === "opponent2") setOpp2Id(id);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule a match</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={format === "singles" ? "default" : "outline"}
                onClick={() => setFormat("singles")}
              >
                <User className="mr-2 h-4 w-4" />
                Singles
              </Button>
              <Button
                type="button"
                variant={format === "doubles" ? "default" : "outline"}
                onClick={() => setFormat("doubles")}
              >
                <Users2 className="mr-2 h-4 w-4" />
                Doubles
              </Button>
            </div>

            {format === "doubles" ? (
              <SlotRow
                label="Your partner"
                member={partner}
                preferNicknames={preferNicknames}
                onPick={() => setPickerFor("partner")}
              />
            ) : null}
            <SlotRow
              label={format === "doubles" ? "Opponent 1" : "Opponent"}
              member={opp1}
              preferNicknames={preferNicknames}
              onPick={() => setPickerFor("opponent1")}
            />
            {format === "doubles" ? (
              <SlotRow
                label="Opponent 2"
                member={opp2}
                preferNicknames={preferNicknames}
                onPick={() => setPickerFor("opponent2")}
              />
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="challenge-time">Date & time</Label>
              <Input
                id="challenge-time"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Court</Label>
                <Select value={courtId} onValueChange={(v) => setCourtId(v)}>
                  <SelectTrigger><SelectValue placeholder="No court" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No court</SelectItem>
                    {(courtsQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Best of</Label>
                <Select value={String(bestOf)} onValueChange={(v) => setBestOf(Number(v) as BestOf)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 set</SelectItem>
                    <SelectItem value="3">Best of 3</SelectItem>
                    <SelectItem value="5">Best of 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={createChallenge.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || createChallenge.isPending}>
              Send challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PickerSheet
        open={pickerFor !== null}
        onOpenChange={(o) => { if (!o) setPickerFor(null); }}
        candidates={roster}
        disabledIds={disabledIds}
        preferNicknames={preferNicknames}
        title={pickerFor === "partner" ? "Pick your partner" : "Pick opponent"}
        onPick={handlePick}
      />
    </>
  );
}

function SlotRow({
  label,
  member,
  preferNicknames,
  onPick,
}: {
  label: string;
  member: RosterMember | null | undefined;
  preferNicknames: boolean;
  onPick: () => void;
}) {
  const name = member ? displayName(member, { preferNicknames }) : null;
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition hover:border-primary/40"
    >
      {member ? (
        <Avatar className="h-9 w-9 shrink-0">
          {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name ?? ""} /> : null}
          <AvatarFallback>{initialsFrom(name ?? "")}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{name ?? "Tap to pick"}</p>
      </div>
    </button>
  );
}
