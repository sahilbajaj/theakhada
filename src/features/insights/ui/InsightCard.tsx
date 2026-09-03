import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import type { InsightPlayer } from "@/features/insights/types";

export interface InsightCardBody {
  roster: InsightPlayer[]; // avatars to show; empty for text-only cards
  primary: string;         // main heading (usually player name or "A & B")
  secondary: string;       // supporting line (headline / stat)
  aside: string;           // badge text
}

export interface InsightCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  empty: string;
  body: InsightCardBody | null;
  preferNicknames: boolean;
}

export function nameOfPlayer(player: InsightPlayer, preferNicknames: boolean) {
  return displayName({ full_name: player.full_name, nickname: player.nickname }, { preferNicknames });
}

export function InsightCard({ icon: Icon, title, subtitle, empty, body, preferNicknames }: InsightCardProps) {
  return (
    <article className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </header>
      {body ? (
        <div className="flex items-center gap-3">
          {body.roster.length > 0 ? (
            <div className="flex shrink-0 -space-x-2">
              {body.roster.map((p) => (
                <Avatar key={p.profile_id} className="h-11 w-11 border-2 border-card">
                  {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={nameOfPlayer(p, preferNicknames)} /> : null}
                  <AvatarFallback>{initialsFrom(nameOfPlayer(p, preferNicknames))}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{body.primary}</p>
            <p className="truncate text-sm text-muted-foreground">{body.secondary}</p>
            <Badge variant="outline" className="mt-1">{body.aside}</Badge>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </article>
  );
}
