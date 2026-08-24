import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[transform,box-shadow,background,color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_hsl(0_0%_100%/0.12)_inset,0_8px_24px_-12px_hsl(var(--primary)/0.45)] hover:bg-primary/95 hover:shadow-[0_1px_0_hsl(0_0%_100%/0.14)_inset,0_14px_32px_-12px_hsl(var(--primary)/0.55)] hover:-translate-y-px",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_8px_24px_-12px_hsl(var(--destructive)/0.5)] hover:bg-destructive/90 hover:-translate-y-px",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/40 hover:shadow-[0_8px_24px_-14px_hsl(var(--primary)/0.3)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-[0_6px_20px_-12px_hsl(var(--shadow-color)/0.4)]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        accent:
          "bg-primary text-primary-foreground shadow-[0_0_25px_-5px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_40px_-5px_hsl(var(--primary)/0.55)] hover:-translate-y-px",
        premium:
          "text-primary-foreground border border-primary/30 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary))_55%,hsl(var(--cyan,var(--primary)))_100%)] bg-[length:200%_100%] bg-left shadow-[0_1px_0_hsl(0_0%_100%/0.18)_inset,0_10px_30px_-10px_hsl(var(--primary)/0.55),0_0_40px_-12px_hsl(var(--primary)/0.4)] hover:bg-right hover:-translate-y-px hover:shadow-[0_1px_0_hsl(0_0%_100%/0.22)_inset,0_16px_44px_-12px_hsl(var(--primary)/0.7),0_0_60px_-12px_hsl(var(--primary)/0.5)]",
        success: "bg-success text-success-foreground hover:bg-success/90 hover:-translate-y-px",
        /**
         * Marketing hero CTA — high-intensity glow, intended for marketing/landing-page
         * primary CTAs. Do not use casually inside dense app surfaces; prefer `default`
         * or `accent` there.
         */
        hero:
          "bg-primary text-primary-foreground shadow-[0_0_25px_-5px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_50px_-5px_hsl(var(--primary)/0.6)] motion-reduce:transition-none motion-reduce:hover:shadow-[0_0_25px_-5px_hsl(var(--primary)/0.4)]",
        /**
         * Marketing hero outline CTA — quiet base, gradient wash + elevation on hover.
         * Marketing/landing only.
         */
        "hero-outline":
          "text-muted-foreground border border-border bg-transparent transition-[color,border-color,background,box-shadow,transform] duration-200 hover:text-foreground hover:border-primary/60 hover:-translate-y-px hover:bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--brand-violet)/0.06))] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_12px_40px_-12px_hsl(var(--primary)/0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        /**
         * Hero CTA size — 52px tap target, generous horizontal padding,
         * pill-ish rounded-lg. Pair with `variant="hero"` / `"hero-outline"`.
         */
        hero: "h-[52px] px-7 rounded-lg text-sm font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * When true, renders a spinner overlay, disables interaction, and preserves the
   * button's width so the layout doesn't shift. Ignored when `asChild` is true
   * (child slots can't reliably host overlays).
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>{children}</Comp>;
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), loading && "relative")}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        )}
        <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
          {children}
        </span>
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
