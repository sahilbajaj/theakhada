import { format } from "date-fns";
import { CalendarPlus, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClubSnapshot } from "@/hooks/useClubData";

export default function Bookings() {
  const { data } = useClubSnapshot();

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Court bookings</h2>
          <p className="text-sm text-muted-foreground">Reserve courts, manage blocks, and track check-ins.</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courts</SelectItem>
              {(data?.courts ?? []).map((court) => <SelectItem key={court.id} value={court.id}>{court.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button><CalendarPlus className="mr-2 h-4 w-4" />Book</Button>
        </div>
      </section>

      <section className="grid gap-3">
        {(data?.bookings ?? []).map((booking) => (
          <div key={booking.id} className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-card md:grid-cols-[1fr_180px_140px] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{booking.courtName}</h3>
                <Badge variant="outline" className="capitalize">{booking.purpose}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{booking.players.join(", ")}</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">{format(new Date(booking.startsAt), "h:mm a")} - {format(new Date(booking.endsAt), "h:mm a")}</p>
              <p className="text-muted-foreground">{format(new Date(booking.startsAt), "MMM d")}</p>
            </div>
            <Badge variant={booking.status === "checked_in" ? "default" : "secondary"} className="w-fit capitalize">
              <DoorOpen className="mr-1 h-3.5 w-3.5" />
              {booking.status.replace("_", " ")}
            </Badge>
          </div>
        ))}
      </section>
    </div>
  );
}
