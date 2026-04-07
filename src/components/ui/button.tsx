import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[linear-gradient(120deg,var(--accent),#6f7aff_58%,var(--accent-cyan))] text-[#f7f8ff] shadow-[0_10px_24px_rgba(36,30,100,0.45)] hover:brightness-110",
        outline:
          "border border-[var(--border)] bg-[var(--surface-soft)]/70 text-[var(--text-primary)] hover:border-[var(--accent)]/45 hover:bg-[var(--surface-soft)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]/85 hover:text-[var(--text-primary)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
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
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
