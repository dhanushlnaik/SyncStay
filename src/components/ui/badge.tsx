import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur",
  {
  variants: {
    variant: {
      neutral: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)]",
      success: "border-[var(--success)]/35 bg-[var(--success-soft)] text-[var(--success)]",
      warning: "border-[var(--warning)]/35 bg-[var(--warning-soft)] text-[var(--warning)]",
      destructive: "border-[var(--error)]/35 bg-[var(--error-soft)] text-[var(--error)]",
      accent: "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent)]",
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
