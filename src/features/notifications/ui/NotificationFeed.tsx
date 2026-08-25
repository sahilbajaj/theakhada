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
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3 pr-12">
          <SheetTitle>Activity</SheetTitle>
          {total ? <p className="text-xs text-muted-foreground">{total}</p> : null}
        </SheetHeader>

        {total === 0 ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground">Nothing yet.</div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-3">
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
        "flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-3 shadow-card transition " +
        (isActive ? "ring-2 ring-primary/40" : "")
      }
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          {item.actor_avatar_url ? <AvatarImage src={item.actor_avatar_url} alt={actor} /> : null}
          <AvatarFallback>{initialsFrom(actor)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{kindLabel(item.kind)}</p>
          <p className="truncate text-sm font-medium">{actor}</p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(created, { addSuffix: true })}</p>
      </div>

      <p className="mt-2 text-sm leading-snug">{summary}</p>

      {match ? <MatchSummary match={match} preferNicknames={preferNicknames} selfId={selfId} /> : null}

      <div className="mt-3">
        <Button onClick={onOpen} size="sm" variant="outline" className="w-full">
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
    <div className="mt-3 grid gap-2">
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
    <div className={"flex items-center gap-2 " + (isWinner ? "font-semibold" : "")}>
      <div className="flex -space-x-1.5 shrink-0">
        {roster.map((p) => (
          <Avatar key={p.profile_id} className="h-6 w-6 border-2 border-background">
            {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={displayName(p, { preferNicknames })} /> : null}
            <AvatarFallback className="text-[10px]">{initialsFrom(displayName(p, { preferNicknames }))}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="text-muted-foreground">{label}: </span>
          {names}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
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
            <span key={set.set_index} className={"min-w-[1.25rem] text-center text-sm tabular-nums " + cls}>
              {games}
              {tiebreak != null ? <sup className="text-[10px]">{tiebreak}</sup> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
