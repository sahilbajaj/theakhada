import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-[transform,box-shadow,background,color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-glow-primary hover:bg-primary/95 hover:shadow-[0_14px_36px_-10px_hsl(var(--primary)/0.65)] hover:-translate-y-px",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_8px_24px_-12px_hsl(var(--destructive)/0.5)] hover:bg-destructive/90 hover:-translate-y-px",
        outline:
          "border border-border bg-background hover:border-primary/50 hover:bg-primary/[0.04] hover:text-foreground hover:shadow-card",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /**
         * High-emphasis lime CTA for marketing / hero moments. Uses the accent
         * token (lime) with primary-color foreground for contrast.
         */
        accent:
          "bg-accent text-accent-foreground shadow-glow-accent hover:bg-accent/95 hover:shadow-[0_14px_36px_-10px_hsl(var(--accent)/0.6)] hover:-translate-y-px",
        success: "bg-success text-success-foreground hover:bg-success/90 hover:-translate-y-px",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-lg px-6 text-base font-semibold",
        icon: "h-10 w-10",
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
