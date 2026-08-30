import { useMemo, useState } from "react";
import { Minus, Plus, Shuffle, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  generateRoundRobinSchedule,
  generateTeamsAndGroups,
  maxGroupCountFor,
} from "@/features/roundrobin/logic/generateBracket";
import type { GeneratedTeam, RoundRobinPoints } from "@/features/roundrobin/types";

const POINT_OPTIONS: RoundRobinPoints[] = [16, 24, 32];

interface Preview {
  teams: GeneratedTeam[];
  seed: number;
}

interface SetupPanelProps {
  onCreate: (input: {
    name: string;
    playerNames: string[];
    teams: GeneratedTeam[];
    pointsPerMatch: RoundRobinPoints;
    courtCount: number;
    groupCount: number;
  }) => void;
  isPending?: boolean;
}

export function SetupPanel({ onCreate, isPending }: SetupPanelProps) {
  const [name, setName] = useState("Round Robin");
  const [players, setPlayers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [points, setPoints] = useState<RoundRobinPoints>(24);
  const [courts, setCourts] = useState(1);
  const [groups, setGroups] = useState(1);
  const [preview, setPreview] = useState<Preview | null>(null);

  const cleaned = useMemo(() => players.map((p) => p.trim()).filter(Boolean), [players]);
  const evenCount = cleaned.length % 2 === 0;
  const teamCount = Math.floor(cleaned.length / 2);
  const maxGroups = maxGroupCountFor(Math.max(teamCount, 2));
  const effectiveGroups = Math.max(1, Math.min(groups, maxGroups));
  const eligible = cleaned.length >= 8 && evenCount;

  function addPlayer() {
    const value = draft.trim();
    if (!value) return;
    if (players.some((p) => p.toLowerCase() === value.toLowerCase())) {
      toast.error("That player is already on the list");
      return;
    }
    setPlayers((prev) => [...prev, value]);
    setDraft("");
    setPreview(null);
  }

  function updatePlayer(index: number, value: string) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
    setPreview(null);
  }

  function removePlayer(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
    setPreview(null);
  }

  function generatePreview() {
    if (!eligible) {
      toast.error(cleaned.length < 8 ? "Add at least 8 players (4 teams)" : "Player count must be even");
      return;
    }
    if (new Set(cleaned.map((p) => p.toLowerCase())).size !== cleaned.length) {
      toast.error("Player names must be unique");
      return;
    }
    const teams = generateTeamsAndGroups(cleaned, effectiveGroups);
    setPreview({ teams, seed: (preview?.seed ?? 0) + 1 });
  }

  function submit() {
    if (!preview) {
      generatePreview();
      toast.info("Preview generated — review teams then tap Create tournament");
      return;
    }
    onCreate({
      name,
      playerNames: cleaned,
      teams: preview.teams,
      pointsPerMatch: points,
      courtCount: courts,
      groupCount: effectiveGroups,
    });
  }

  const previewMatches = useMemo(
    () => (preview ? generateRoundRobinSchedule(preview.teams, courts) : []),
    [preview, courts],
  );

  const groupBreakdown = useMemo(() => {
    if (!preview) return [] as { group: number; teams: GeneratedTeam[] }[];
    const map = new Map<number, GeneratedTeam[]>();
    preview.teams.forEach((t) => {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([group, teams]) => ({ group, teams }));
  }, [preview]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Players</h3>
          <Badge variant="outline">{players.length}</Badge>
          {teamCount ? <Badge variant="outline">{teamCount} teams</Badge> : null}
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
              Add at least 8 players — they'll be randomly paired into fixed doubles teams.
            </li>
          ) : null}
        </ul>

        {preview ? (
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview</h4>
              <Button size="sm" variant="ghost" onClick={generatePreview}>
                <Shuffle className="mr-2 h-3 w-3" />Reshuffle
              </Button>
            </div>
            {groupBreakdown.map(({ group, teams }) => (
              <div key={group} className="rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Group {String.fromCharCode(64 + group)}</p>
                <ul className="mt-2 grid gap-1 text-sm">
                  {teams.map((team) => (
                    <li key={`${team.players[0]}-${team.players[1]}`}>
                      <span className="font-medium">{team.players[0]}</span> & <span className="font-medium">{team.players[1]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 self-start rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="grid gap-2">
          <Label htmlFor="rr-name">Tournament name</Label>
          <Input id="rr-name" value={name} onChange={(event) => setName(event.target.value)} />
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
          <Label>Groups</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setGroups((g) => Math.max(1, g - 1))} aria-label="Fewer groups" disabled={effectiveGroups <= 1}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-10 text-center text-lg font-semibold tabular-nums">{effectiveGroups}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setGroups((g) => Math.min(maxGroups, g + 1))}
              aria-label="More groups"
              disabled={effectiveGroups >= maxGroups}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {teamCount >= 2 ? `max ${maxGroups} for ${teamCount} teams` : "add teams to configure groups"}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Available courts</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setCourts((c) => Math.max(1, c - 1))} aria-label="Fewer courts" disabled={courts <= 1}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-10 text-center text-lg font-semibold tabular-nums">{courts}</span>
            <Button variant="outline" size="icon" onClick={() => setCourts((c) => Math.min(12, c + 1))} aria-label="More courts" disabled={courts >= 12}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
          {preview ? (
            <>
              <span className="font-semibold text-foreground">{preview.teams.length} teams</span> · {previewMatches.length} group-stage matches ·
              top 4 advance to semis
            </>
          ) : eligible ? (
            "Tap Generate to preview random pairings — you can reshuffle before creating."
          ) : (
            cleaned.length < 8
              ? `Add ${8 - cleaned.length} more player${8 - cleaned.length === 1 ? "" : "s"} to reach 4 teams.`
              : "Player count must be even so everyone has a partner."
          )}
        </div>

        <div className="flex gap-2">
          {preview ? (
            <Button variant="outline" onClick={generatePreview} disabled={isPending || !eligible}>
              <Shuffle className="mr-2 h-4 w-4" />Reshuffle
            </Button>
          ) : (
            <Button variant="outline" onClick={generatePreview} disabled={isPending || !eligible}>
              <Sparkles className="mr-2 h-4 w-4" />Preview pairings
            </Button>
          )}
          <Button className="flex-1" onClick={submit} disabled={isPending || !eligible || !preview}>
            <Sparkles className="mr-2 h-4 w-4" />Create tournament
          </Button>
        </div>
      </section>
    </div>
  );
}
