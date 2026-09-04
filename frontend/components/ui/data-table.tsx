"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Checkbox } from "./checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { SkeletonTable } from "./skeleton";
import { EmptyState, ErrorState } from "./empty-state";
import { Pagination, type PaginationMeta } from "./pagination";

/**
 * DataTable — the one table.
 *
 * Every list screen in this app had hand-rolled its own sorting, its own
 * client-side pagination over a full fetch, and its own bulk-select. 14 of them
 * paginated in the browser after downloading every row, which is why the
 * students page took 6 seconds at 2,000 students.
 *
 * This component owns: column visibility, sort (server or client), row
 * selection with a bulk action bar, search, pagination, CSV export, sticky
 * header, empty/error/loading states, and keyboard row navigation. Server mode
 * is the default because school data outgrows the browser.
 */

export interface Column<T> {
  key: string;
  label: string;
  /** Custom cell. Omit to render `String(row[key])`. */
  render?: (row: T, index: number) => React.ReactNode;
  /** Value used for client-side sorting and CSV export. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: number | string;
  /** Hidden by default but toggleable in the column menu. */
  hidden?: boolean;
  /** Excluded from CSV export (e.g. an actions column). */
  noExport?: boolean;
  className?: string;
}

export interface BulkAction<T> {
  key: string;
  label: string;
  tone?: "default" | "danger";
  onClick: (rows: T[]) => void | Promise<void>;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable row identity. Required for selection to survive re-sorts. */
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;

  /** Server pagination. Omit both to render every row. */
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  /** Provide to sort on the server; omit for client-side sorting. */
  sort?: { key: string; direction: "asc" | "desc" } | null;
  onSortChange?: (sort: { key: string; direction: "asc" | "desc" }) => void;

  /** Renders a search box above the table. */
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  selectable?: boolean;
  bulkActions?: BulkAction<T>[];

  onRowClick?: (row: T) => void;
  /** Highlights the row (e.g. the one open in a drawer). */
  activeRowKey?: string | null;

  empty?: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    body?: string;
    action?: { label: string; onClick?: () => void; href?: string };
  };

  /** Adds an export button; filename gets a .csv suffix. */
  exportFileName?: string;
  /** Right-aligned toolbar content (page-specific filters, actions). */
  toolbar?: React.ReactNode;
  className?: string;
  /** Compact row height for dense operational grids. */
  dense?: boolean;
}

function defaultValue<T>(row: T, column: Column<T>): string | number | null {
  if (column.value) return column.value(row) ?? null;
  const raw = (row as Record<string, unknown>)[column.key];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" || typeof raw === "string") return raw;
  return String(raw);
}

function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const exportable = columns.filter((c) => !c.noExport);
  const escape = (value: string | number | null) => {
    const s = value === null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = exportable.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => exportable.map((c) => escape(defaultValue(row, c))).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  pagination,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  searchable,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  selectable,
  bulkActions,
  onRowClick,
  activeRowKey,
  empty,
  exportFileName,
  toolbar,
  className,
  dense,
}: DataTableProps<T>) {
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(
    () => new Set(columns.filter((c) => c.hidden).map((c) => c.key))
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [clientSort, setClientSort] = React.useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = React.useState(false);

  const serverSorted = Boolean(onSortChange);
  const activeSort = serverSorted ? sort ?? null : clientSort;

  const visibleColumns = columns.filter((c) => !hiddenKeys.has(c.key));

  const displayRows = React.useMemo(() => {
    if (serverSorted || !clientSort) return rows;
    const column = columns.find((c) => c.key === clientSort.key);
    if (!column) return rows;
    const factor = clientSort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = defaultValue(a, column);
      const bv = defaultValue(b, column);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * factor;
      }
      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * factor;
    });
  }, [rows, clientSort, serverSorted, columns]);

  const toggleSort = (column: Column<T>) => {
    if (!column.sortable) return;
    const next: { key: string; direction: "asc" | "desc" } =
      activeSort?.key === column.key && activeSort.direction === "asc"
        ? { key: column.key, direction: "desc" }
        : { key: column.key, direction: "asc" };
    if (serverSorted) onSortChange?.(next);
    else setClientSort(next);
  };

  const allSelected =
    displayRows.length > 0 && displayRows.every((r) => selected.has(rowKey(r)));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        displayRows.forEach((r) => next.delete(rowKey(r)));
        return next;
      }
      const next = new Set(prev);
      displayRows.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  };

  const selectedRows = displayRows.filter((r) => selected.has(rowKey(r)));

  const handleExport = () => {
    const csv = toCsv(visibleColumns, displayRows);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const colSpan = visibleColumns.length + (selectable ? 1 : 0);

  return (
    <div className={cn("space-y-2", className)}>
      {(searchable || toolbar || exportFileName || columns.length > 4) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <Input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full max-w-[240px]"
              aria-label="Search table"
            />
          )}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            {columns.length > 4 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnMenuOpen((v) => !v)}
                  aria-expanded={columnMenuOpen}
                >
                  Columns
                </Button>
                {columnMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setColumnMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border bg-popover p-1.5 shadow-md">
                      {columns.map((c) => (
                        <label
                          key={c.key}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-muted"
                        >
                          <Checkbox
                            checked={!hiddenKeys.has(c.key)}
                            onCheckedChange={() =>
                              setHiddenKeys((prev) => {
                                const next = new Set(prev);
                                if (next.has(c.key)) next.delete(c.key);
                                else next.add(c.key);
                                return next;
                              })
                            }
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {exportFileName && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={displayRows.length === 0}
              >
                Export CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {selectable && selectedRows.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-[12px] font-medium">
            {selectedRows.length} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {bulkActions?.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant={action.tone === "danger" ? "destructive" : "outline"}
                onClick={() => action.onClick(selectedRows)}
              >
                {action.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {selectable && (
                <TableHead className="w-9">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {visibleColumns.map((c) => {
                const isSorted = activeSort?.key === c.key;
                return (
                  <TableHead
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.sortable && "cursor-pointer select-none hover:text-foreground",
                      c.className
                    )}
                    onClick={() => toggleSort(c)}
                    aria-sort={
                      isSorted
                        ? activeSort!.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.sortable && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "text-[9px] leading-none",
                            isSorted ? "opacity-100" : "opacity-30"
                          )}
                        >
                          {isSorted && activeSort!.direction === "desc" ? "▼" : "▲"}
                        </span>
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={colSpan} className="p-0">
                  <SkeletonTable columns={colSpan} rows={6} />
                </TableCell>
              </TableRow>
            )}

            {!loading && error && (
              <TableRow>
                <TableCell colSpan={colSpan} className="p-0">
                  <ErrorState body={error} onRetry={onRetry} size="sm" />
                </TableCell>
              </TableRow>
            )}

            {!loading && !error && displayRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="p-0">
                  <EmptyState
                    size="sm"
                    icon={empty?.icon}
                    title={empty?.title ?? "Nothing here yet"}
                    body={empty?.body}
                    action={empty?.action}
                  />
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              !error &&
              displayRows.map((row, index) => {
                const key = rowKey(row);
                return (
                  <TableRow
                    key={key}
                    data-state={
                      activeRowKey === key
                        ? "selected"
                        : selected.has(key)
                          ? "selected"
                          : undefined
                    }
                    className={cn(
                      onRowClick && "cursor-pointer",
                      dense && "[&>td]:py-1.5"
                    )}
                    onClick={
                      onRowClick
                        ? (e) => {
                            // Never hijack a click meant for a control.
                            const target = e.target as HTMLElement;
                            if (target.closest("button,a,input,label,[role=checkbox]"))
                              return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter") onRowClick(row);
                          }
                        : undefined
                    }
                  >
                    {selectable && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          c.className
                        )}
                      >
                        {c.render
                          ? c.render(row, index)
                          : (defaultValue(row, c) ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {pagination && onPageChange && (
        <Pagination
          meta={pagination}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
