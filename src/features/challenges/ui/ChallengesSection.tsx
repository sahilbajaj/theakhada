import { format as formatDate } from "date-fns";
import { Check, X, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useClubSettings } from "@/hooks/useClubSettings";
import {
  useCancelChallenge,
  useMyChallenges,
  useRespondToChallenge,
  type Challenge,
  type ChallengeParticipant,
} from "@/features/challenges/data/useChallenges";
import { initialsFrom } from "@/lib/initials";

function nameOf(p: ChallengeParticipant, preferNicknames: boolean): string {
  if (preferNicknames && p.nickname) return p.nickname;
  return p.full_name ?? "Member";
}

export function ChallengesSection() {
  const { profile } = useAuth();
  const { preferNicknames } = useClubSettings();
  const challengesQuery = useMyChallenges(20);
  const respond = useRespondToChallenge();
  const cancel = useCancelChallenge();

  const pending = (challengesQuery.data ?? []).filter((c) => c.status === "pending");
  if (!pending.length) return null;

  async function handleRespond(challengeId: string, response: "accepted" | "declined") {
    try {
      await respond.mutateAsync({ challengeId, response });
      toast.success(response === "accepted" ? "Challenge accepted" : "Challenge declined");
    } catch (err) {
      toast.error("Could not respond", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  async function handleCancel(challengeId: string) {
    try {
      await cancel.mutateAsync(challengeId);
      toast.success("Challenge cancelled");
    } catch (err) {
      toast.error("Could not cancel", { description: err instanceof Error ? err.message : "Try again." });
    }
  }

  return (
    <section className="grid gap-2">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Pending challenges
      </h2>
      <div className="grid gap-2">
        {pending.map((c) => (
          <ChallengeRow
            key={c.id}
            challenge={c}
            selfId={profile?.id ?? null}
            preferNicknames={preferNicknames}
            busy={respond.isPending || cancel.isPending}
            onAccept={() => handleRespond(c.id, "accepted")}
            onDecline={() => handleRespond(c.id, "declined")}
            onCancel={() => handleCancel(c.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ChallengeRow({
  challenge,
  selfId,
  preferNicknames,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  challenge: Challenge;
  selfId: string | null;
  preferNicknames: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const sideA = challenge.participants.filter((p) => p.side === "A");
  const sideB = challenge.participants.filter((p) => p.side === "B");
  const iCreated = selfId === challenge.created_by;
  const canRespond = !iCreated && challenge.my_response === "pending";
  const when = new Date(challenge.starts_at);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{challenge.format === "singles" ? "Singles" : "Doubles"}</Badge>
        <Badge variant="outline">Bo{challenge.best_of}</Badge>
        <span className="text-xs text-muted-foreground">
          {formatDate(when, "EEE, MMM d · h:mm a")}
          {challenge.court_name ? ` · ${challenge.court_name}` : ""}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <SideStack participants={sideA} preferNicknames={preferNicknames} align="start" />
        <span className="text-xs font-semibold text-muted-foreground">vs</span>
        <SideStack participants={sideB} preferNicknames={preferNicknames} align="end" />
      </div>

      <div className="mt-3 flex justify-end gap-2">
        {canRespond ? (
          <>
            <Button variant="ghost" size="sm" onClick={onDecline} disabled={busy}>
              <X className="mr-1.5 h-4 w-4" />
              Decline
            </Button>
            <Button size="sm" onClick={onAccept} disabled={busy}>
              <Check className="mr-1.5 h-4 w-4" />
              Accept
            </Button>
          </>
        ) : iCreated ? (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Cancel
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {challenge.my_response === "accepted" ? "You accepted — waiting for others" : "Awaiting your response"}
          </span>
        )}
      </div>
    </div>
  );
}

function SideStack({
  participants,
  preferNicknames,
  align,
}: {
  participants: ChallengeParticipant[];
  preferNicknames: boolean;
  align: "start" | "end";
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "end" ? "items-end text-right" : "items-start"}`}>
      {participants.map((p) => {
        const name = nameOf(p, preferNicknames);
        return (
          <div key={p.profile_id} className="flex items-center gap-2">
            {align === "end" ? (
              <>
                <span className="truncate text-sm">{name}</span>
                <ParticipantAvatar p={p} name={name} />
              </>
            ) : (
              <>
                <ParticipantAvatar p={p} name={name} />
                <span className="truncate text-sm">{name}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ParticipantAvatar({ p, name }: { p: ChallengeParticipant; name: string }) {
  const ring =
    p.response === "accepted"
      ? "ring-2 ring-primary"
      : p.response === "declined"
        ? "ring-2 ring-destructive"
        : "";
  return (
    <Avatar className={`h-7 w-7 ${ring}`}>
      {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={name} /> : null}
      <AvatarFallback className="text-[10px]">{initialsFrom(name)}</AvatarFallback>
    </Avatar>
  );
}
