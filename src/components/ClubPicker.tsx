import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ClubPickerProps {
  className?: string;
}

export function ClubPicker({ className }: ClubPickerProps) {
  const { memberships, currentClubId, setCurrentClubId } = useAuth();
  const queryClient = useQueryClient();

  if (memberships.length <= 1) return null;

  return (
    <Select
      value={currentClubId ?? undefined}
      onValueChange={(nextId) => {
        if (nextId === currentClubId) return;
        setCurrentClubId(nextId);
        void queryClient.invalidateQueries();
      }}
    >
      <SelectTrigger className={cn("h-9 max-w-[220px] gap-2", className)} aria-label="Switch club">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Pick a club" />
      </SelectTrigger>
      <SelectContent>
        {memberships.map((m) => (
          <SelectItem key={m.clubId} value={m.clubId}>
            {m.clubName || "Unnamed club"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
