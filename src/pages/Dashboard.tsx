import { Activity, CalendarCheck2, Clock3, Trophy, UsersRound } from "lucide-react";
import { format } from "date-fns";
import { MetricTile } from "@/components/MetricTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentMatches } from "@/features/matches/data/useMatches";
import { MatchCard } from "@/features/matches/ui/MatchCard";
import { useClubSettings } from "@/hooks/useClubSettings";
import { useClubSnapshot } from "@/hooks/useClubData";

export default function Dashboard() {
  const { data, isLoading } = useClubSnapshot();
  const matchesQuery = useRecentMatches(10);
  const { preferNicknames } = useClubSettings();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  const liveMatch = (matchesQuery.data ?? []).find((match) => match.status !== "final");
  const activeBookings = data.bookings.filter((booking) => booking.status !== "cancelled").length;
  const attendanceDue = data.attendance.reduce((sum, session) => sum + session.expectedCount - session.checkedInCount, 0);
  const activePlayers = data.players.filter((player) => player.status === "active").length;

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-normal">{data.club.name}</h2>
              <Badge variant="secondary">{data.club.city}</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Courts, programs, match play, and club administration in one operating view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>New booking</Button>
            <Button variant="outline">Record score</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Courts active" value={`${data.courts.filter((court) => court.active).length}/${data.courts.length}`} detail="Hard, clay, and indoor inventory" icon={CalendarCheck2} tone="green" />
        <MetricTile label="Bookings today" value={String(activeBookings)} detail="Confirmed, checked in, or complete" icon={Clock3} tone="blue" />
        <MetricTile label="Players active" value={String(activePlayers)} detail={`${data.players.length} total player records`} icon={UsersRound} />
        <MetricTile label="Attendance open" value={String(attendanceDue)} detail="Expected players not checked in" icon={Activity} tone="clay" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Court timeline</h3>
              <p className="text-sm text-muted-foreground">Bookings and programs</p>
            </div>
            <Badge variant="outline">{format(new Date(), "EEE, MMM d")}</Badge>
          </div>
          <div className="grid gap-3">
            {data.bookings.map((booking) => (
              <div key={booking.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center">
                <div className="text-sm font-medium">{format(new Date(booking.startsAt), "h:mm a")}</div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{booking.courtName} · {booking.players.join(", ")}</p>
                  <p className="text-sm capitalize text-muted-foreground">{booking.purpose}</p>
                </div>
                <Badge variant={booking.status === "checked_in" ? "default" : "secondary"} className="w-fit capitalize">
                  {booking.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Live match</h3>
          </div>
          {matchesQuery.isLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : liveMatch ? (
            <MatchCard match={liveMatch} preferNicknames={preferNicknames} />
          ) : (
            <p className="text-sm text-muted-foreground">No match currently live.</p>
          )}
        </div>
      </section>
    </div>
  );
}
