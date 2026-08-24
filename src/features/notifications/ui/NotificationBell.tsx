import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useClubSettings } from "@/hooks/useClubSettings";
import { initialsFrom } from "@/lib/initials";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { ScoreEntry } from "@/features/matches/ui/ScoreEntry";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/features/notifications/data/useNotifications";
import { actorName, summaryFor } from "@/features/notifications/logic/format";
import { NotificationFeed } from "@/features/notifications/ui/NotificationFeed";
import type { NotificationItem } from "@/features/notifications/types";

const MAX_DROPDOWN = 5;

export function NotificationBell() {
  const { profile } = useAuth();
  const { preferNicknames } = useClubSettings();
  const notificationsQuery = useNotifications(30);
  const unreadQuery = useUnreadCount();
  const matchesQuery = useRecentMatches(50);
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const [open, setOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartId, setFeedStartId] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  const unread = unreadQuery.data ?? 0;
  const items = notificationsQuery.data ?? [];
  const dropdownItems = items.slice(0, MAX_DROPDOWN);
  const matchesById = useMemo(
    () => new Map((matchesQuery.data ?? []).map((m) => [m.match_id, m])),
    [matchesQuery.data],
  );

  const openFeedAt = (item: NotificationItem) => {
    setOpen(false);
    setFeedStartId(item.id);
    setFeedOpen(true);
  };

  const openMatchFor = (item: NotificationItem) => {
    if (!item.match_id) return;
    setOpen(false);
    setFeedOpen(false);
    setMatchId(item.match_id);
    setMatchOpen(true);
    if (!item.read_at) markOne.mutate(item.id);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Notifications" className="relative">
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <Badge className="pointer-events-none absolute -right-1 -top-1 h-4 min-w-[1rem] px-1 text-[10px] leading-none">
                {unread > 9 ? "9+" : unread}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between px-3 py-2">
            <DropdownMenuLabel className="p-0 text-xs uppercase tracking-wide text-muted-foreground">
              Recent activity
            </DropdownMenuLabel>
            {unread > 0 ? (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                Mark all read
              </Button>
            ) : null}
          </div>
          <DropdownMenuSeparator className="m-0" />
          {dropdownItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {notificationsQuery.isLoading ? "Loading…" : "Nothing yet."}
            </div>
          ) : (
            <div className="grid gap-0">
              {dropdownItems.map((item) => {
                const match = item.match_id ? matchesById.get(item.match_id) : undefined;
                const summary = summaryFor(item, match, profile?.id ?? null, { preferNicknames });
                const isUnread = !item.read_at;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openMatchFor(item)}
                    className={
                      "flex items-start gap-3 px-3 py-2 text-left transition hover:bg-accent " +
                      (isUnread ? "bg-primary/5" : "")
                    }
                  >
                    <Avatar className="h-8 w-8">
                      {item.actor_avatar_url ? <AvatarImage src={item.actor_avatar_url} alt={actorName(item, { preferNicknames })} /> : null}
                      <AvatarFallback>{initialsFrom(actorName(item, { preferNicknames }))}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{summary}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {isUnread ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          )}
          <DropdownMenuSeparator className="m-0" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setFeedStartId(items[0]?.id ?? null);
              setFeedOpen(true);
            }}
            className="w-full px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
            disabled={items.length === 0}
          >
            See all
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationFeed
        open={feedOpen}
        onOpenChange={setFeedOpen}
        items={items}
        matchesById={matchesById}
        startId={feedStartId}
        onOpenMatch={openMatchFor}
        onMarkRead={(id) => markOne.mutate(id)}
      />

      <ScoreEntry open={matchOpen} onOpenChange={setMatchOpen} matchId={matchId} />
    </>
  );
}
