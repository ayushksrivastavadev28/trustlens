import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
