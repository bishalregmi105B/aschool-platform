"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { ErrorState } from "@/components/ui/empty-state";

/**
 * Shared plumbing for AOS home widgets.
 *
 * Widgets are plain client components that fetch their own data via
 * react-query (keys namespaced ["aos-widget", key]) and render 11.css /
 * page-kit visuals. They never know where they are mounted: the dashboard
 * board renders them inside AOS windows, the WidgetsPanel flyout renders
 * compact variants.
 */

/** Props every widget component accepts. */
export interface AOSWidgetProps {
  /** Compact rendering for the WidgetsPanel flyout (fewer rows, tighter grid). */
  compact?: boolean;
  /**
   * Host-provided route opener. When absent, widgets render plain anchors —
   * inside an AOS window the WindowManager's anchor interception converts
   * the click into a new window, so no explicit callback is needed there.
   */
  onOpenRoute?: (route: string) => void;
}

/**
 * A widget's route link. Rendered as a real anchor so the WindowManager
 * (handleInternalAnchorNavigation) can intercept the click and open the
 * target as an AOS window. Hosts outside a window (e.g. the WidgetsPanel
 * flyout) pass `onOpenRoute` to handle the click themselves; the anchor
 * remains as the accessible/progressive-enhancement fallback.
 */
export function WidgetLink({
  href,
  onOpenRoute,
  onNavigate,
  className,
  style,
  title,
  children,
}: {
  href: string;
  onOpenRoute?: (route: string) => void;
  /** Called after a successful onOpenRoute navigation (e.g. to close a flyout). */
  onNavigate?: () => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      title={title}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        // Let modified clicks (new tab / window) behave natively.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (onOpenRoute) {
          e.preventDefault();
          onOpenRoute(href);
          onNavigate?.();
        }
      }}
    >
      {children}
    </Link>
  );
}

/** Compact inline error block used by widgets when their query fails. */
export function WidgetError({
  title = "Couldn't load this widget",
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <ErrorState title={title} body={body} onRetry={onRetry} size="sm" className="py-6" />
  );
}

/** Human-readable byte size (matches the files module's formatter). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Today's date as YYYY-MM-DD (server endpoints expect this format). */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
