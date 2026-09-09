"use client";
/**
 * Form primitives — one visual language for every form in the product.
 *
 * Why: forms across the dashboard were hand-rolled (Label + Input + spacing
 * divs), so hints, required marks, errors and column widths drifted page to
 * page and labels were English-only. These primitives bundle label (EN+NE
 * via useI18n), hint, error and required marker, and give forms a wide,
 * airy layout that uses the screen (the old max-w-2xl centered forms wasted
 * half the canvas on data-entry-heavy school forms).
 *
 * Intent: a calm school-office register — quiet borders, generous targets,
 * one accent. Hints teach without tooltips (many users are first-generation
 * computer users).
 */
import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Label } from "@/components/ui/label";

// ── FormField ──────────────────────────────────────────────────────────────
// <FormField label="Phone" ne="फोन" hint="Mobile number of the guardian" required error={...}>
//   <Input … />
// </FormField>
export function FormField({
  label,
  ne,
  hint,
  neHint,
  error,
  required,
  className,
  children,
  htmlFor,
}: {
  label: string;
  /** Nepali label (rendered when the header toggle is on नेपाली). */
  ne?: string;
  hint?: string;
  neHint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label htmlFor={htmlFor} className="text-[12px]">
        {ne ? t(label, ne) : label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {neHint ? t(hint, neHint) : hint}
        </p>
      ) : null}
    </div>
  );
}

// ── FormSection ────────────────────────────────────────────────────────────
// A titled group inside a wide form: icon + bilingual title + description.
export function FormSection({
  title,
  ne,
  description,
  neDescription,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  ne?: string;
  description?: string;
  neDescription?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section
      className={cn(
        "rounded-lg border bg-card overflow-hidden",
        className
      )}
    >
      <header className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b bg-muted/40">
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold leading-tight">
            {ne ? t(title, ne) : title}
          </h3>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {neDescription ? t(description, neDescription) : description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

// ── FormGrid ───────────────────────────────────────────────────────────────
// Wide responsive field grid. cols=2 → 1 col mobile, 2 col ≥sm; cols=3 → 3 ≥lg.
// Schools run these forms on everything from 720p lab desktops to wide
// monitors, so the grid stretches — no artificial max-width.
export function FormGrid({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}) {
  const colClass =
    cols === 1
      ? "grid-cols-1"
      : cols === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : cols === 3
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4";
  return <div className={cn("grid gap-x-4 gap-y-4", colClass, className)}>{children}</div>;
}

/** Span helper for a field that should take the full row inside FormGrid. */
export function FormFull({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("col-span-full", className)}>{children}</div>;
}

// ── FormActions ────────────────────────────────────────────────────────────
// Sticky action bar: primary actions right-aligned, secondary left. Stays
// reachable at the bottom of long forms without scrolling hunting.
export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-1 mt-6 flex items-center justify-end gap-2 rounded-lg border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      {children}
    </div>
  );
}
