import { useEffect, useMemo, useState } from "react";
import { UsersRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useClubRoster, type RosterMember } from "@/hooks/useClubRoster";
import { useClubSettings } from "@/hooks/useClubSettings";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names already on the setup list (used to disable duplicates). */
  existingNames: string[];
  onConfirm: (names: string[]) => void;
}

export function RosterPickerSheet({ open, onOpenChange, existingNames, onConfirm }: Props) {
  const rosterQuery = useClubRoster();
  const { preferNicknames } = useClubSettings();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(new Set());
    }
  }, [open]);

  const existingSet = useMemo(
    () => new Set(existingNames.map((n) => n.trim().toLowerCase())),
    [existingNames],
  );

  const filtered = useMemo(() => {
    const roster = rosterQuery.data ?? [];
    const q = query.trim().toLowerCase();
    return roster.filter((m) => {
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.nickname ? m.nickname.toLowerCase().includes(q) : false)
      );
    });
  }, [rosterQuery.data, query]);

  function nameFor(member: RosterMember) {
    return displayName(
      { full_name: member.full_name, nickname: member.nickname },
      { preferNicknames },
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const roster = rosterQuery.data ?? [];
    const names = roster.filter((m) => selected.has(m.profile_id)).map(nameFor);
    onConfirm(names);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UsersRound className="h-4 w-4" />Add from club
          </SheetTitle>
        </SheetHeader>
        <Input
          placeholder="Search members"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="-mx-2 flex-1 overflow-y-auto">
          {filtered.map((member) => {
            const name = nameFor(member);
            const already = existingSet.has(name.trim().toLowerCase());
            const isSelected = selected.has(member.profile_id);
            return (
              <li key={member.profile_id}>
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                  aria-disabled={already}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={already}
                    onCheckedChange={() => !already && toggle(member.profile_id)}
                  />
                  <Avatar className="h-8 w-8">
                    {member.avatar_url ? <AvatarImage src={member.avatar_url} alt={name} /> : null}
                    <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    {member.rating != null ? (
                      <p className="text-xs text-muted-foreground">Rating {member.rating.toFixed(1)}</p>
                    ) : null}
                  </div>
                  {already ? <span className="text-xs text-muted-foreground">Added</span> : null}
                </label>
              </li>
            );
          })}
          {rosterQuery.isLoading ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">Loading members…</li>
          ) : null}
          {!rosterQuery.isLoading && !filtered.length ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">No members match.</li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={confirm} disabled={!selected.size}>
              Add {selected.size ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
