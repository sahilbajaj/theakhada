import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Trophy } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAmericanoTournament,
  useAmericanoTournaments,
  useCreateAmericanoTournament,
  useDeleteAmericanoTournament,
  useReopenAmericanoMatch,
  useSubmitAmericanoScore,
} from "@/features/americano/data/useAmericano";
import { generateAmericanoRounds } from "@/features/americano/logic/generateRounds";
import { Leaderboard as AmericanoLeaderboard } from "@/features/americano/ui/Leaderboard";
import { LiveMatches as AmericanoLiveMatches } from "@/features/americano/ui/LiveMatches";
import { SetupPanel as AmericanoSetupPanel } from "@/features/americano/ui/SetupPanel";
import {
  useCreateRoundRobinTournament,
  useDeleteRoundRobinTournament,
  useReopenRoundRobinMatch,
  useRoundRobinTournament,
  useRoundRobinTournaments,
  useSubmitRoundRobinScore,
} from "@/features/roundrobin/data/useRoundRobin";
import { generateRoundRobinSchedule } from "@/features/roundrobin/logic/generateBracket";
import { Bracket as RoundRobinBracket } from "@/features/roundrobin/ui/Bracket";
import { LiveMatches as RoundRobinLiveMatches } from "@/features/roundrobin/ui/LiveMatches";
import { SetupPanel as RoundRobinSetupPanel } from "@/features/roundrobin/ui/SetupPanel";
import { Standings as RoundRobinStandings } from "@/features/roundrobin/ui/Standings";

type Format = "americano" | "roundrobin";

interface ListEntry {
  id: string;
  format: Format;
  name: string;
  status: string;
  created_at: string;
  match_count: number;
  completed_count: number;
  subtitle: string;
}

export default function Tournaments() {
  const { role } = useAuth();
  const isAdmin = role === "owner" || role === "admin";
  const [active, setActive] = useState<{ id: string; format: Format } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; format: Format; name: string } | null>(null);
  const [setupFormat, setSetupFormat] = useState<Format>("americano");

  const americanoList = useAmericanoTournaments();
  const rrList = useRoundRobinTournaments();

  const combined = useMemo<ListEntry[]>(() => {
    const items: ListEntry[] = [];
    (americanoList.data ?? []).forEach((t) =>
      items.push({
        id: t.id,
        format: "americano",
        name: t.name,
        status: t.status,
        created_at: t.created_at,
        match_count: t.match_count,
        completed_count: t.completed_count,
        subtitle: `${t.player_count} players · ${t.points_per_match} pts`,
      }),
    );
    (rrList.data ?? []).forEach((t) =>
      items.push({
        id: t.id,
        format: "roundrobin",
        name: t.name,
        status: t.status,
        created_at: t.created_at,
        match_count: t.match_count,
        completed_count: t.completed_count,
        subtitle: `${t.team_count} teams · ${t.group_count} group${t.group_count === 1 ? "" : "s"} · ${t.points_per_match} pts`,
      }),
    );
    return items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [americanoList.data, rrList.data]);

  useEffect(() => {
    if (!active && combined.length) {
      const first = combined[0];
      setActive({ id: first.id, format: first.format });
    }
  }, [active, combined]);

  function openConsole(entry: ListEntry) {
    setActive({ id: entry.id, format: entry.format });
  }

  const deleteDialog = <DeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={(id) => {
    if (active?.id === id) setActive(null);
  }} />;

  if (active) {
    return active.format === "americano" ? (
      <AmericanoConsole
        id={active.id}
        isAdmin={isAdmin}
        onBack={() => setActive(null)}
        onDelete={(name) => setDeleteTarget({ id: active.id, format: "americano", name })}
        trailing={deleteDialog}
      />
    ) : (
      <RoundRobinConsole
        id={active.id}
        isAdmin={isAdmin}
        onBack={() => setActive(null)}
        onDelete={(name) => setDeleteTarget({ id: active.id, format: "roundrobin", name })}
        trailing={deleteDialog}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <h1 className="text-xl font-semibold">Tournaments</h1>
        <p className="text-sm text-muted-foreground">
          Run an Americano (rotating partners) or a Round Robin (fixed random pairs, groups, and knockout).
        </p>
      </section>

      {(americanoList.isLoading || rrList.isLoading) ? <Skeleton className="h-24 w-full rounded-xl" /> : null}

      {combined.length ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your tournaments</h2>
          {combined.map((item) => {
            const pct = item.match_count ? Math.round((item.completed_count / item.match_count) * 100) : 0;
            return (
              <article key={`${item.format}-${item.id}`} className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
                <div className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <Badge className="capitalize">{item.status}</Badge>
                      <Badge variant="outline" className="capitalize">
                        {item.format === "americano" ? "Americano" : "Round Robin"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.subtitle} · {format(new Date(item.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Matches</span>
                      <span className="font-medium">{item.completed_count}/{item.match_count}</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => openConsole(item)}>
                    <Trophy className="mr-2 h-4 w-4" />Open console
                  </Button>
                  {isAdmin ? (
                    <Button variant="outline" onClick={() => setDeleteTarget({ id: item.id, format: item.format, name: item.name })}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">New tournament</h2>
          <Tabs value={setupFormat} onValueChange={(v) => setSetupFormat(v as Format)}>
            <TabsList>
              <TabsTrigger value="americano">Americano</TabsTrigger>
              <TabsTrigger value="roundrobin">Round Robin</TabsTrigger>
            </TabsList>
            <TabsContent value="americano" className="mt-4">
              <AmericanoSetup onCreated={(id) => setActive({ id, format: "americano" })} />
            </TabsContent>
            <TabsContent value="roundrobin" className="mt-4">
              <RoundRobinSetup onCreated={(id) => setActive({ id, format: "roundrobin" })} />
            </TabsContent>
          </Tabs>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Ask a club admin to set up the next tournament.</p>
      )}
      {deleteDialog}
    </div>
  );
}

function AmericanoSetup({ onCreated }: { onCreated: (id: string) => void }) {
  const createTournament = useCreateAmericanoTournament();
  return (
    <AmericanoSetupPanel
      isPending={createTournament.isPending}
      onCreate={(input) => {
        const matches = generateAmericanoRounds(input.playerNames.length, input.courtCount);
        createTournament.mutate(
          { ...input, matches },
          {
            onSuccess: (id) => {
              onCreated(id);
              toast.success("Tournament generated");
            },
            onError: (error) => toast.error(error.message),
          },
        );
      }}
    />
  );
}

function RoundRobinSetup({ onCreated }: { onCreated: (id: string) => void }) {
  const createTournament = useCreateRoundRobinTournament();
  return (
    <RoundRobinSetupPanel
      isPending={createTournament.isPending}
      onCreate={(input) => {
        const matches = generateRoundRobinSchedule(input.teams, input.courtCount);
        createTournament.mutate(
          {
            name: input.name,
            teamNames: input.teams.map((t) => t.players),
            groupAssignments: input.teams.map((t) => t.group),
            pointsPerMatch: input.pointsPerMatch,
            courtCount: input.courtCount,
            groupCount: input.groupCount,
            matches,
          },
          {
            onSuccess: (id) => {
              onCreated(id);
              toast.success("Tournament created");
            },
            onError: (error) => toast.error(error.message),
          },
        );
      }}
    />
  );
}

function AmericanoConsole({ id, isAdmin, onBack, onDelete, trailing }: { id: string; isAdmin: boolean; onBack: () => void; onDelete: (name: string) => void; trailing: React.ReactNode }) {
  const detailQuery = useAmericanoTournament(id);
  const submitScore = useSubmitAmericanoScore();
  const reopenMatch = useReopenAmericanoMatch();
  const [tab, setTab] = useState("live");

  const tournament = detailQuery.data ?? null;
  if (!tournament) return <Skeleton className="h-24 w-full rounded-xl" />;

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to tournaments">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{tournament.name}</h1>
            <p className="text-sm text-muted-foreground">
              Americano · {tournament.players.length} players · {tournament.court_count} court
              {tournament.court_count > 1 ? "s" : ""} · {tournament.points_per_match} points per match
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge className="capitalize">{tournament.status}</Badge>
          {isAdmin ? (
            <Button variant="outline" size="icon" aria-label="Delete tournament" onClick={() => onDelete(tournament.name)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live">Live matches</TabsTrigger>
          <TabsTrigger value="standings">Leaderboard</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4">
          <AmericanoLiveMatches
            tournament={tournament}
            isPending={submitScore.isPending || reopenMatch.isPending}
            onSubmit={(matchId, a, b) =>
              submitScore.mutate(
                { tournamentId: tournament.id, matchId, teamAPoints: a, teamBPoints: b },
                { onSuccess: () => toast.success("Score saved"), onError: (error) => toast.error(error.message) },
              )
            }
            onReopen={(matchId) =>
              reopenMatch.mutate(
                { tournamentId: tournament.id, matchId },
                { onError: (error) => toast.error(error.message) },
              )
            }
          />
        </TabsContent>
        <TabsContent value="standings" className="mt-4">
          <AmericanoLeaderboard tournament={tournament} />
        </TabsContent>
      </Tabs>
      {trailing}
    </div>
  );
}

function RoundRobinConsole({ id, isAdmin, onBack, onDelete, trailing }: { id: string; isAdmin: boolean; onBack: () => void; onDelete: (name: string) => void; trailing: React.ReactNode }) {
  const detailQuery = useRoundRobinTournament(id);
  const submitScore = useSubmitRoundRobinScore();
  const reopenMatch = useReopenRoundRobinMatch();
  const [tab, setTab] = useState("groups");

  const tournament = detailQuery.data ?? null;
  if (!tournament) return <Skeleton className="h-24 w-full rounded-xl" />;

  const groupComplete = tournament.matches
    .filter((m) => m.stage === "group")
    .every((m) => m.status === "completed");

  const handleSubmit = (matchId: string, a: number, b: number) =>
    submitScore.mutate(
      { tournamentId: tournament.id, matchId, teamAPoints: a, teamBPoints: b },
      { onSuccess: () => toast.success("Score saved"), onError: (error) => toast.error(error.message) },
    );
  const handleReopen = (matchId: string) =>
    reopenMatch.mutate(
      { tournamentId: tournament.id, matchId },
      { onError: (error) => toast.error(error.message) },
    );

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to tournaments">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{tournament.name}</h1>
            <p className="text-sm text-muted-foreground">
              Round Robin · {tournament.teams.length} teams · {tournament.group_count} group{tournament.group_count === 1 ? "" : "s"} ·
              {" "}{tournament.court_count} court{tournament.court_count > 1 ? "s" : ""} · {tournament.points_per_match} points per match
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge className="capitalize">{tournament.status}</Badge>
          {isAdmin ? (
            <Button variant="outline" size="icon" aria-label="Delete tournament" onClick={() => onDelete(tournament.name)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="groups">Group stage</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="bracket" disabled={!groupComplete}>Bracket</TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="mt-4">
          <RoundRobinLiveMatches
            tournament={tournament}
            isPending={submitScore.isPending || reopenMatch.isPending}
            onSubmit={handleSubmit}
            onReopen={handleReopen}
          />
        </TabsContent>
        <TabsContent value="standings" className="mt-4">
          <RoundRobinStandings tournament={tournament} />
        </TabsContent>
        <TabsContent value="bracket" className="mt-4">
          <RoundRobinBracket
            tournament={tournament}
            isPending={submitScore.isPending || reopenMatch.isPending}
            onSubmit={handleSubmit}
            onReopen={handleReopen}
          />
        </TabsContent>
      </Tabs>
      {trailing}
    </div>
  );
}

function DeleteDialog({ target, onClose, onDeleted }: { target: { id: string; format: Format; name: string } | null; onClose: () => void; onDeleted: (id: string) => void }) {
  const deleteAmericano = useDeleteAmericanoTournament();
  const deleteRoundRobin = useDeleteRoundRobinTournament();
  const pending = deleteAmericano.isPending || deleteRoundRobin.isPending;

  function confirm() {
    if (!target) return;
    const opts = {
      onSuccess: () => {
        toast.success("Tournament deleted");
        onDeleted(target.id);
        onClose();
      },
      onError: (error: Error) => toast.error(error.message),
    };
    if (target.format === "americano") deleteAmericano.mutate(target.id, opts);
    else deleteRoundRobin.mutate(target.id, opts);
  }

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {target?.name ?? "this tournament"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the tournament and every match — including submitted scores. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending}>
            Delete tournament
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
