import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { initialsFrom } from "@/lib/initials";
import { displayName } from "@/lib/displayName";
import type { RosterMember } from "@/hooks/useClubRoster";

interface Props {
  candidates: RosterMember[];
  selectedIds: string[];
  onToggle: (profileId: string) => void;
  preferNicknames: boolean;
  disabledIds?: string[];
  placeholder?: string;
}

export function OpponentPicker({ candidates, selectedIds, onToggle, preferNicknames, disabledIds = [], placeholder }: Props) {
  return (
    <Command className="rounded-lg border">
      <CommandInput placeholder={placeholder ?? "Search players…"} />
      <CommandList>
        <CommandEmpty>No matching player.</CommandEmpty>
        <CommandGroup>
          {candidates.map((member) => {
            const name = displayName(member, { preferNicknames });
            const disabled = disabledIds.includes(member.profile_id);
            const selected = selectedIds.includes(member.profile_id);
            return (
              <CommandItem
                key={member.profile_id}
                value={`${name} ${member.full_name} ${member.profile_id}`}
                disabled={disabled}
                onSelect={() => !disabled && onToggle(member.profile_id)}
                className="flex items-center gap-3"
              >
                <Avatar className="h-8 w-8">
                  {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name} /> : null}
                  <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{name}</p>
                  {member.rating != null ? <p className="text-xs text-muted-foreground">Rating {member.rating.toFixed(1)}</p> : null}
                </div>
                {selected ? <Badge>Selected</Badge> : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
