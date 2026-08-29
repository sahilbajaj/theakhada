import { useMemo } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/features/matches/ui/MatchCard";
import type { MatchListItem } from "@/features/matches/types";

interface Props {
  matches: MatchListItem[];
  preferNicknames: boolean;
  onOpen?: (matchId: string) => void;
  onReviewMatch: (matchId: string) => void;
  onReviewDay: (day: string) => void;
  isPending?: boolean;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const todayKey = dayKey(today.toISOString());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === todayKey) return "Today";
  if (key === dayKey(yesterday.toISOString())) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function ReviewQueue({ matches, preferNicknames, onOpen, onReviewMatch, onReviewDay, isPending }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, MatchListItem[]>();
    for (const match of matches) {
      const key = dayKey(match.starts_at);
      const list = map.get(key);
      if (list) list.push(match);
      else map.set(key, [match]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [matches]);

  if (!groups.length) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground shadow-card">
        Nothing to review. Finalized matches will show up here.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {groups.map(([key, dayMatches]) => (
        <section key={key} className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {dayLabel(key)} <span className="text-muted-foreground">· {dayMatches.length} to review</span>
            </h3>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => onReviewDay(key)}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Review all ({dayMatches.length})
            </Button>
          </div>
          {dayMatches.map((match) => (
            <div key={match.match_id} className="grid gap-2">
              <MatchCard match={match} preferNicknames={preferNicknames} onOpen={onOpen} showReviewState />
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" disabled={isPending} onClick={() => onReviewMatch(match.match_id)}>
                  Mark reviewed
                </Button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
