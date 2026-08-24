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
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  clay: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  neutral: "bg-muted text-foreground",
};

export function MetricTile({ label, value, detail, icon: Icon, tone = "neutral" }: MetricTileProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-foreground">{value}</p>
        </div>
        <div className={cn("grid h-10 w-10 place-items-center rounded-md", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
