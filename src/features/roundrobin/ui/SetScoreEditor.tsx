import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { RoundRobinFormat, SetScore } from "@/features/roundrobin/types";
import { validateSetMatch } from "@/features/roundrobin/logic/setScoring";

type Draft = { a: string; b: string };

interface SetScoreEditorProps {
  format: Exclude<RoundRobinFormat, "points">;
  teamALabel: string;
  teamBLabel: string;
  initialSets: SetScore[] | null;
  disabled?: boolean;
  onSubmit: (sets: SetScore[]) => void;
  isPending?: boolean;
}

function toDraft(sets: SetScore[] | null, maxSets: number): Draft[] {
  const seeded = (sets ?? []).map((s) => ({ a: String(s.a), b: String(s.b) }));
  while (seeded.length < Math.min(maxSets, seeded.length + 1)) seeded.push({ a: "", b: "" });
  if (seeded.length === 0) seeded.push({ a: "", b: "" });
  return seeded.slice(0, maxSets);
}

function parseSets(drafts: Draft[]): { parsed: SetScore[]; filledCount: number } {
  const parsed: SetScore[] = [];
  let filledCount = 0;
  for (const d of drafts) {
    if (d.a === "" && d.b === "") continue;
    filledCount += 1;
    parsed.push({ a: Number(d.a), b: Number(d.b) });
  }
  return { parsed, filledCount };
}

export function SetScoreEditor({ format, teamALabel, teamBLabel, initialSets, disabled, onSubmit, isPending }: SetScoreEditorProps) {
  const maxSets = format === "set" ? 1 : 3;
  const [drafts, setDrafts] = useState<Draft[]>(() => toDraft(initialSets, maxSets));

  const parsedInfo = useMemo(() => parseSets(drafts), [drafts]);
  const validation = useMemo(
    () => validateSetMatch(format, parsedInfo.parsed),
    [format, parsedInfo.parsed],
  );

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const next = prev.map((d, i) => (i === index ? { ...d, ...patch } : d));
      // Grow: if this row is the last one, has any value, and we can add more sets.
      const last = next[next.length - 1];
      if ((last.a !== "" || last.b !== "") && next.length < maxSets) {
        next.push({ a: "", b: "" });
      }
      return next;
    });
  }

  function submit() {
    if (!validation.ok) {
      toast.error(validation.reason ?? "Fix set scores");
      return;
    }
    onSubmit(parsedInfo.parsed);
  }

  const mtbIndex = format === "bo3_mtb" ? 2 : -1;

  return (
    <div className="grid gap-2">
      <div className="grid gap-1.5">
        {drafts.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {i === mtbIndex ? "MTB" : `Set ${i + 1}`}
            </span>
            <Input
              inputMode="numeric"
              className="h-10 w-14 text-center text-base font-semibold tabular-nums"
              value={d.a}
              disabled={disabled}
              onChange={(e) => update(i, { a: e.target.value.replace(/[^0-9]/g, "") })}
              aria-label={`Set ${i + 1} ${teamALabel} score`}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              inputMode="numeric"
              className="h-10 w-14 text-center text-base font-semibold tabular-nums"
              value={d.b}
              disabled={disabled}
              onChange={(e) => update(i, { b: e.target.value.replace(/[^0-9]/g, "") })}
              aria-label={`Set ${i + 1} ${teamBLabel} score`}
            />
          </div>
        ))}
      </div>
      {!disabled ? (
        <>
          <p className={cn("text-xs", parsedInfo.filledCount > 0 && !validation.ok ? "text-destructive" : "text-muted-foreground")}>
            {parsedInfo.filledCount === 0
              ? format === "set"
                ? "Enter the set score (to 6, TB at 6-6)"
                : format === "bo3"
                  ? "Enter each set to 6 · win by 2 · TB at 6-6"
                  : "Sets 1-2 to 6 · 3rd set is a 10-pt match tiebreak"
              : validation.ok
                ? `Sets ${validation.setsA}–${validation.setsB} · ready to save`
                : validation.reason}
          </p>
          <Button className="w-full" onClick={submit} disabled={isPending || !validation.ok}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Submit Score
          </Button>
        </>
      ) : null}
    </div>
  );
}
