import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useClubSettings } from "@/hooks/useClubSettings";
import { initialsFrom } from "@/lib/initials";
import { displayName } from "@/lib/displayName";
import { setWinner } from "@/features/matches/logic/scoreRules";
import type { MatchListItem, MatchSide } from "@/features/matches/types";
import { actorName, kindLabel, summaryFor } from "@/features/notifications/logic/format";
import type { NotificationItem } from "@/features/notifications/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NotificationItem[];
  matchesById: Map<string, MatchListItem>;
  startId: string | null;
  onOpenMatch: (item: NotificationItem) => void;
  onMarkRead: (id: string) => void;
}

export function NotificationFeed({ open, onOpenChange, items, matchesById, startId, onOpenMatch, onMarkRead }: Props) {
  const { profile } = useAuth();
  const { preferNicknames } = useClubSettings();
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (startId) {
      const idx = items.findIndex((i) => i.id === startId);
      setActiveIdx(idx >= 0 ? idx : 0);
    } else {
      setActiveIdx(0);
    }
  }, [open, startId, items]);

  useEffect(() => {
    if (!open) return;
    const item = items[activeIdx];
    if (item && !item.read_at) onMarkRead(item.id);
  }, [open, activeIdx, items, onMarkRead]);

  const total = items.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
          <SheetTitle>Activity</SheetTitle>
          {total ? (
            <p className="text-xs text-muted-foreground">
              {Math.min(activeIdx + 1, total)} of {total}
            </p>
          ) : null}
        </SheetHeader>

        {total === 0 ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground">Nothing yet.</div>
        ) : (
          <div className="flex flex-1 snap-y snap-mandatory flex-col gap-4 overflow-y-auto p-4">
            {items.map((item, i) => (
              <FeedCard
                key={item.id}
                item={item}
                match={item.match_id ? matchesById.get(item.match_id) : undefined}
                preferNicknames={preferNicknames}
                selfId={profile?.id ?? null}
                onOpen={() => onOpenMatch(item)}
                onEnter={() => setActiveIdx(i)}
                isActive={i === activeIdx}
              />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FeedCard({
  item,
  match,
  preferNicknames,
  selfId,
  onOpen,
  onEnter,
  isActive,
}: {
  item: NotificationItem;
  match: MatchListItem | undefined;
  preferNicknames: boolean;
  selfId: string | null;
  onOpen: () => void;
  onEnter: () => void;
  isActive: boolean;
}) {
  const summary = summaryFor(item, match, selfId, { preferNicknames });
  const actor = actorName(item, { preferNicknames });
  const created = new Date(item.created_at);

  return (
    <article
      onMouseEnter={onEnter}
      onFocus={onEnter}
      className={
        "flex snap-start flex-col rounded-lg border bg-card p-5 shadow-sm transition " +
        (isActive ? "ring-2 ring-primary/40" : "")
      }
      style={{ minHeight: "60vh" }}
    >
      <div className="flex items-center gap-3">
        <Avatar>
          {item.actor_avatar_url ? <AvatarImage src={item.actor_avatar_url} alt={actor} /> : null}
          <AvatarFallback>{initialsFrom(actor)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{kindLabel(item.kind)}</p>
          <p className="truncate font-medium">{actor}</p>
        </div>
        <p className="text-xs text-muted-foreground">{formatDistanceToNow(created, { addSuffix: true })}</p>
      </div>

      <p className="mt-4 text-lg font-medium leading-snug">{summary}</p>

      {match ? <MatchSummary match={match} preferNicknames={preferNicknames} selfId={selfId} /> : null}

      <div className="mt-auto pt-4">
        <Button onClick={onOpen} className="w-full">
          {match ? "Open match" : "Open"}
        </Button>
      </div>
    </article>
  );
}

function MatchSummary({ match, preferNicknames, selfId }: { match: MatchListItem; preferNicknames: boolean; selfId: string | null }) {
  const selfSide: MatchSide | null = selfId
    ? match.side_a.some((p) => p.profile_id === selfId)
      ? "A"
      : match.side_b.some((p) => p.profile_id === selfId)
      ? "B"
      : null
    : null;
  const winner = match.status === "final" ? match.winner_side : null;

  return (
    <div className="mt-5 grid gap-3">
      <SideLine
        label={selfSide === "A" ? "You" : "Side A"}
        roster={match.side_a}
        sets={match.sets}
        matchStatus={match.status}
        winner={winner}
        side="A"
        preferNicknames={preferNicknames}
      />
      <SideLine
        label={selfSide === "B" ? "You" : "Side B"}
        roster={match.side_b}
        sets={match.sets}
        matchStatus={match.status}
        winner={winner}
        side="B"
        preferNicknames={preferNicknames}
      />
      <div className="flex items-center gap-2">
        <Badge variant={match.status === "final" ? "secondary" : "default"} className="capitalize">
          {match.status}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {match.format}
        </Badge>
      </div>
    </div>
  );
}

function SideLine({
  label,
  roster,
  sets,
  matchStatus,
  winner,
  side,
  preferNicknames,
}: {
  label: string;
  roster: MatchListItem["side_a"];
  sets: MatchListItem["sets"];
  matchStatus: MatchListItem["status"];
  winner: MatchSide | null;
  side: MatchSide;
  preferNicknames: boolean;
}) {
  const isWinner = winner === side;
  const names = roster.map((p) => displayName(p, { preferNicknames })).join(" / ");

  return (
    <div className={"flex items-center gap-3 " + (isWinner ? "font-semibold" : "")}>
      <div className="flex -space-x-2">
        {roster.map((p) => (
          <Avatar key={p.profile_id} className="h-8 w-8 border-2 border-background">
            {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={displayName(p, { preferNicknames })} /> : null}
            <AvatarFallback>{initialsFrom(displayName(p, { preferNicknames }))}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate">{names}</p>
      </div>
      <div className="flex items-center gap-1">
        {sets.map((set) => {
          const games = side === "A" ? set.side_a_games : set.side_b_games;
          const tiebreak = side === "A" ? set.tiebreak_a : set.tiebreak_b;
          const w = setWinner(set);
          const cls =
            matchStatus === "final" && w === side
              ? "text-primary"
              : matchStatus === "final" && w && w !== side
              ? "text-muted-foreground"
              : "";
          return (
            <span key={set.set_index} className={"min-w-[1.5rem] text-center tabular-nums " + cls}>
              {games}
              {tiebreak != null ? <sup className="text-xs">{tiebreak}</sup> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
