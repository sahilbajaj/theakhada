import { GitBranch, ListOrdered, Trophy } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClubSnapshot } from "@/hooks/useClubData";

export default function Tournaments() {
  const { data } = useClubSnapshot();

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tournaments</h2>
          <p className="text-sm text-muted-foreground">Registration, seeding, brackets, and score flow.</p>
        </div>
        <Button><Trophy className="mr-2 h-4 w-4" />Create</Button>
      </section>

      {(data?.tournaments ?? []).map((tournament) => {
        const seededPct = tournament.entrants ? Math.round((tournament.seeded / tournament.entrants) * 100) : 0;
        return (
          <section key={tournament.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{tournament.name}</h3>
                  <Badge className="capitalize">{tournament.status}</Badge>
                  <Badge variant="outline" className="capitalize">{tournament.format}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Starts {format(new Date(tournament.startsAt), "MMM d, h:mm a")}</p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground"><ListOrdered className="h-4 w-4" />Seeding</span>
                  <span className="font-medium">{tournament.seeded}/{tournament.entrants}</span>
                </div>
                <Progress value={seededPct} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline"><ListOrdered className="mr-2 h-4 w-4" />Seeds</Button>
              <Button variant="outline"><GitBranch className="mr-2 h-4 w-4" />Bracket</Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
