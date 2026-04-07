import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/75 px-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/25",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
