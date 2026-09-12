"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Win11Scope } from "@/lib/win11-scope";
import { Button } from "./button";

/**
 * Sheet — the right-edge drawer for row detail.
 *
 * Row detail used to mean a full navigation to `/students/[id]`, losing the
 * list's scroll position and filters. A drawer keeps the list behind it, and
 * `onPrev`/`onNext` let a user walk a filtered set (checking 30 fee defaulters
 * in a row) without ever returning to the table.
 *
 * Surface: Fluent acrylic flyout — `--w11-surface-flyout` over a 30px blur,
 * 1px acrylic border on the inner (left) edge, window elevation, and a radius
 * on the inner edge only. The portaled subtree is re-scoped with
 * `<Win11Scope>` so the vendored 11.css tokens resolve.
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "win11-modal-backdrop fixed inset-0 z-[99999] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** 480px default; `lg` for two-column detail; `xl` for editors. */
  size?: "default" | "lg" | "xl";
}

const SIZES = {
  default: "sm:max-w-[480px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[840px]",
};

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, size = "default", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Win11Scope>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-y-0 right-0 z-[100000] flex h-full w-full flex-col rounded-l-[var(--w11-radius-xl)] border-l border-[var(--w11-acrylic-border)] bg-[var(--w11-surface-flyout)] text-[var(--w11-text-primary)] shadow-[var(--w11-elevation-window)] backdrop-blur-[30px] backdrop-saturate-[1.8] transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          SIZES[size],
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-[var(--w11-radius-sm)] text-[var(--w11-text-secondary)] transition-colors hover:bg-[var(--w11-control-hover)] hover:text-[var(--w11-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w11-accent)]">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </Win11Scope>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "truncate text-sm font-semibold leading-tight text-[var(--w11-text-primary,#1b1b1b)]",
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[11px] text-[var(--w11-text-secondary,#5d5d5d)]", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  /** Enables ←/→ walking of the current row set. */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** Sticky footer, for Save/Discard on an editable drawer. */
  footer?: React.ReactNode;
  size?: SheetContentProps["size"];
  children: React.ReactNode;
}

/**
 * The composed drawer most screens want: header, scrollable body, sticky
 * footer, and keyboard row navigation.
 */
function DetailSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  onPrev,
  onNext,
  hasPrev = true,
  hasNext = true,
  footer,
  size,
  children,
}: DetailSheetProps) {
  React.useEffect(() => {
    if (!open || (!onPrev && !onNext)) return;
    const handler = (e: KeyboardEvent) => {
      // Never steal arrows from a field the user is typing in.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (e.key === "ArrowRight" && hasNext) onNext?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onPrev, onNext, hasPrev, hasNext]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size={size}>
        <div className="flex items-start gap-2 border-b border-[var(--w11-border-subtle)] px-4 py-3 pr-10">
          <div className="min-w-0 flex-1">
            <SheetTitle>{title}</SheetTitle>
            {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
          </div>
          {(onPrev || onNext) && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={onPrev}
                disabled={!hasPrev}
                aria-label="Previous record"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={onNext}
                disabled={!hasNext}
                aria-label="Next record"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--w11-border-subtle)] px-4 py-3">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
  DetailSheet,
};
