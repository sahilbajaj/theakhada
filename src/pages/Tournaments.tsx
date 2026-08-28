import { useEffect, useState } from "react";
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
import { Leaderboard } from "@/features/americano/ui/Leaderboard";
import { LiveMatches } from "@/features/americano/ui/LiveMatches";
import { SetupPanel } from "@/features/americano/ui/SetupPanel";

export default function Tournaments() {
  const { role } = useAuth();
  const isAdmin = role === "owner" || role === "admin";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState("live");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const listQuery = useAmericanoTournaments();
  const detailQuery = useAmericanoTournament(activeId);
  const createTournament = useCreateAmericanoTournament();
  const submitScore = useSubmitAmericanoScore();
  const reopenMatch = useReopenAmericanoMatch();
  const deleteTournament = useDeleteAmericanoTournament();

  useEffect(() => {
    if (!activeId && listQuery.data?.length) setActiveId(listQuery.data[0].id);
  }, [activeId, listQuery.data]);

  const tournament = detailQuery.data ?? null;

  const deleteTargetName =
    (tournament && tournament.id === deleteId ? tournament.name : null) ??
    listQuery.data?.find((t) => t.id === deleteId)?.name ??
    "this tournament";

  function confirmDelete() {
    if (!deleteId) return;
    const target = deleteId;
    deleteTournament.mutate(target, {
      onSuccess: () => {
        toast.success("Tournament deleted");
        setDeleteId(null);
        if (activeId === target) setActiveId(null);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  const deleteDialog = (
    <AlertDialog open={Boolean(deleteId)} onOpenChange={(next) => !next && setDeleteId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {deleteTargetName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the tournament, its players, and every match — including submitted scores. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTournament.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} disabled={deleteTournament.isPending}>
            Delete tournament
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (activeId && tournament) {
    return (
      <div className="grid gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => setActiveId(null)} aria-label="Back to tournaments">
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
              <Button variant="outline" size="icon" aria-label="Delete tournament" onClick={() => setDeleteId(tournament.id)}>
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
            <LiveMatches
              tournament={tournament}
              isPending={submitScore.isPending || reopenMatch.isPending}
              onSubmit={(matchId, a, b) =>
                submitScore.mutate(
                  { tournamentId: tournament.id, matchId, teamAPoints: a, teamBPoints: b },
                  {
                    onSuccess: () => toast.success("Score saved"),
                    onError: (error) => toast.error(error.message),
                  },
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
            <Leaderboard tournament={tournament} />
          </TabsContent>
        </Tabs>
        {deleteDialog}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
        <h1 className="text-xl font-semibold">Tournaments</h1>
        <p className="text-sm text-muted-foreground">
          Run an Americano: everyone switches partners each round and collects points individually.
        </p>
      </section>

      {listQuery.isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : null}

      {(listQuery.data ?? []).length ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your tournaments</h2>
          {(listQuery.data ?? []).map((item) => {
            const pct = item.match_count ? Math.round((item.completed_count / item.match_count) * 100) : 0;
            return (
              <article key={item.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
                <div className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <Badge className="capitalize">{item.status}</Badge>
                      <Badge variant="outline">Americano</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.player_count} players · {item.points_per_match} pts ·{" "}
                      {format(new Date(item.created_at), "MMM d, h:mm a")}
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
                  <Button onClick={() => setActiveId(item.id)}>
                    <Trophy className="mr-2 h-4 w-4" />Open console
                  </Button>
                  {isAdmin ? (
                    <Button variant="outline" onClick={() => setDeleteId(item.id)}>
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
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">New Americano</h2>
          <SetupPanel
            isPending={createTournament.isPending}
            onCreate={(input) => {
              const matches = generateAmericanoRounds(input.playerNames.length, input.courtCount);
              createTournament.mutate(
                { ...input, matches },
                {
                  onSuccess: (id) => {
                    setActiveId(id);
                    setTab("live");
                    toast.success("Tournament generated");
                  },
                  onError: (error) => toast.error(error.message),
                },
              );
            }}
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Ask a club admin to set up the next Americano.</p>
      )}
      {deleteDialog}
    </div>
  );
}
