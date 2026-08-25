import { forwardRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import type { RosterMember } from "@/hooks/useClubRoster";

interface Props {
  member: RosterMember;
  currentSeed: number;
  suggestedSeed?: number;
  preferNicknames: boolean;
  editable: boolean;
}

export const SeedingRow = forwardRef<HTMLDivElement, Props>(function SeedingRow(
  { member, currentSeed, suggestedSeed, preferNicknames, editable },
  _ref,
) {
  const sortable = useSortable({ id: member.profile_id, disabled: !editable });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const name = displayName(member, { preferNicknames });
  const suggestionDiffers = editable && suggestedSeed != null && suggestedSeed !== currentSeed;

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={
        "flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-card " +
        (sortable.isDragging ? "opacity-70 ring-2 ring-primary/40" : "")
      }
    >
      {editable ? (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          className="grid h-9 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <Badge className="w-9 shrink-0 justify-center tabular-nums">#{currentSeed}</Badge>
      <Avatar className="h-9 w-9 shrink-0">
        {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name} /> : null}
        <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          Rating {member.rating != null ? member.rating.toFixed(1) : "—"}
          {suggestionDiffers ? ` · suggested #${suggestedSeed}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {suggestionDiffers ? (
          <Badge variant="secondary" className="text-[10px]">
            was #{member.seed ?? "—"}
          </Badge>
        ) : null}
        <Badge variant="outline" className="hidden w-14 justify-center tabular-nums sm:inline-flex">
          {member.rating != null ? member.rating.toFixed(1) : "—"}
        </Badge>
      </div>
    </div>
  );
});
