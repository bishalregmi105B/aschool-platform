import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * EmptyState / ErrorState / LockedState — the three "no rows" screens.
 *
 * The rule this encodes: an empty surface must say WHY it is empty and offer
 * the one action that fills it. "No data" with a shrug costs a support ticket;
 * "No attendance marked today — Mark now" does not.
 */

export interface EmptyStateProps {
  /** Lucide icon component, rendered at 24px inside a tinted circle. */
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  /** One sentence explaining why this is empty. Not a paragraph. */
  body?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
  /** `sm` for inside a card/widget, `md` for a full page region. */
  size?: "sm" | "md";
}

function ActionButton({
  action,
  variant,
}: {
  action: NonNullable<EmptyStateProps["action"]>;
  variant?: "default" | "outline";
}) {
  if (action.href) {
    return (
      <Button asChild variant={variant} size="sm">
        <a href={action.href}>{action.label}</a>
      </Button>
    );
  }
  return (
    <Button variant={variant} size="sm" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        size === "md" ? "px-6 py-12" : "px-4 py-8",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-[var(--w11-control-hover,rgba(0,0,0,0.05))] text-[var(--w11-text-secondary,#5d5d5d)]",
            size === "md" ? "mb-1 h-12 w-12" : "h-10 w-10"
          )}
        >
          <Icon className={size === "md" ? "h-6 w-6" : "h-5 w-5"} />
        </div>
      )}
      <p className={cn("font-semibold text-[var(--w11-text-primary,#1b1b1b)]", size === "md" ? "text-sm" : "text-[13px]")}>
        {title}
      </p>
      {body && (
        <p className="max-w-xs text-[12px] leading-relaxed text-[var(--w11-text-secondary,#5d5d5d)]">
          {body}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex items-center gap-2">
          {action && <ActionButton action={action} />}
          {secondaryAction && (
            <ActionButton action={secondaryAction} variant="outline" />
          )}
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  /** The real failure, when we have one. Never a raw stack trace. */
  body?: string;
  onRetry?: () => void;
  className?: string;
  size?: "sm" | "md";
}

function ErrorState({
  title = "Something went wrong",
  body,
  onRetry,
  className,
  size = "md",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        size === "md" ? "px-6 py-12" : "px-4 py-8",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-[rgba(196,43,28,0.1)] text-[#c42b1c]",
          size === "md" ? "mb-1 h-12 w-12" : "h-10 w-10"
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={size === "md" ? "h-6 w-6" : "h-5 w-5"}
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </div>
      <p className={cn("font-semibold text-[var(--w11-text-primary,#1b1b1b)]", size === "md" ? "text-sm" : "text-[13px]")}>
        {title}
      </p>
      {body && (
        <p className="max-w-sm text-[12px] leading-relaxed text-[var(--w11-text-secondary,#5d5d5d)]">
          {body}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export interface LockedStateProps {
  /** Plugin display name, e.g. "AI Suite". */
  feature: string;
  body?: string;
  onInstall?: () => void;
  installing?: boolean;
  marketplaceHref?: string;
  className?: string;
}

/**
 * The plugin-gate placeholder. Kept honest: it names the plugin, says what
 * installing does, and never claims a paid plugin is free.
 */
function LockedState({
  feature,
  body,
  onInstall,
  installing,
  marketplaceHref = "/dashboard/marketplace",
  className,
}: LockedStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--w11-radius-xl)] border-2 border-dashed border-[var(--w11-border-default,rgba(0,0,0,0.12))] px-6 py-10 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--w11-accent-light,rgba(0,103,192,0.12))] text-[var(--w11-accent,#0067c0)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--w11-text-primary,#1b1b1b)]">{feature} — not installed</p>
        <p className="mx-auto max-w-xs text-[12px] leading-relaxed text-[var(--w11-text-secondary,#5d5d5d)]">
          {body ??
            `Enable the ${feature} plugin to use this page. Free plugins activate instantly; paid ones start a trial.`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onInstall && (
          <Button size="sm" onClick={onInstall} disabled={installing}>
            {installing ? "Installing…" : "Install"}
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <a href={marketplaceHref}>View in marketplace</a>
        </Button>
      </div>
    </div>
  );
}

export { EmptyState, ErrorState, LockedState };
