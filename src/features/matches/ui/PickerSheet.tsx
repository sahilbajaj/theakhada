import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import type { RosterMember } from "@/hooks/useClubRoster";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: RosterMember[];
  disabledIds?: string[];
  recentIds?: string[];
  preferNicknames: boolean;
  title?: string;
  onPick: (profileId: string) => void;
}

export function PickerSheet({ open, onOpenChange, candidates, disabledIds = [], recentIds = [], preferNicknames, title, onPick }: Props) {
  const [query, setQuery] = useState("");

  const recentChips = useMemo(() => {
    const disabled = new Set(disabledIds);
    return recentIds
      .map((id) => candidates.find((c) => c.profile_id === id))
      .filter((m): m is RosterMember => Boolean(m && !disabled.has(m.profile_id)))
      .slice(0, 6);
  }, [recentIds, candidates, disabledIds]);

  function handlePick(id: string) {
    onPick(id);
    setQuery("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] gap-3 p-0 sm:max-w-md">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{title ?? "Pick player"}</DialogTitle>
        </DialogHeader>

        {recentChips.length ? (
          <div className="flex flex-wrap gap-2 px-4">
            {recentChips.map((member) => {
              const name = displayName(member, { preferNicknames });
              return (
                <button
                  key={member.profile_id}
                  type="button"
                  onClick={() => handlePick(member.profile_id)}
                  className="flex items-center gap-2 rounded-full border bg-card px-2 py-1 text-sm shadow-sm transition hover:border-primary/50"
                >
                  <Avatar className="h-6 w-6">
                    {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name} /> : null}
                    <AvatarFallback className="text-[10px]">{initialsFrom(name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <Command shouldFilter className="border-t">
          <CommandInput placeholder="Search players…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[50dvh]">
            <CommandEmpty>No matching player.</CommandEmpty>
            <CommandGroup>
              {candidates.map((member) => {
                const name = displayName(member, { preferNicknames });
                const disabled = disabledIds.includes(member.profile_id);
                return (
                  <CommandItem
                    key={member.profile_id}
                    value={`${name} ${member.full_name} ${member.profile_id}`}
                    disabled={disabled}
                    onSelect={() => !disabled && handlePick(member.profile_id)}
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
                    {disabled ? <Badge variant="outline">Already picked</Badge> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
