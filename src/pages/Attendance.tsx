import { CheckCircle2, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClubSnapshot } from "@/hooks/useClubData";

export default function Attendance() {
  const { data } = useClubSnapshot();

  return (
    <div className="grid gap-4">
      {(data?.attendance ?? []).map((session) => {
        const pct = Math.round((session.checkedInCount / session.expectedCount) * 100);
        return (
          <section key={session.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge variant="outline">{format(new Date(session.startsAt), "h:mm a")}</Badge>
                <h2 className="mt-3 text-lg font-semibold">{session.name}</h2>
                <p className="text-sm text-muted-foreground">{session.checkedInCount} of {session.expectedCount} checked in</p>
              </div>
              <Button variant={pct === 100 ? "secondary" : "default"}>
                {pct === 100 ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                Check in
              </Button>
            </div>
            <Progress value={pct} className="mt-4" />
          </section>
        );
      })}
    </div>
  );
}
