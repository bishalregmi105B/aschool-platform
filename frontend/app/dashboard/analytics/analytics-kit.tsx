"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Analytics/Reports print + export helpers (plan 34 #51: "A7 each + print
 * twins"; Part 8 print via window.print scoped style).
 *
 * The AOS window chrome (dock, menu bar, other windows) must not print, and
 * window-level CSS containment clips naive prints — so we scope with a
 * visibility pass around a `data-print-area` region and remove it afterwards.
 */

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-print-area], [data-print-area] * { visibility: visible !important; }
  [data-print-area] {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-height: none !important;
    overflow: visible !important;
  }
}`;

export const PRINT_AREA_ATTR = "data-print-area";

/** Mark a wrapper as the printable region on any A7 page body. */
export function PrintArea({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} {...{ [PRINT_AREA_ATTR]: "" }}>
      {children}
    </div>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  const print = () => {
    const style = document.createElement("style");
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    const cleanup = () => {
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Fallback cleanup for browsers that skip afterprint.
    setTimeout(cleanup, 2000);
    window.print();
  };
  return (
    <Button variant="outline" size="sm" onClick={print} title="Print this report (dashboard chrome hidden)">
      <Printer className="h-4 w-4 mr-2" /> {label}
    </Button>
  );
}

/** Client-side CSV export for chart data (no server round-trip). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Honest zero-data state for chart panels (A7: "Record attendance to see
 * trends" — never a blank chart, never fake numbers).
 */
export function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-[13px] font-medium" style={{ color: "var(--w11-text-secondary)" }}>
        {label}
      </p>
    </div>
  );
}
