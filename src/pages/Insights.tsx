import { Award, CalendarCheck2, Flame, HeartHandshake, Sparkles, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubInsights } from "@/features/insights/data/useClubInsights";
import { useClubSettings } from "@/hooks/useClubSettings";
import { displayName } from "@/lib/displayName";
import { initialsFrom } from "@/lib/initials";
import type { InsightPlayer } from "@/features/insights/types";

export default function Insights() {
  const { data, isLoading } = useClubInsights();
  const { preferNicknames } = useClubSettings();

  function nameOf(player: InsightPlayer) {
    return displayName(
      { full_name: player.full_name, nickname: player.nickname },
      { preferNicknames },
    );
  }

  const cards = [
    {
      key: "week",
      icon: Trophy,
      title: "Player of the week",
      subtitle: "Best win rate over the last 7 days",
      empty: "Play 3+ matches this week to qualify.",
      body: data?.player_of_week
        ? {
            player: data.player_of_week.player,
            headline: `${data.player_of_week.wins} / ${data.player_of_week.matches} wins`,
            aside: `${Math.round((data.player_of_week.wins / Math.max(data.player_of_week.matches, 1)) * 100)}% win rate`,
          }
        : null,
    },
    {
      key: "month",
      icon: Award,
      title: "Player of the month",
      subtitle: "Best win rate over the last 30 days",
      empty: "Play 3+ matches this month to qualify.",
      body: data?.player_of_month
        ? {
            player: data.player_of_month.player,
            headline: `${data.player_of_month.wins} / ${data.player_of_month.matches} wins`,
            aside: `${Math.round((data.player_of_month.wins / Math.max(data.player_of_month.matches, 1)) * 100)}% win rate`,
          }
        : null,
    },
    {
      key: "consistent",
      icon: Sparkles,
      title: "Most consistent",
      subtitle: "Highest share of wins in straight sets",
      empty: "Needs 3+ wins to qualify.",
      body: data?.most_consistent
        ? {
            player: data.most_consistent.player,
            headline: `${data.most_consistent.straight_wins} / ${data.most_consistent.wins} clean wins`,
            aside: `${Math.round((data.most_consistent.straight_wins / Math.max(data.most_consistent.wins, 1)) * 100)}% straight-set`,
          }
        : null,
    },
    {
      key: "dedicated",
      icon: CalendarCheck2,
      title: "Most dedicated",
      subtitle: "Most matches played this month",
      empty: "No matches played this month yet.",
      body: data?.most_dedicated
        ? {
            player: data.most_dedicated.player,
            headline: `${data.most_dedicated.matches} match${data.most_dedicated.matches === 1 ? "" : "es"}`,
            aside: "last 30 days",
          }
        : null,
    },
    {
      key: "streak",
      icon: Flame,
      title: "Longest win streak",
      subtitle: "Consecutive wins, still active",
      empty: "No active streak of 2+ wins.",
      body: data?.longest_streak
        ? {
            player: data.longest_streak.player,
            headline: `${data.longest_streak.streak} in a row`,
            aside: "and counting",
          }
        : null,
    },
    {
      key: "partner",
      icon: HeartHandshake,
      title: "Best partner duo",
      subtitle: "Most doubles wins together",
      empty: "Play 2+ doubles matches with the same partner.",
      body: data?.best_partner
        ? {
            player: null,
            headline: `${nameOf(data.best_partner.player_a)} & ${nameOf(data.best_partner.player_b)}`,
            aside: `${data.best_partner.wins} wins in ${data.best_partner.matches} matches`,
          }
        : null,
    },
  ] as const;

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Club insights</h1>
            <p className="text-sm text-muted-foreground">
              Highlights from finalized matches. Rolls forward as new scores come in.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.key} className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
                  <header className="mb-3 flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">{card.title}</h2>
                      <p className="truncate text-xs text-muted-foreground">{card.subtitle}</p>
                    </div>
                  </header>
                  {card.body ? (
                    <div className="flex items-center gap-3">
                      {card.body.player ? (
                        <Avatar className="h-11 w-11 shrink-0">
                          {card.body.player.avatar_url ? (
                            <AvatarImage src={card.body.player.avatar_url} alt={nameOf(card.body.player)} />
                          ) : null}
                          <AvatarFallback>{initialsFrom(nameOf(card.body.player))}</AvatarFallback>
                        </Avatar>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">
                          {card.body.player ? nameOf(card.body.player) : card.body.headline}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {card.body.player ? card.body.headline : card.body.aside}
                        </p>
                        {card.body.player ? (
                          <Badge variant="outline" className="mt-1">{card.body.aside}</Badge>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{card.empty}</p>
                  )}
                </article>
              );
            })}
      </section>
    </div>
  );
}
