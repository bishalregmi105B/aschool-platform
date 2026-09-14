"use client";

import { useCallback } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Wave C — the print twin (plan 5.8 / 31.3, InfixEdu's "everything prints"
 * discipline) as ONE shared approach for the exams module.
 *
 * Usage on a page:
 *   <PrintStyles />                     // scoped @media print, renders nothing
 *   <PrintRegion>…printable rows…</PrintRegion>
 *   <PrintTwinButton title="Tabulation Sheet — First Terminal 2082" />
 *
 * The button sets `document.title` (so the printed page + the saved PDF
 * filename carry the document name), calls `window.print()`, and restores
 * the title on `afterprint`. Only elements inside `.as-print` are visible on
 * paper; sticky columns, scroll panes and `.no-print` chrome are neutralised.
 * No global CSS files are touched — the styles ship inline, scoped to the
 * class, exactly once per page.
 */

export const AS_PRINT_CLASS = "as-print";

export function PrintStyles({ orientation = "landscape" }: { orientation?: "landscape" | "portrait" }) {
  return (
    <style data-as-print-twin>{`
      @media print {
        body * { visibility: hidden !important; }
        .${AS_PRINT_CLASS}, .${AS_PRINT_CLASS} * { visibility: visible !important; }
        .${AS_PRINT_CLASS} {
          position: absolute !important;
          left: 0 !important; top: 0 !important;
          width: 100% !important;
          max-height: none !important;
          overflow: visible !important;
        }
        .${AS_PRINT_CLASS} * {
          position: static !important;
          overflow: visible !important;
          max-height: none !important;
          background: transparent !important;
          color: #000 !important;
          box-shadow: none !important;
        }
        .${AS_PRINT_CLASS} table { width: 100% !important; border-collapse: collapse !important; }
        .${AS_PRINT_CLASS} th, .${AS_PRINT_CLASS} td {
          border: 1px solid #999 !important;
          padding: 4pt 6pt !important;
          font-size: 10pt !important;
        }
        .${AS_PRINT_CLASS} tr { break-inside: avoid; }
        .${AS_PRINT_CLASS} thead { display: table-header-group; }
        .no-print { display: none !important; }
      }
      @page { size: A4 ${orientation}; margin: 12mm; }
    `}</style>
  );
}

/** Printable region — wraps exactly what should reach paper. */
export function PrintRegion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${AS_PRINT_CLASS} ${className ?? ""}`.trim()}>{children}</div>;
}

export function usePrintTwin() {
  return useCallback((title: string) => {
    const previous = document.title;
    document.title = title;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // Safety net: some browsers never fire afterprint (preview cancelled).
    window.setTimeout(() => {
      if (document.title === title) document.title = previous;
    }, 1500);
  }, []);
}

/** The Print button (chrome-only; hidden in print via .no-print). */
export function PrintTwinButton({
  title,
  disabled,
  variant = "outline",
  label = "Print",
}: {
  title: string;
  disabled?: boolean;
  variant?: "outline" | "default";
  label?: string;
}) {
  const print = usePrintTwin();
  return (
    <Button variant={variant} size="sm" disabled={disabled} onClick={() => print(title)}>
      <Printer className="h-4 w-4 mr-2" /> {label}
    </Button>
  );
}
