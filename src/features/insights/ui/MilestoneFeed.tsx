import { Award, Handshake, Medal, Sparkles, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { nameOfPlayer } from "@/features/insights/ui/InsightCard";
import { initialsFrom } from "@/lib/initials";
import type { MilestoneItem, MilestoneKind } from "@/features/insights/types";

function milestoneCopy(item: MilestoneItem) {
  switch (item.kind) {
    case "nth_match":
      return { icon: Medal, label: `Played their ${ordinal(item.value)} match` };
    case "first_win":
      return { icon: Trophy, label: "First win at the club" };
    case "first_straight_win":
      return { icon: Sparkles, label: "First straight-set win" };
    case "first_doubles_win":
      return { icon: Handshake, label: "First doubles win" };
    default:
      return { icon: Award, label: "Milestone" };
  }
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "a week ago";
  return `${weeks} weeks ago`;
}

export function MilestoneFeed({ items, preferNicknames }: { items: MilestoneItem[]; preferNicknames: boolean }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
        No milestones in the last 30 days.
      </div>
    );
  }
  return (
    <ul className="grid gap-2">
      {items.map((item, idx) => {
        const { icon: Icon, label } = milestoneCopy(item);
        const name = nameOfPlayer(item.player, preferNicknames);
        return (
          <li
            key={`${item.match_id}-${item.kind}-${item.player.profile_id}-${idx}`}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card"
          >
            <Avatar className="h-10 w-10 shrink-0">
              {item.player.avatar_url ? <AvatarImage src={item.player.avatar_url} alt={name} /> : null}
              <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{label}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span>{timeAgo(item.at)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type { MilestoneKind };
