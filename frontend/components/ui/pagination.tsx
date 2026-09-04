"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

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
        "flex flex-wrap items-center justify-between gap-2 text-[12px]",
        className
      )}
    >
      <p className="text-muted-foreground">
        {first.toLocaleString()}–{last.toLocaleString()} of{" "}
        {total.toLocaleString()}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={per_page}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-[12px]"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={!has_prev}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            ‹
          </Button>
          {pageWindow(page, pages).map((item, i) =>
            item === "…" ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "default" : "outline"}
                size="sm"
                className="h-7 min-w-7 px-2"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={!has_next}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            ›
          </Button>
        </div>
      </div>
    </nav>
  );
}

export { Pagination };
