"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * AOS page kit — the aos-app page anatomy as reusable pieces.
 *
 * Every dashboard module renders inside an AOS window whose root already
 * carries the `win11` class, so all 11.css tokens and component classes are
 * available. These components encode the patterns aos-app uses in its app
 * bodies (window-content header + command row, KPI stat grids, Fluent
 * panels, form groupboxes, split layouts) so module rewrites stay
 * consistent.
 */

/**
 * Standard page wrapper for module content rendered inside an AOS window.
 * Full-height flex column: header stays pinned, body scrolls.
 */
export function AOSPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("aos-app-page flex flex-col h-full", className)}>
      {children}
    </div>
  );
}

/**
 * Window-content header: app title + subtitle on the left, action buttons
 * (commandbar) on the right. Mirrors the aos-app app-header pattern.
 */
export function AOSPageHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--w11-border-subtle)]",
        className
      )}
      style={{ flexShrink: 0 }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && <div style={{ flexShrink: 0 }}>{icon}</div>}
        <div className="min-w-0">
          <h1
            className="text-[16px] font-semibold leading-tight truncate"
            style={{ color: "var(--w11-text-primary)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-[12px] leading-tight truncate"
              style={{ color: "var(--w11-text-secondary)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

/** Scrollable body region of a module page. */
export function AOSPageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-4 min-h-0", className)}>
      {children}
    </div>
  );
}

/**
 * KPI stat card — aos-app pattern: uppercase label, big colored number,
 * optional denominator and footnote.
 */
export function KpiCard({
  label,
  value,
  denominator,
  footnote,
  color,
  icon,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  denominator?: React.ReactNode;
  footnote?: React.ReactNode;
  color?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const valueColor = color || "var(--w11-accent)";
  return (
    <div className={cn("win11-card", className)} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span
        className="text-[11px] font-semibold uppercase"
        style={{ color: "var(--w11-text-secondary)" }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        {icon}
        <span className="text-[28px] font-bold leading-none" style={{ color: valueColor }}>
          {value}
        </span>
        {denominator && (
          <span className="text-[13px]" style={{ color: "var(--w11-text-tertiary)" }}>
            {denominator}
          </span>
        )}
      </div>
      {footnote && (
        <span className="text-[11px]" style={{ color: "var(--w11-text-secondary)" }}>
          {footnote}
        </span>
      )}
    </div>
  );
}

/** Auto-fit KPI grid — the aos-app `repeat(auto-fit, minmax(150px, 1fr))` pattern. */
export function StatGrid({
  children,
  min = 150,
  className,
}: {
  children: React.ReactNode;
  min?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("mb-4", className)}
      style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: "12px" }}
    >
      {children}
    </div>
  );
}

/**
 * Toolbar row for filters/search between header and content. Children are
 * typically inputs/selects (auto-styled Fluent) and `commandbar-button`s.
 */
export function FilterCommandBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 mb-4", className)}
      style={{ flexShrink: 0 }}
    >
      {children}
    </div>
  );
}

/** A titled Fluent panel — win11-card with a compact header row. */
export function DataPanel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn("win11-card", className)}
      style={{ padding: 0, overflow: "hidden" }}
    >
      {(title || actions) && (
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[var(--w11-border-subtle)]"
        >
          {title && (
            <h2
              className="text-[13px] font-semibold"
              style={{ color: "var(--w11-text-primary)" }}
            >
              {title}
            </h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Form groupbox — fieldset-based Fluent container for form sections. */
export function FormSection({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  if (title) {
    return (
      <fieldset className={cn("win11-card", className)}>
        <legend className="text-[13px] font-semibold" style={{ color: "var(--w11-text-primary)" }}>
          {title}
        </legend>
        {children}
      </fieldset>
    );
  }
  return <div className={cn("win11-card", className)}>{children}</div>;
}

/**
 * Master/detail split that stacks below 768px (11.css aos-responsive-split).
 */
export function DetailSplit({
  sidebar,
  children,
  sidebarWidth = "320px",
  className,
}: {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth?: string;
  className?: string;
}) {
  if (!sidebar) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div className={cn("aos-responsive-split gap-4", className)}>
      <div style={{ flexBasis: sidebarWidth, flexShrink: 0 }}>{sidebar}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

/**
 * Status chip — maps a semantic status onto win11-chip variants.
 * Unknown statuses fall back to subtle.
 */
const CHIP_TONE_MAP: Record<string, string> = {
  // success-ish
  active: "success",
  paid: "success",
  present: "success",
  completed: "success",
  approved: "success",
  pass: "success",
  graduated: "success",
  resolved: "success",
  published: "success",
  // warning-ish
  pending: "warning",
  partial: "warning",
  late: "warning",
  due: "warning",
  on_leave: "warning",
  hold: "warning",
  // error-ish
  overdue: "error",
  failed: "error",
  absent: "error",
  inactive: "error",
  dropped_out: "error",
  rejected: "error",
  cancelled: "error",
  fail: "error",
  suspended: "error",
};

export function StatusChip({
  status,
  label,
  className,
}: {
  status: string;
  label?: React.ReactNode;
  className?: string;
}) {
  const tone = CHIP_TONE_MAP[String(status).toLowerCase()] || "subtle";
  return (
    <span className={cn("win11-chip", tone, className)}>
      {label ?? humanizeStatus(status)}
    </span>
  );
}

function humanizeStatus(status: string): string {
  return status
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Standard module loading state (centered Fluent spinner). */
export function AOSModuleLoadingState({ label = "Loading module…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="win11-spinner" />
      <span className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

/** Standard module empty state. */
export function AOSEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      {icon && <div style={{ opacity: 0.5, marginBottom: 4 }}>{icon}</div>}
      <div className="text-[14px] font-semibold" style={{ color: "var(--w11-text-primary)" }}>
        {title}
      </div>
      {description && (
        <div className="text-[12px]" style={{ color: "var(--w11-text-secondary)" }}>
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
