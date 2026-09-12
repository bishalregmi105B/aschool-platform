"use client";
import { AdvancedSelect } from "@/components/ui/advanced-select";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pagination — one control, matching the backend's pagination envelope.
 *
 * `ApiResponse.meta.pagination` from `app/utils/pagination.py` is exactly this
 * shape, so a page can hand the meta straight through instead of recomputing
 * page counts (14 screens each did their own arithmetic, and three of them were
 * off by one on the last page).
 */

export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

/** Page numbers with ellipses: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) items.push("…");
  for (let p = from; p <= to; p++) items.push(p);
  if (to < total - 1) items.push("…");
  items.push(total);
  return items;
}

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

const pageButtonClass = cn(
  "commandbar-button",
  "h-8 min-w-8 justify-center rounded-[var(--w11-radius-sm)] px-2 text-[12px]",
  "border border-[var(--w11-control-border)] bg-[var(--w11-control-bg)]",
  "hover:bg-[var(--w11-control-hover)] active:bg-[var(--w11-control-active)] active:scale-100"
);

function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const { total, page, per_page, pages, has_next, has_prev } = meta;
  if (!total) return null;

  const first = (page - 1) * per_page + 1;
  const last = Math.min(page * per_page, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        className
      )}
    >
      <p className="text-[12px] text-[var(--w11-text-secondary)]">
        {first.toLocaleString()}–{last.toLocaleString()} of{" "}
        {total.toLocaleString()}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--w11-text-secondary)]">
            <span className="hidden sm:inline">Rows</span>
            <AdvancedSelect
              value={String(per_page)}
              onChange={(v) => onPageSizeChange(Number(v))}
              triggerClassName="h-7 w-[68px] px-2 text-[12px]"
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(pageButtonClass, "px-2")}
            disabled={!has_prev}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>
          {pageWindow(page, pages).map((item, i) =>
            item === "…" ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-[12px] text-[var(--w11-text-tertiary)]"
                aria-hidden="true"
              >
                …
              </span>
            ) : item === page ? (
              <span
                key={item}
                aria-current="page"
                className="win11-chip accent h-8 min-w-8 justify-center px-2.5 text-[12px]"
              >
                {item}
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={pageButtonClass}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            className={cn(pageButtonClass, "px-2")}
            disabled={!has_next}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </nav>
  );
}

export { Pagination };
