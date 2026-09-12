"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

/**
 * Fluent progress: 4px track on `--w11-border-default` with an accent fill.
 * Determinate bars are pure utilities so call-site overrides
 * (h-2, [&>div]:bg-*) keep working; when `value` is null the
 * `win11-progressbar indeterminate` classes take over and 11.css animates the
 * sweeping ::after.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-1 w-full overflow-hidden rounded-full bg-[var(--w11-border-default,rgba(0,0,0,0.12))]",
      value == null && "win11-progressbar indeterminate",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full flex-1 rounded-full bg-[var(--w11-accent,#0067c0)] transition-transform duration-200"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
