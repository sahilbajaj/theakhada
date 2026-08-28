import { useMemo, useState } from "react";
import { Minus, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { generateAmericanoRounds, maxCourtsFor, roundsFor } from "@/features/americano/logic/generateRounds";
import type { AmericanoPoints } from "@/features/americano/types";

const POINT_OPTIONS: AmericanoPoints[] = [16, 24, 32];

interface SetupPanelProps {
  onCreate: (input: {
    name: string;
    playerNames: string[];
    pointsPerMatch: AmericanoPoints;
    courtCount: number;
  }) => void;
  isPending?: boolean;
}

export function SetupPanel({ onCreate, isPending }: SetupPanelProps) {
  const [name, setName] = useState("Americano Night");
  const [players, setPlayers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [points, setPoints] = useState<AmericanoPoints>(24);
  const [courts, setCourts] = useState<number | null>(null);

  const maxCourts = maxCourtsFor(Math.max(players.length, 4));
  const effectiveCourts = courts == null ? maxCourts : Math.min(Math.max(1, courts), maxCourts);
  const playersNeededForMore = players.length < 8 ? 8 - Math.max(players.length, 4) : 0;
  const preview = useMemo(
    () => (players.length >= 4 ? generateAmericanoRounds(players.length, effectiveCourts) : []),
    [players.length, effectiveCourts],
  );
  const rounds = players.length >= 4 ? roundsFor(players.length) : 0;

  function addPlayer() {
    const value = draft.trim();
    if (!value) return;
    if (players.some((p) => p.toLowerCase() === value.toLowerCase())) {
      toast.error("That player is already on the list");
      return;
    }
    setPlayers((prev) => [...prev, value]);
    setDraft("");
  }

  function updatePlayer(index: number, value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function removePlayer(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    const cleaned = players.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length < 4) {
      toast.error("Add at least 4 players");
      return;
    }
    if (new Set(cleaned.map((p) => p.toLowerCase())).size !== cleaned.length) {
      toast.error("Player names must be unique");
      return;
    }
    onCreate({ name, playerNames: cleaned, pointsPerMatch: points, courtCount: effectiveCourts });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Players</h3>
          <Badge variant="outline">{players.length}</Badge>
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addPlayer();
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a player name"
            aria-label="Player name"
          />
          <Button type="submit" variant="secondary">
            <Plus className="mr-1 h-4 w-4" />Add
          </Button>
        </form>

        <ul className="mt-3 grid gap-2">
          {players.map((player, index) => (
            <li key={`${player}-${index}`} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
              <Input value={player} onChange={(event) => updatePlayer(index, event.target.value)} aria-label={`Player ${index + 1}`} />
              <Button variant="ghost" size="icon" onClick={() => removePlayer(index)} aria-label={`Remove ${player}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
          {players.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
              No players yet — add at least four to build a rotation.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="grid gap-4 self-start rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="grid gap-2">
          <Label htmlFor="americano-name">Tournament name</Label>
          <Input id="americano-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label>Points per match</Label>
          <div className="flex gap-2">
            {POINT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPoints(option)}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
                  points === option
                    ? "border-primary bg-primary text-primary-foreground shadow-glow-primary"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Available courts</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setCourts(Math.max(1, effectiveCourts - 1))} aria-label="Fewer courts" disabled={effectiveCourts <= 1}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-10 text-center text-lg font-semibold tabular-nums">{effectiveCourts}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCourts(Math.min(maxCourts, effectiveCourts + 1))}
              aria-label="More courts"
              disabled={effectiveCourts >= maxCourts}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {playersNeededForMore > 0
                ? `add ${playersNeededForMore} more player${playersNeededForMore === 1 ? "" : "s"} for another court`
                : `max ${maxCourts} for ${players.length} players`}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
          {players.length >= 4 ? (
            <>
              <span className="font-semibold text-foreground">{rounds} rounds</span> · {preview.length} matches ·{" "}
              partners rotate every round
            </>
          ) : (
            "Add players to preview the rotation."
          )}
        </div>

        <Button onClick={submit} disabled={isPending || players.length < 4}>
          <Sparkles className="mr-2 h-4 w-4" />Generate Tournament
        </Button>
      </section>
    </div>
  );
}
