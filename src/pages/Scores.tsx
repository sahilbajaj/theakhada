import { Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClubSnapshot } from "@/hooks/useClubData";

export default function Scores() {
  const { data } = useClubSnapshot();

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Score keeping</h2>
            <p className="text-sm text-muted-foreground">Capture singles, doubles, tie-breaks, and final results.</p>
          </div>
          <Button><Plus className="mr-2 h-4 w-4" />New match</Button>
        </div>
      </section>

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="entry">Quick entry</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4 grid gap-3">
          {(data?.matches ?? []).map((match) => (
            <div key={match.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Badge variant={match.status === "live" ? "default" : "secondary"} className="capitalize">{match.status}</Badge>
                  <h3 className="mt-3 font-semibold">{match.home.join(" / ")} vs {match.away.join(" / ")}</h3>
                  <p className="text-sm text-muted-foreground">{match.courtName} · {match.format}</p>
                </div>
                <div className="flex gap-2">
                  {match.sets.length ? match.sets.map((set, index) => (
                    <div key={`${match.id}-${index}`} className="min-w-16 rounded-md border px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Set {index + 1}</p>
                      <p className="font-semibold">{set.home}-{set.away}</p>
                    </div>
                  )) : <Badge variant="outline">Not started</Badge>}
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="recent" className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Finalized match history appears here once connected to Supabase.
        </TabsContent>
        <TabsContent value="entry" className="mt-4 rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Home player/team" />
            <Input placeholder="Away player/team" />
            <Input placeholder="Set score, e.g. 6-4 3-2" />
            <Button><Save className="mr-2 h-4 w-4" />Save score</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
