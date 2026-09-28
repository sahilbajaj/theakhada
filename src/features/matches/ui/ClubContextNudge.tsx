import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, ChevronRight, Compass, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { RequestClubModal } from "@/features/clubs/ui/RequestClubModal";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "card" | "chip";
  onBeforeNavigate?: () => void;
}

export function ClubContextNudge({ variant = "card", onBeforeNavigate }: Props) {
  const { memberships, currentClubId, setCurrentClubId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const currentName =
    memberships.find((m) => m.clubId === currentClubId)?.clubName?.trim() || "your club";
  const canSwitch = memberships.length > 1;

  function switchTo(nextId: string) {
    if (nextId !== currentClubId) {
      setCurrentClubId(nextId);
      void queryClient.invalidateQueries();
    }
    setPopoverOpen(false);
  }

  function goJoin() {
    setPopoverOpen(false);
    onBeforeNavigate?.();
    navigate("/join-clubs");
  }

  function openRequest() {
    setPopoverOpen(false);
    setRequestOpen(true);
  }

  const menu = (
    <PopoverContent align={variant === "chip" ? "start" : "end"} className="w-64 p-1">
      {canSwitch ? (
        <div className="grid gap-0.5">
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Switch club
          </p>
          {memberships.map((m) => (
            <button
              key={m.clubId}
              type="button"
              onClick={() => switchTo(m.clubId)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                m.clubId === currentClubId && "bg-muted/60",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{m.clubName || "Unnamed club"}</span>
              {m.clubId === currentClubId ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={goJoin}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
      >
        <Compass className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Explore & join clubs</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={openRequest}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Request a new club</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </PopoverContent>
  );

  if (variant === "chip") {
    return (
      <>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-muted"
            >
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="min-w-0 truncate">{currentName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          {menu}
        </Popover>
        <RequestClubModal open={requestOpen} onOpenChange={setRequestOpen} />
      </>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="flex items-start gap-2">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate">
            Playing in <span className="font-medium">{currentName}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Make sure all players below are in this club.
          </p>
        </div>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Not your club?
            </button>
          </PopoverTrigger>
          {menu}
        </Popover>
      </div>
      <RequestClubModal open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
}
