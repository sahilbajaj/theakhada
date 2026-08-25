/**
 * Badge — legacy shadcn badge primitive.
 *
 * @deprecated Prefer `Pill` from `@/ui-web/components` for new code. This
 * component is preserved for compatibility with existing shadcn-pattern
 * call sites. New status / mode / score / difficulty / locked labels
 * should use `Pill` directly.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
        /**
         * Tight uppercase status badge — use for LIVE / FINAL / SEEDED and other
         * short state chips. Compact, monospace-adjacent tracking.
         */
        status:
          "rounded-md border-transparent bg-secondary text-[10px] uppercase tracking-[0.08em] text-secondary-foreground px-2 py-0.5",
        live:
          "rounded-md border-transparent bg-destructive/12 text-[10px] uppercase tracking-[0.08em] text-destructive px-2 py-0.5",
        accent:
          "border-transparent bg-accent text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
