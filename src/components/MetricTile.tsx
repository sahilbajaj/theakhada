import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricTileProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "green" | "blue" | "clay" | "neutral";
}

const toneClasses = {
  green: "bg-primary/12 text-primary",
  blue: "bg-[hsl(var(--court-blue)/0.14)] text-[hsl(var(--court-blue))]",
  clay: "bg-[hsl(var(--court-clay)/0.14)] text-[hsl(var(--court-clay))]",
  neutral: "bg-secondary text-foreground",
};

export function MetricTile({ label, value, detail, icon: Icon, tone = "neutral" }: MetricTileProps) {
  return (
    <div className="card-base p-4 transition hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", toneClasses[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
