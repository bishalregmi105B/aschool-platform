"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { Win11Scope } from "@/lib/win11-scope";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Small solid Fluent tooltip: `--w11-surface-solid` background, primary text,
 * radius-sm, 12px, flyout elevation. The `.win11-tooltip` class is a pure-CSS
 * hover/::after pattern that does not fit Radix, so this is token-based
 * instead. Portaled + re-scoped so 11.css variables resolve; layered above
 * dialogs.
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <Win11Scope>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-[100100] rounded-[var(--w11-radius-sm)] border border-[var(--w11-border-subtle)] bg-[var(--w11-surface-solid)] px-2 py-1 text-xs text-[var(--w11-text-primary)] shadow-[var(--w11-elevation-flyout)] animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      />
    </Win11Scope>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
