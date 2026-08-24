import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Brain, LineChart, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useClubSnapshot } from "@/hooks/useClubData";

export default function Insights() {
  const { data } = useClubSnapshot();
  const chartData = (data?.players ?? []).map((player) => ({
    name: player.fullName.split(" ")[0],
    wins: player.wins,
    losses: player.losses,
  }));

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">Stats foundation</h2>
              <Badge variant="secondary"><Sparkles className="mr-1 h-3.5 w-3.5" />AI later</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Structured club data is ready for smart seeding, form trends, booking recommendations, and player insights.</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <LineChart className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Player results</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="wins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="losses" fill="hsl(var(--court-clay))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
