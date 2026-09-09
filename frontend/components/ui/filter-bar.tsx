"use client";
import { AdvancedSelect } from "@/components/ui/advanced-select";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { BSDateInput } from "./bs-date-input";

/**
 * FilterBar + useUrlFilters — filters that survive a refresh and a shared link.
 *
 * Every filtered list in this app kept its filters in local state, so reloading
 * the fees page lost the class you had selected and "send me the link" sent the
 * unfiltered page. Filters now live in the query string, which makes them
 * shareable, bookmarkable, and back-button-correct for free.
 */

export type FilterType =
  | "text"
  | "select"
  | "date"
  | "bs-date"
  | "date-range"
  | "number";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  labelNepali?: string;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
  /** Not shown as a chip; used for the always-visible search box. */
  primary?: boolean;
}

/**
 * Reads and writes filter values in the URL.
 * `values` are always strings (URL semantics); "" means unset.
 */
export function useUrlFilters(keys: string[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of keys) out[key] = searchParams.get(key) ?? "";
    return out;
  }, [searchParams, keys]);

  const setValues = React.useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Any filter change invalidates the current page number.
      if (!("page" in patch)) next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const clear = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of [...keys, "page"]) next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams, keys]);

  const activeCount = keys.filter((k) => values[k]).length;

  return { values, setValues, clear, activeCount };
}

/** Debounces a value so a text filter does not fire a request per keystroke. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  onClear: () => void;
  /** Right-aligned extras (e.g. a view toggle). */
  children?: React.ReactNode;
  className?: string;
  language?: string;
}

function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  children,
  className,
  language,
}: FilterBarProps) {
  const activeCount = filters.filter((f) => values[f.key]).length;

  const label = (f: FilterDef) =>
    language === "ne" && f.labelNepali ? f.labelNepali : f.label;

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      {filters.map((f) => {
        const value = values[f.key] ?? "";
        const id = `filter-${f.key}`;
        return (
          <div key={f.key} className="flex flex-col gap-1">
            <label
              htmlFor={id}
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {label(f)}
            </label>

            {f.type === "select" ? (
              <AdvancedSelect
                id={id}
                className="min-w-[140px]"
                triggerClassName="h-8 text-[12px]"
                value={value}
                onChange={(v) => onChange({ [f.key]: v })}
                clearable
                placeholder={f.placeholder ?? `All ${f.label.toLowerCase()}`}
                options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
              />
            ) : f.type === "bs-date" ? (
              <BSDateInput
                value={value}
                onChange={(next) => onChange({ [f.key]: next })}
                className="h-8 w-[150px]"
              />
            ) : (
              <Input
                id={id}
                type={
                  f.type === "date"
                    ? "date"
                    : f.type === "number"
                      ? "number"
                      : "text"
                }
                value={value}
                placeholder={f.placeholder}
                onChange={(e) => onChange({ [f.key]: e.target.value })}
                className={cn("h-8", f.type === "text" ? "w-[180px]" : "w-[150px]")}
              />
            )}
          </div>
        );
      })}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
          Clear ({activeCount})
        </Button>
      )}

      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

export { FilterBar };
