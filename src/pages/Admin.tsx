import { Bell, CalendarCog, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const controls = [
  { label: "Allow member self-booking", detail: "Members can reserve open courts from web or mobile.", icon: CalendarCog, enabled: true },
  { label: "Require check-in", detail: "Late arrivals remain visible in attendance queues.", icon: Bell, enabled: true },
  { label: "Coach overrides", detail: "Coaches can move lessons and update match outcomes.", icon: ShieldCheck, enabled: false },
  { label: "Visitor access", detail: "Guests can be invited into selected programs.", icon: UsersRound, enabled: true },
];

export default function Admin() {
  return (
    <div className="grid gap-4">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Admin controls</h2>
            <p className="text-sm text-muted-foreground">Club rules, roles, permissions, and operating defaults.</p>
          </div>
          <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />Rules</Button>
        </div>
      </section>

      <section className="grid gap-3">
        {controls.map((control) => (
          <div key={control.label} className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <control.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{control.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{control.detail}</p>
              </div>
            </div>
            <Switch defaultChecked={control.enabled} />
          </div>
        ))}
      </section>
    </div>
  );
}
