import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useClubSnapshot } from "@/hooks/useClubData";

export default function Players() {
  const { data } = useClubSnapshot();

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Player management</h2>
          <p className="text-sm text-muted-foreground">Roles, seeds, ratings, attendance, and match records.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search players" />
          </div>
          <Button><UserPlus className="mr-2 h-4 w-4" />Invite</Button>
        </div>
      </section>

      <section className="grid gap-3">
        {(data?.players ?? []).map((player) => (
          <div key={player.id} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm lg:grid-cols-[1fr_170px_220px_120px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-semibold">{player.fullName}</h3>
                <Badge variant={player.role === "admin" || player.role === "coach" ? "default" : "secondary"} className="capitalize">{player.role}</Badge>
                {player.seed ? <Badge variant="outline">Seed {player.seed}</Badge> : null}
              </div>
              <p className="mt-1 text-sm capitalize text-muted-foreground">{player.status}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rating</p>
              <p className="font-semibold">{player.rating.toFixed(1)}</p>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Attendance</span>
                <span className="font-medium">{player.attendanceRate}%</span>
              </div>
              <Progress value={player.attendanceRate} />
            </div>
            <div className="text-sm">
              <p className="font-semibold">{player.wins}-{player.losses}</p>
              <p className="text-muted-foreground">W-L</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
