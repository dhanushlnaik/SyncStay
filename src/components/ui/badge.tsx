import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-[var(--surface-soft)] text-[var(--text-secondary)]",
      success: "bg-[var(--success-soft)] text-[var(--success)]",
      warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
      destructive: "bg-[var(--error-soft)] text-[var(--error)]",
      accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
