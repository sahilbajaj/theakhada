import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CheckCircle className="h-4 w-4 text-success" />,
        error: <XCircle className="h-4 w-4 text-destructive" />,
        warning: <AlertTriangle className="h-4 w-4 text-warning" />,
        info: <Info className="h-4 w-4 text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-floating/95 group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border-strong/70 group-[.toaster]:rounded-xl group-[.toaster]:border-l-4 group-[.toaster]:backdrop-blur-xl group-[.toaster]:shadow-[0_1px_0_hsl(0_0%_100%/0.06)_inset,0_2px_4px_hsl(var(--shadow-color)/0.06),0_16px_48px_-16px_hsl(var(--shadow-color)/0.22)]",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:tracking-tight",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
          success:
            "group-[.toaster]:!border-l-[hsl(var(--success))] group-[.toaster]:shadow-[0_1px_0_hsl(0_0%_100%/0.06)_inset,0_16px_48px_-16px_hsl(var(--success)/0.35)]",
          error:
            "group-[.toaster]:!border-l-[hsl(var(--destructive))] group-[.toaster]:shadow-[0_1px_0_hsl(0_0%_100%/0.06)_inset,0_16px_48px_-16px_hsl(var(--destructive)/0.35)]",
          warning:
            "group-[.toaster]:!border-l-[hsl(var(--warning))] group-[.toaster]:shadow-[0_1px_0_hsl(0_0%_100%/0.06)_inset,0_16px_48px_-16px_hsl(var(--warning)/0.35)]",
          info:
            "group-[.toaster]:!border-l-[hsl(var(--primary))] group-[.toaster]:shadow-[0_1px_0_hsl(0_0%_100%/0.06)_inset,0_16px_48px_-16px_hsl(var(--primary)/0.35)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
