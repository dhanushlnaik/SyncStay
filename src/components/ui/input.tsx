import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] outline-none ring-[var(--accent)]/25 transition focus:ring-2",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
