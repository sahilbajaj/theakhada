import { UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import type { RosterMember } from "@/hooks/useClubRoster";

interface Props {
  member?: RosterMember;
  preferNicknames: boolean;
  onPick?: () => void;
  onClear?: () => void;
  locked?: boolean;
  label?: string;
}

export function PlayerSlot({ member, preferNicknames, onPick, onClear, locked, label }: Props) {
  if (member) {
    const name = displayName(member, { preferNicknames });
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
        <Avatar>
          {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name} /> : null}
          <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          {member.rating != null ? <p className="text-xs text-muted-foreground">Rating {member.rating.toFixed(1)}</p> : null}
        </div>
        {!locked && onClear ? (
          <Button size="icon" variant="ghost" onClick={onClear} aria-label="Remove player">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center gap-3 rounded-lg border border-dashed bg-card/50 p-3 text-left text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
    >
      <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed">
        <UserPlus className="h-4 w-4" />
      </div>
      <span className="font-medium">{label ?? "Pick player"}</span>
    </button>
  );
}
