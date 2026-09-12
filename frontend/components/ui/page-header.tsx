"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * PageHeader — the top of every dashboard screen.
 *
 * Standardizes what was 165 slightly different headers: breadcrumb, bilingual
 * title, one primary action, and an overflow for the secondary verbs
 * (export/print/import/settings) that used to be scattered as loose buttons.
 */

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "outline" | "destructive";
  disabled?: boolean;
}

export interface PageHeaderProps {
  title: string;
  /** Nepali title, shown under the English one when present. */
  titleNepali?: string | null;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  primaryAction?: PageHeaderAction;
  /** Rendered inline before the overflow menu. Keep to two. */
  actions?: PageHeaderAction[];
  /** Collapsed into a ⋯ menu. */
  overflowActions?: PageHeaderAction[];
  /** Stat chips, tab bar, or anything that belongs under the title. */
  children?: React.ReactNode;
  className?: string;
}

function ActionButton({ action }: { action: PageHeaderAction }) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
      {action.label}
    </>
  );
  const variant =
    action.tone === "outline"
      ? "outline"
      : action.tone === "destructive"
        ? "destructive"
        : "default";

  if (action.href) {
    return (
      <Button asChild size="sm" variant={variant}>
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={action.onClick}
      disabled={action.disabled}
    >
      {content}
    </Button>
  );
}

function PageHeader({
  title,
  titleNepali,
  description,
  breadcrumbs,
  primaryAction,
  actions,
  overflowActions,
  children,
  className,
}: PageHeaderProps) {
  const [overflowOpen, setOverflowOpen] = React.useState(false);

  return (
    <header className={cn("space-y-2", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="win11-breadcrumb flex flex-wrap items-center text-[11px]">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center">
                {crumb.href ? (
                  <Link href={crumb.href} className="breadcrumb-item">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="breadcrumb-item current" aria-current="page">
                    {crumb.label}
                  </span>
                )}
                {i < breadcrumbs.length - 1 && (
                  <span aria-hidden="true" className="breadcrumb-separator">
                    /
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title truncate leading-tight text-[var(--w11-text-primary)]">{title}</h1>
          {titleNepali && (
            <p className="font-nepali text-[12px] text-[var(--w11-text-secondary)]">
              {titleNepali}
            </p>
          )}
          {description && (
            <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-[var(--w11-text-secondary)]">
              {description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions?.map((action) => (
            <ActionButton
              key={action.label}
              action={{ ...action, tone: action.tone ?? "outline" }}
            />
          ))}
          {primaryAction && <ActionButton action={primaryAction} />}
          {overflowActions && overflowActions.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOverflowOpen((v) => !v)}
                aria-label="More actions"
                aria-expanded={overflowOpen}
              >
                <span aria-hidden="true">⋯</span>
              </Button>
              {overflowOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOverflowOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-1 w-48 rounded-[var(--w11-radius-lg)] border border-[var(--w11-acrylic-border)] bg-[var(--w11-surface-flyout)] p-1 shadow-[var(--w11-elevation-flyout)] backdrop-blur-[24px] backdrop-saturate-[1.8]">
                    {overflowActions.map((action) => {
                      const Icon = action.icon;
                      const inner = (
                        <>
                          {Icon && <Icon className="h-3.5 w-3.5" />}
                          {action.label}
                        </>
                      );
                      return action.href ? (
                        <Link
                          key={action.label}
                          href={action.href}
                          className="flex items-center gap-2 rounded-[var(--w11-radius-sm)] px-2 py-1.5 text-[12px] text-[var(--w11-text-primary)] hover:bg-[var(--w11-control-hover)]"
                          onClick={() => setOverflowOpen(false)}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          key={action.label}
                          type="button"
                          disabled={action.disabled}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-[var(--w11-radius-sm)] px-2 py-1.5 text-left text-[12px] text-[var(--w11-text-primary)] hover:bg-[var(--w11-control-hover)] disabled:opacity-50",
                            action.tone === "destructive" && "text-[#c42b1c]"
                          )}
                          onClick={() => {
                            setOverflowOpen(false);
                            action.onClick?.();
                          }}
                        >
                          {inner}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {children}
    </header>
  );
}

export { PageHeader };
