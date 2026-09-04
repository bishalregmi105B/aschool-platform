"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  usePluginWidgets,
  useWidgetData,
} from "@/lib/plugin-widgets/usePluginWidgets";
import { resolveComponentWidget } from "@/lib/plugin-widgets/registry";
import type { WidgetSpec } from "@/lib/plugin-widgets/types";
import type { BindingScope, WidgetContext } from "@/lib/plugin-widgets/bindings";
import {
  ChartWidget,
  ListWidget,
  QuickActionWidget,
  StatGroupWidget,
  TablePanelWidget,
} from "./renderers";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonStat } from "@/components/ui/skeleton";

/**
 * WidgetSlot + PluginWidget — the host side of the widget contract.
 *
 * A page declares a slot (`<WidgetSlot id="dashboard.main" />`) and every
 * installed plugin's widgets for that slot appear, in the order the server
 * returned. The page does not know which plugins exist, and a plugin cannot
 * render anywhere the host has not opened a slot.
 *
 * Failure is contained per widget: an error boundary around each one means a
 * plugin whose endpoint 500s degrades to a single card showing "couldn't load"
 * instead of blanking the dashboard.
 */

class WidgetErrorBoundary extends React.Component<
  { title: string; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Report, but never rethrow: one bad widget must not unmount the page.
    console.error("Widget crashed:", this.props.title, error);
  }

  render() {
    if (this.state.failed) {
      return (
        <Card>
          <CardContent className="p-3.5">
            <p className="text-[12px] font-medium">{this.props.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              This widget stopped working and was disabled for now. The rest of the
              page is unaffected.
            </p>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

export interface PluginWidgetProps {
  widget: WidgetSpec;
  /** Host-provided values the widget may bind to (`$context.*`). */
  context?: WidgetContext;
  className?: string;
}

export function PluginWidget({ widget, context, className }: PluginWidgetProps) {
  const { user } = useAuth();
  const routeParams = useParams();

  const scope: BindingScope = React.useMemo(
    () => ({
      context,
      route: (routeParams ?? {}) as WidgetContext,
      schoolId: user?.school_id ?? null,
      userId: user?.id ?? null,
      role: user?.role ?? null,
    }),
    [context, routeParams, user]
  );

  const { data, isLoading, error, refetch, unresolved } = useWidgetData(
    widget,
    scope
  );

  const language = user?.preferred_language ?? undefined;

  const rendererProps = {
    widget,
    data: unresolved ? null : data,
    scope,
    isLoading,
    error,
    onRetry: refetch,
    language,
  };

  let body: React.ReactNode;

  if (widget.renderer === "component") {
    const Component = resolveComponentWidget(widget.component);
    if (!Component) {
      // The plugin asked for a component this app build does not ship. Say so
      // rather than rendering an empty card the user cannot explain.
      body = (
        <Card>
          <CardContent className="p-3.5">
            <p className="text-[12px] font-medium">{widget.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Needs a newer version of the web app.
            </p>
          </CardContent>
        </Card>
      );
    } else {
      body = (
        <Component
          widget={widget}
          context={{ ...context, rows: data } as never}
        />
      );
    }
  } else {
    switch (widget.type) {
      case "stat-group":
      case "dashboard-card":
        body = <StatGroupWidget {...rendererProps} />;
        break;
      case "table-panel":
        body = <TablePanelWidget {...rendererProps} />;
        break;
      case "list":
        body = <ListWidget {...rendererProps} />;
        break;
      case "chart":
        body = <ChartWidget {...rendererProps} />;
        break;
      case "quick-action":
        body = <QuickActionWidget {...rendererProps} />;
        break;
      default:
        // mobile-card / website-section / pdf.block are other surfaces' types;
        // rendering nothing on web is correct, not an error.
        body = null;
    }
  }

  if (!body) return null;

  return (
    <div className={className} data-widget-id={widget.id}>
      <WidgetErrorBoundary title={widget.title}>{body}</WidgetErrorBoundary>
    </div>
  );
}

/** Tailwind column spans for the 12-column dashboard grid. */
const SPAN: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

export interface WidgetSlotProps {
  /** Host-owned slot id, e.g. `dashboard.main`. */
  id: string;
  context?: WidgetContext;
  /** Rendered when no installed plugin contributes to this slot. */
  fallback?: React.ReactNode;
  /** Wraps children in the 12-column grid (default true for dashboard slots). */
  grid?: boolean;
  className?: string;
}

export function WidgetSlot({
  id,
  context,
  fallback,
  grid = true,
  className,
}: WidgetSlotProps) {
  const { widgets, isLoading } = usePluginWidgets(id);

  if (isLoading) {
    return (
      <div
        className={cn(
          grid && "grid grid-cols-1 gap-3 lg:grid-cols-12",
          className
        )}
      >
        {[6, 6, 4, 8].map((span, i) => (
          <SkeletonStat key={i} className={cn(grid && SPAN[span])} />
        ))}
      </div>
    );
  }

  if (widgets.length === 0) return <>{fallback ?? null}</>;

  return (
    <div
      className={cn(grid && "grid grid-cols-1 gap-3 lg:grid-cols-12", className)}
    >
      {widgets.map((widget) => (
        <PluginWidget
          key={widget.id}
          widget={widget}
          context={context}
          className={cn(grid && SPAN[widget.size?.default?.w ?? 6])}
        />
      ))}
    </div>
  );
}
