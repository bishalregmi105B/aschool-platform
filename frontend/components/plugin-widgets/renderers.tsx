"use client";

import * as React from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonList, SkeletonStat, SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  formatValue,
  interpolate,
  resolveToken,
  type BindingScope,
} from "@/lib/plugin-widgets/bindings";
import type {
  ColumnSpec,
  ListItemSpec,
  StatItemSpec,
  WidgetSpec,
} from "@/lib/plugin-widgets/types";

/**
 * Generic renderers for `renderer: spec` widgets.
 *
 * One component per widget `type`. Adding a spec widget to any plugin requires
 * no frontend deploy — that is the point of the contract. These components own
 * the loading/empty/error presentation so 40 plugins cannot each invent their
 * own.
 */

function icon(name?: string) {
  if (!name) return undefined;
  const Component = (Icons as unknown as Record<string, Icons.LucideIcon>)[name];
  return Component;
}

const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
  primary: "text-primary",
  muted: "text-foreground",
};

export interface RendererProps {
  widget: WidgetSpec;
  data: unknown;
  scope: BindingScope;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  language?: string;
}

/** Shared frame: title row, states, and the "open X" footer link. */
function WidgetShell({
  widget,
  isLoading,
  error,
  onRetry,
  isEmpty,
  loadingNode,
  children,
  className,
}: {
  widget: WidgetSpec;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  loadingNode: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const link = widget.spec.link;
  const empty = widget.states?.empty;

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{widget.title}</CardTitle>
        {link && (
          <Link
            href={link.href}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {link.label}
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          loadingNode
        ) : error ? (
          <ErrorState
            size="sm"
            title={widget.states?.error?.title ?? "Couldn't load this"}
            body={error}
            onRetry={widget.states?.error?.retry === false ? undefined : onRetry}
          />
        ) : isEmpty ? (
          <EmptyState
            size="sm"
            title={empty?.title ?? "Nothing to show"}
            body={empty?.body}
            action={
              empty?.action
                ? { label: empty.action.label, href: empty.action.href }
                : undefined
            }
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function StatGroupWidget({
  widget,
  data,
  scope,
  isLoading,
  error,
  onRetry,
  language,
}: RendererProps) {
  const items: StatItemSpec[] = widget.spec.items ?? [];
  const bound = { ...scope, payload: data };
  const values = items.map((item) => resolveToken(item.value, bound));
  const isEmpty =
    !isLoading &&
    !error &&
    (data === undefined ||
      data === null ||
      values.every((v) => v === null || v === undefined));

  return (
    <WidgetShell
      widget={widget}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      loadingNode={
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {items.map((_, i) => (
            <SkeletonStat key={i} className="border-0 p-0" />
          ))}
        </div>
      }
    >
      <div
        className={cn(
          "grid gap-3",
          items.length <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
        )}
      >
        {items.map((item, i) => {
          const Icon = icon(item.icon);
          return (
            <div key={`${item.label}-${i}`} className="space-y-0.5">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {Icon && <Icon className="h-3 w-3" />}
                {item.label}
              </div>
              <p
                className={cn(
                  "text-xl font-semibold leading-tight",
                  TONE_TEXT[item.tone ?? "muted"]
                )}
              >
                {formatValue(values[i], item.format, language)}
              </p>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

function cellNode(
  column: ColumnSpec,
  row: Record<string, unknown>,
  scope: BindingScope,
  language?: string
) {
  const raw = row[column.key];
  if (column.format === "status_pill") {
    const tone = column.map?.[String(raw ?? "").toLowerCase()];
    return <StatusPill status={String(raw ?? "")} tone={tone} language={language} />;
  }
  const text = formatValue(raw, column.format, language);
  if (column.link) {
    const href = interpolate(column.link, { ...scope, payload: row });
    return (
      <Link href={href} className="text-primary hover:underline">
        {text}
      </Link>
    );
  }
  return text;
}

export function TablePanelWidget({
  widget,
  data,
  scope,
  isLoading,
  error,
  onRetry,
  language,
}: RendererProps) {
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const specColumns = widget.spec.columns ?? [];

  const columns: Column<Record<string, unknown>>[] = specColumns.map((c) => ({
    key: c.key,
    label: language === "ne" && c.label_ne ? c.label_ne : c.label,
    sortable: c.sortable,
    align: c.align,
    width: c.width,
    render: (row) => cellNode(c, row, scope, language),
    value: (row) => {
      const raw = row[c.key];
      return typeof raw === "number" || typeof raw === "string" ? raw : null;
    },
  }));

  return (
    <WidgetShell
      widget={widget}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!isLoading && !error && rows.length === 0}
      loadingNode={<SkeletonTable columns={columns.length || 4} rows={5} />}
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row, ) =>
          String(row.id ?? row.student_id ?? JSON.stringify(row).slice(0, 40))
        }
        dense
        exportFileName={
          widget.spec.export?.csv ? widget.key.replace(/_/g, "-") : undefined
        }
        empty={{
          title: widget.states?.empty?.title ?? "No rows",
          body: widget.states?.empty?.body,
        }}
      />
    </WidgetShell>
  );
}

export function ListWidget({
  widget,
  data,
  scope,
  isLoading,
  error,
  onRetry,
  language,
}: RendererProps) {
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const item: ListItemSpec | undefined = widget.spec.item;

  return (
    <WidgetShell
      widget={widget}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!isLoading && !error && rows.length === 0}
      loadingNode={<SkeletonList rows={4} />}
    >
      <ul className="divide-y">
        {rows.map((row, index) => {
          const bound = { ...scope, payload: row };
          const title = item?.title ? resolveToken(item.title, bound) : null;
          const subtitle = item?.subtitle
            ? interpolate(item.subtitle, bound)
            : null;
          const meta = item?.meta ? resolveToken(item.meta, bound) : null;
          const stamp = item?.timestamp
            ? resolveToken(item.timestamp, bound)
            : null;
          const badgeValue = item?.badge?.value
            ? resolveToken(item.badge.value, bound)
            : null;
          const href = item?.link ? interpolate(item.link, bound) : null;

          const body = (
            <div className="flex items-start gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">
                  {String(title ?? "—")}
                </p>
                {subtitle && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {meta !== null && meta !== undefined && (
                  <span className="text-[12px] font-medium">
                    {formatValue(meta, item?.meta_format, language)}
                  </span>
                )}
                {badgeValue !== null && badgeValue !== undefined && (
                  <StatusPill
                    status={String(badgeValue)}
                    tone={item?.badge?.map?.[String(badgeValue).toLowerCase()]}
                    language={language}
                  />
                )}
                {stamp !== null && stamp !== undefined && !badgeValue && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatValue(stamp, item?.timestamp_format ?? "relative", language)}
                  </span>
                )}
              </div>
            </div>
          );

          return (
            <li key={String(row.id ?? index)}>
              {href ? (
                <Link href={href} className="block hover:bg-muted/50">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

export function QuickActionWidget({ widget, language }: RendererProps) {
  const Icon = icon(widget.spec.icon);
  const tone = widget.spec.tone ?? "primary";
  const href = widget.spec.href ?? "#";
  void language;

  return (
    <Button
      asChild
      variant={tone === "muted" ? "outline" : "default"}
      className="h-auto w-full justify-start gap-2 py-3"
    >
      <Link href={href}>
        {Icon && <Icon className="h-4 w-4" />}
        <span className="text-[12px] font-medium">
          {widget.spec.label ?? widget.title}
        </span>
      </Link>
    </Button>
  );
}

/**
 * Minimal bar/line chart from a spec, drawn with divs and SVG.
 *
 * No chart library: the four shapes plugin dashboards actually need are cheap to
 * draw, and adding recharts would put 90 kB on every dashboard for widgets most
 * schools never place.
 */
export function ChartWidget({
  widget,
  data,
  isLoading,
  error,
  onRetry,
  language,
}: RendererProps) {
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const xKey = widget.spec.x?.key ?? "label";
  const series = widget.spec.series ?? [];
  const primary = series[0];

  const sorted = React.useMemo(() => {
    const sortSpec = widget.spec.sort;
    if (!sortSpec) return rows;
    const factor = sortSpec.direction === "desc" ? -1 : 1;
    return [...rows].sort(
      (a, b) => (Number(a[sortSpec.by]) - Number(b[sortSpec.by])) * factor
    );
  }, [rows, widget.spec.sort]);

  const max = Math.max(
    1,
    ...sorted.map((row) => Number(primary ? row[primary.key] : 0) || 0)
  );

  return (
    <WidgetShell
      widget={widget}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!isLoading && !error && sorted.length === 0}
      loadingNode={<SkeletonList rows={5} />}
    >
      <div className="space-y-1.5">
        {sorted.slice(0, 12).map((row, i) => {
          const value = Number(primary ? row[primary.key] : 0) || 0;
          const pct = Math.round((value / max) * 100);
          return (
            <div key={String(row[xKey] ?? i)} className="space-y-0.5">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="truncate pr-2">{String(row[xKey] ?? "—")}</span>
                <span className="shrink-0 font-medium">
                  {formatValue(value, primary?.format, language)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}
