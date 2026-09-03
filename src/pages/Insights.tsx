import { useState, type ReactNode } from "react";
import {
  Award,
  CalendarCheck2,
  Coffee,
  Flame,
  HeartHandshake,
  Medal,
  Moon,
  Rocket,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Undo2,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClubInsights } from "@/features/insights/data/useClubInsights";
import {
  useFormInsights,
  useMilestonesInsights,
  useParticipationInsights,
  useRivalryInsights,
  useStyleInsights,
} from "@/features/insights/data/useInsightSections";
import { useClubSettings } from "@/hooks/useClubSettings";
import { InsightCard, nameOfPlayer, type InsightCardBody } from "@/features/insights/ui/InsightCard";
import { MilestoneFeed } from "@/features/insights/ui/MilestoneFeed";

type TabKey = "highlights" | "rivalry" | "form" | "style" | "participation" | "milestones";

const pct = (n: number, d: number) => `${Math.round((n / Math.max(d, 1)) * 100)}%`;

export default function Insights() {
  const [tab, setTab] = useState<TabKey>("highlights");
  const { preferNicknames } = useClubSettings();

  const highlights = useClubInsights();
  const rivalry = useRivalryInsights(tab === "rivalry");
  const form = useFormInsights(tab === "form");
  const style = useStyleInsights(tab === "style");
  const participation = useParticipationInsights(tab === "participation");
  const milestones = useMilestonesInsights(tab === "milestones");

  const nameOf = (p: Parameters<typeof nameOfPlayer>[0]) => nameOfPlayer(p, preferNicknames);

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

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="no-scrollbar flex w-full max-w-full justify-start gap-1 overflow-x-auto flex-nowrap">
          <TabsTrigger value="highlights">Highlights</TabsTrigger>
          <TabsTrigger value="rivalry">Rivalry</TabsTrigger>
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="participation">Participation</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
        </TabsList>

        {/* Highlights ------------------------------------------------- */}
        <TabsContent value="highlights" className="mt-3">
          <Grid loading={highlights.isLoading} count={6}>
            {(() => {
              const d = highlights.data;
              const cards: Array<Omit<Parameters<typeof InsightCard>[0], "preferNicknames">> = [
                {
                  icon: Trophy,
                  title: "Player of the week",
                  subtitle: "Best win rate over the last 7 days",
                  empty: "Play 3+ matches this week to qualify.",
                  body: d?.player_of_week
                    ? {
                        roster: [d.player_of_week.player],
                        primary: nameOf(d.player_of_week.player),
                        secondary: `${d.player_of_week.wins} / ${d.player_of_week.matches} wins`,
                        aside: `${pct(d.player_of_week.wins, d.player_of_week.matches)} win rate`,
                      }
                    : null,
                },
                {
                  icon: Award,
                  title: "Player of the month",
                  subtitle: "Best win rate over the last 30 days",
                  empty: "Play 3+ matches this month to qualify.",
                  body: d?.player_of_month
                    ? {
                        roster: [d.player_of_month.player],
                        primary: nameOf(d.player_of_month.player),
                        secondary: `${d.player_of_month.wins} / ${d.player_of_month.matches} wins`,
                        aside: `${pct(d.player_of_month.wins, d.player_of_month.matches)} win rate`,
                      }
                    : null,
                },
                {
                  icon: Sparkles,
                  title: "Most consistent",
                  subtitle: "Highest share of wins in straight sets",
                  empty: "Needs 3+ wins to qualify.",
                  body: d?.most_consistent
                    ? {
                        roster: [d.most_consistent.player],
                        primary: nameOf(d.most_consistent.player),
                        secondary: `${d.most_consistent.straight_wins} / ${d.most_consistent.wins} clean wins`,
                        aside: `${pct(d.most_consistent.straight_wins, d.most_consistent.wins)} straight-set`,
                      }
                    : null,
                },
                {
                  icon: CalendarCheck2,
                  title: "Most dedicated",
                  subtitle: "Most matches played this month",
                  empty: "No matches played this month yet.",
                  body: d?.most_dedicated
                    ? {
                        roster: [d.most_dedicated.player],
                        primary: nameOf(d.most_dedicated.player),
                        secondary: `${d.most_dedicated.matches} match${d.most_dedicated.matches === 1 ? "" : "es"}`,
                        aside: "last 30 days",
                      }
                    : null,
                },
                {
                  icon: Flame,
                  title: "Longest win streak",
                  subtitle: "Consecutive wins, still active",
                  empty: "No active streak of 2+ wins.",
                  body: d?.longest_streak
                    ? {
                        roster: [d.longest_streak.player],
                        primary: nameOf(d.longest_streak.player),
                        secondary: `${d.longest_streak.streak} in a row`,
                        aside: "and counting",
                      }
                    : null,
                },
                {
                  icon: HeartHandshake,
                  title: "Best partner duo",
                  subtitle: "Most doubles wins together",
                  empty: "Play 2+ doubles matches with the same partner.",
                  body: d?.best_partner
                    ? {
                        roster: [d.best_partner.player_a, d.best_partner.player_b],
                        primary: `${nameOf(d.best_partner.player_a)} & ${nameOf(d.best_partner.player_b)}`,
                        secondary: `${d.best_partner.wins} wins in ${d.best_partner.matches} matches`,
                        aside: `${pct(d.best_partner.wins, d.best_partner.matches)} together`,
                      }
                    : null,
                },
              ];
              return cards.map((c, i) => <InsightCard key={i} {...c} preferNicknames={preferNicknames} />);
            })()}
          </Grid>
        </TabsContent>

        {/* Rivalry & Social ------------------------------------------- */}
        <TabsContent value="rivalry" className="mt-3">
          <Grid loading={rivalry.isLoading} count={3}>
            {(() => {
              const d = rivalry.data;
              const rivalryBody: InsightCardBody | null = d?.fiercest_rivalry
                ? {
                    roster: [d.fiercest_rivalry.player_a, d.fiercest_rivalry.player_b],
                    primary: `${nameOf(d.fiercest_rivalry.player_a)} vs ${nameOf(d.fiercest_rivalry.player_b)}`,
                    secondary: `H2H ${d.fiercest_rivalry.a_wins}–${d.fiercest_rivalry.b_wins}`,
                    aside: `${d.fiercest_rivalry.meetings} meetings`,
                  }
                : null;
              const nemesisBody: InsightCardBody | null = d?.nemesis
                ? {
                    roster: [d.nemesis.opponent, d.nemesis.player],
                    primary: `${nameOf(d.nemesis.opponent)} owns ${nameOf(d.nemesis.player)}`,
                    secondary: `${d.nemesis.losses} losses to same opponent`,
                    aside: "singles nemesis",
                  }
                : null;
              const kryptoniteBody: InsightCardBody | null = d?.kryptonite_duo
                ? {
                    roster: [d.kryptonite_duo.player_a, d.kryptonite_duo.player_b],
                    primary: `${nameOf(d.kryptonite_duo.player_a)} & ${nameOf(d.kryptonite_duo.player_b)}`,
                    secondary: `${d.kryptonite_duo.wins} / ${d.kryptonite_duo.matches} together`,
                    aside: `${pct(d.kryptonite_duo.wins, d.kryptonite_duo.matches)} win rate`,
                  }
                : null;
              return (
                <>
                  <InsightCard icon={Swords} title="Fiercest rivalry" subtitle="Most singles meetings between two players"
                    empty="Play 2+ singles matches against the same opponent." body={rivalryBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={ShieldAlert} title="Nemesis" subtitle="Beats the most-active player most"
                    empty="Needs 2+ losses to the same opponent." body={nemesisBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Zap} title="Kryptonite duo" subtitle="Doubles pair with best win rate"
                    empty="Play 3+ doubles matches with the same partner." body={kryptoniteBody} preferNicknames={preferNicknames} />
                </>
              );
            })()}
          </Grid>
        </TabsContent>

        {/* Form & Momentum -------------------------------------------- */}
        <TabsContent value="form" className="mt-3">
          <Grid loading={form.isLoading} count={4}>
            {(() => {
              const d = form.data;
              const hotBody: InsightCardBody | null = d?.hot_hand
                ? {
                    roster: [d.hot_hand.player],
                    primary: nameOf(d.hot_hand.player),
                    secondary: `${d.hot_hand.wins} / ${d.hot_hand.matches} recent wins`,
                    aside: "last 5 matches",
                  }
                : null;
              const comebackBody: InsightCardBody | null = d?.comeback_kid
                ? {
                    roster: [d.comeback_kid.player],
                    primary: nameOf(d.comeback_kid.player),
                    secondary: `${d.comeback_kid.comebacks} match${d.comeback_kid.comebacks === 1 ? "" : "es"} won after losing set 1`,
                    aside: "comeback kid",
                  }
                : null;
              const giantBody: InsightCardBody | null = d?.giant_slayer
                ? {
                    roster: [d.giant_slayer.player],
                    primary: nameOf(d.giant_slayer.player),
                    secondary: `${d.giant_slayer.upsets} win${d.giant_slayer.upsets === 1 ? "" : "s"} vs higher-seeded opponents`,
                    aside: "singles upsets",
                  }
                : null;
              const riseBody: InsightCardBody | null = d?.on_the_rise
                ? {
                    roster: [d.on_the_rise.player],
                    primary: nameOf(d.on_the_rise.player),
                    secondary: `Seed #${d.on_the_rise.past_seed} → #${d.on_the_rise.current_seed}`,
                    aside: `+${d.on_the_rise.climb} spot${d.on_the_rise.climb === 1 ? "" : "s"}`,
                  }
                : null;
              return (
                <>
                  <InsightCard icon={Flame} title="Hot hand" subtitle="Best win rate over the last 5 matches"
                    empty="Play 5+ matches to qualify." body={hotBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Undo2} title="Comeback kid" subtitle="Most wins after losing set 1"
                    empty="No comebacks recorded yet." body={comebackBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Target} title="Giant slayer" subtitle="Most wins vs higher-seeded opponents"
                    empty="Beat a higher-seeded player to qualify." body={giantBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Rocket} title="On the rise" subtitle="Biggest seed climb in the last 30 days"
                    empty="Nobody's seed has climbed in 30 days." body={riseBody} preferNicknames={preferNicknames} />
                </>
              );
            })()}
          </Grid>
        </TabsContent>

        {/* Playing Style ---------------------------------------------- */}
        <TabsContent value="style" className="mt-3">
          <Grid loading={style.isLoading} count={4}>
            {(() => {
              const d = style.data;
              const tiebreakBody: InsightCardBody | null = d?.tiebreak_king
                ? {
                    roster: [d.tiebreak_king.player],
                    primary: nameOf(d.tiebreak_king.player),
                    secondary: `${d.tiebreak_king.tb_wins} / ${d.tiebreak_king.tb_sets} tiebreak sets`,
                    aside: `${pct(d.tiebreak_king.tb_wins, d.tiebreak_king.tb_sets)} tiebreak rate`,
                  }
                : null;
              const grinderBody: InsightCardBody | null = d?.grinder
                ? {
                    roster: [d.grinder.player],
                    primary: nameOf(d.grinder.player),
                    secondary: `${d.grinder.long_matches} / ${d.grinder.matches} went the distance`,
                    aside: `${pct(d.grinder.long_matches, d.grinder.matches)} grind rate`,
                  }
                : null;
              const closerBody: InsightCardBody | null = d?.closer
                ? {
                    roster: [d.closer.player],
                    primary: nameOf(d.closer.player),
                    secondary: `${d.closer.decider_wins} / ${d.closer.deciders} deciding sets won`,
                    aside: `${pct(d.closer.decider_wins, d.closer.deciders)} closer rate`,
                  }
                : null;
              const bagelBody: InsightCardBody | null = d?.bagel_king
                ? {
                    roster: [d.bagel_king.player],
                    primary: nameOf(d.bagel_king.player),
                    secondary: `${d.bagel_king.bagels} bagel${d.bagel_king.bagels === 1 ? "" : "s"} served`,
                    aside: "6-0 sets won",
                  }
                : null;
              return (
                <>
                  <InsightCard icon={Timer} title="Tiebreak king" subtitle="Best record in tiebreak sets"
                    empty="Play 3+ tiebreak sets to qualify." body={tiebreakBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={TrendingUp} title="Grinder" subtitle="Most matches that went the distance"
                    empty="Play 5+ matches to qualify." body={grinderBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Trophy} title="Closer" subtitle="Best record in deciding sets"
                    empty="Play 3+ matches that go to a decider." body={closerBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Medal} title="Bagel king" subtitle="Most 6-0 sets served"
                    empty="No bagels served yet." body={bagelBody} preferNicknames={preferNicknames} />
                </>
              );
            })()}
          </Grid>
        </TabsContent>

        {/* Participation & Community ---------------------------------- */}
        <TabsContent value="participation" className="mt-3">
          <Grid loading={participation.isLoading} count={5}>
            {(() => {
              const d = participation.data;
              const earlyBody: InsightCardBody | null = d?.early_bird
                ? {
                    roster: [d.early_bird.player],
                    primary: nameOf(d.early_bird.player),
                    secondary: `${d.early_bird.matches} match${d.early_bird.matches === 1 ? "" : "es"} before 9am`,
                    aside: "early bird",
                  }
                : null;
              const nightBody: InsightCardBody | null = d?.night_owl
                ? {
                    roster: [d.night_owl.player],
                    primary: nameOf(d.night_owl.player),
                    secondary: `${d.night_owl.matches} match${d.night_owl.matches === 1 ? "" : "es"} after 8pm`,
                    aside: "night owl",
                  }
                : null;
              const weekendBody: InsightCardBody | null = d?.weekend_warrior
                ? {
                    roster: [d.weekend_warrior.player],
                    primary: nameOf(d.weekend_warrior.player),
                    secondary: `${d.weekend_warrior.weekend_matches} / ${d.weekend_warrior.matches} on weekends`,
                    aside: `${pct(d.weekend_warrior.weekend_matches, d.weekend_warrior.matches)} weekend`,
                  }
                : null;
              const socialBody: InsightCardBody | null = d?.social_butterfly
                ? {
                    roster: [d.social_butterfly.player],
                    primary: nameOf(d.social_butterfly.player),
                    secondary: `${d.social_butterfly.partners} distinct partners`,
                    aside: "doubles, last 30d",
                  }
                : null;
              const newFaceBody: InsightCardBody | null = d?.new_face
                ? {
                    roster: [d.new_face.player],
                    primary: nameOf(d.new_face.player),
                    secondary: `${d.new_face.matches} match${d.new_face.matches === 1 ? "" : "es"} since joining`,
                    aside: "new to the club",
                  }
                : null;
              return (
                <>
                  <InsightCard icon={Coffee} title="Early bird" subtitle="Most matches before 9am"
                    empty="Play 2+ matches before 9am." body={earlyBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Moon} title="Night owl" subtitle="Most matches after 8pm"
                    empty="Play 2+ matches after 8pm." body={nightBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={CalendarCheck2} title="Weekend warrior" subtitle="Highest share of matches on weekends"
                    empty="Play 5+ matches to qualify." body={weekendBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={Users} title="Social butterfly" subtitle="Most distinct doubles partners this month"
                    empty="Play doubles with 2+ different partners." body={socialBody} preferNicknames={preferNicknames} />
                  <InsightCard icon={UserPlus} title="New face" subtitle="Most-active player who joined recently"
                    empty="No new members in the last 30 days." body={newFaceBody} preferNicknames={preferNicknames} />
                </>
              );
            })()}
          </Grid>
        </TabsContent>

        {/* Milestones ------------------------------------------------- */}
        <TabsContent value="milestones" className="mt-3">
          {milestones.isLoading ? (
            <div className="grid gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <MilestoneFeed items={milestones.data?.items ?? []} preferNicknames={preferNicknames} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Grid({ loading, count, children }: { loading: boolean; count: number; children: ReactNode }) {
  if (loading) {
    return (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </section>
    );
  }
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</section>;
}

