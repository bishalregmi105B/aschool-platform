"use client";
/**
 * EntityPicker — searchable combobox over any API list.
 *
 * The missing link for relational fields: instead of dumping 400 students
 * into a native <select>, forms pick from a virtualized, filtered list fed
 * by the same endpoints the list pages use.
 *
 *   <EntityPicker
 *     value={form.student_id}
 *     onChange={(id) => set("student_id", id)}
 *     query={{ path: "/students", searchKey: "q", perPage: 20 }}
 *     getOptions={(rows) => rows.map(s => ({ value: s.id, label: s.full_name, ne: s.full_name_nepali, hint: s.enrollment_number }))}
 *     placeholder="Search student…"
 *   />
 *
 * Debounced search, loading/empty states, initial-label resolution (shows
 * the human name of an already-saved value before the first search).
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Loader2, X, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AdvancedOption } from "@/components/ui/advanced-select";

export interface EntityQuery {
  /** API path, e.g. "/students" or "/teachers". */
  path: string;
  /** Query param the endpoint filters on (default "q"). */
  searchKey?: string;
  perPage?: number;
  /** Extra static params (class_id, role…). */
  params?: Record<string, string>;
}

interface EntityPickerProps {
  value?: string;
  onChange?: (id: string, row?: unknown) => void;
  query: EntityQuery;
  /** Map API rows → options. */
  getOptions: (rows: unknown[]) => AdvancedOption[];
  placeholder?: string;
  nePlaceholder?: string;
  disabled?: boolean;
  /** Label shown when a value is set but options haven't loaded. */
  initialLabel?: string;
  className?: string;
  id?: string;
}

export function EntityPicker({
  value = "",
  onChange,
  query,
  getOptions,
  placeholder,
  nePlaceholder,
  disabled = false,
  initialLabel,
  className,
  id,
}: EntityPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["entity-picker", query.path, debounced, query.params],
    enabled: open,
    queryFn: async () => {
      const res = await api.get(query.path, {
        params: {
          per_page: query.perPage ?? 20,
          ...(debounced ? { [query.searchKey ?? "q"]: debounced } : {}),
          ...(query.params ?? {}),
        },
      });
      const d = res.data?.data;
      return (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : d?.results ?? []) as unknown[];
    },
  });

  const options = React.useMemo(() => getOptions(data ?? []), [data, getOptions]);
  const selectedOpt = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-[13px] transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
            {selectedOpt
              ? selectedOpt.ne ? t(selectedOpt.label, selectedOpt.ne) : selectedOpt.label
              : value
                ? initialLabel ?? value
                : nePlaceholder
                  ? t(placeholder ?? t("Search", "खोज्नुहोस्"), nePlaceholder)
                  : placeholder ?? t("Search", "खोज्नुहोस्")}
          </span>
          {value ? (
            <X
              className="h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange?.(""); }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Type to search…", "टाइप गरी खोज्नुहोस्…")}
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              {isLoading ? t("Loading…", "लोड हुँदै…") : t("Nothing matches that search", "कुनै नतिजा छैन")}
            </p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange?.(opt.value, opt);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex w-full flex-col px-3 py-1.5 text-left hover:bg-accent",
                  opt.value === value && "bg-primary/5"
                )}
              >
                <span className="text-[13px] font-medium">
                  {opt.ne ? t(opt.label, opt.ne) : opt.label}
                </span>
                {(opt as AdvancedOption & { hint?: string }).hint && (
                  <span className="text-[11px] text-muted-foreground">
                    {(opt as AdvancedOption & { hint?: string }).hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
