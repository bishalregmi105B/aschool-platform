"use client";
/**
 * AdvancedSelect — the one dropdown every form should use.
 *
 * Wraps the Radix Select in a FormField-compatible shell and adds what the
 * bare primitive lacked for real school forms:
 *   • searchable mode (filter as you type — class lists, teacher lists)
 *   • bilingual options ({ value, label, ne? })
 *   • clearable ("All" / empty state for optional filters)
 *   • groups with headers
 *   • loading + empty states
 * Emits string values only ("" = cleared), so form payloads and URL search
 * params stay plain.
 */
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface AdvancedOption {
  value: string;
  label: string;
  ne?: string;
  /** Disable this option. */
  disabled?: boolean;
  /** Group header this option renders under (optional). */
  group?: string;
}

interface AdvancedSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: AdvancedOption[];
  placeholder?: string;
  nePlaceholder?: string;
  /** Show a filter box above the list (for long option sets). */
  searchable?: boolean;
  /** Show a clear "×" that emits "" (optional fields/filters). */
  clearable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  /** Render value when nothing selected (defaults to placeholder). */
  emptyLabel?: string;
  /** Uncontrolled initial value — for FormData-style forms. When set (and
   *  `value` is undefined) the component manages its own state. */
  defaultValue?: string;
  /** Radix-compatible alias used by uncontrolled forms. */
  onValueChange?: (value: string) => void;
  /** Form name for uncontrolled mode — renders a hidden input so
   *  FormData submissions keep working. */
  name?: string;
}

function isControlled(props: { value?: string; defaultValue?: string }) {
  return props.value !== undefined;
}

export function AdvancedSelect(props: AdvancedSelectProps) {
  const {
    options,
    placeholder,
    nePlaceholder,
    searchable = false,
    clearable = false,
    disabled = false,
    loading = false,
    className,
    triggerClassName,
    id,
    defaultValue = "",
    onValueChange,
    name,
  } = props;
  const controlled = isControlled(props);
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = controlled ? (props.value ?? "") : internalValue;
  const onChange = controlled ? props.onChange : (onValueChange ?? props.onChange);

  // Keep any hidden input in sync for FormData submissions.
  const hiddenRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = value;
  }, [value]);

  const { t } = useI18n();
  const [filter, setFilter] = React.useState("");

  const selected = options.find((o) => o.value === value);
  const groups = React.useMemo(() => {
    const f = filter.trim().toLowerCase();
    const visible = f
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(f) ||
            (o.ne ?? "").includes(filter.trim()) ||
            o.value.toLowerCase().includes(f)
        )
      : options;
    const map = new Map<string, AdvancedOption[]>();
    for (const opt of visible) {
      const key = opt.group ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(opt);
    }
    return map;
  }, [options, filter]);

  return (
    <div className={cn("relative", className)}>
      {name && !controlled && <input type="hidden" name={name} ref={hiddenRef} value={value} readOnly />}
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (!controlled) setInternalValue(v ?? "");
          onChange?.(v ?? "");
          onValueChange?.(v ?? "");
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn("h-9 text-[13px]", triggerClassName)}>
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("Loading…", "लोड हुँदै…")}
            </span>
          ) : (
            <SelectValue placeholder={nePlaceholder ? t(placeholder ?? "Select", nePlaceholder) : placeholder ?? t("Select", "छान्नुहोस्")} />
          )}
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {searchable && (
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-popover px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                // Search inside the dropdown; Radix handles typeahead natively
                // but an explicit box beats it for 50+ teachers/classes.
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("Filter…", "खोज्नुहोस्…")}
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {clearable && value && (
            <button
              type="button"
              onClick={() => onChange?.("")}
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-[12px] text-muted-foreground hover:bg-accent"
            >
              <X className="h-3 w-3" /> {t("Clear selection", "छान्नु रद्द")}
            </button>
          )}
          {groups.size === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              {t("No options", "विकल्प छैन")}
            </div>
          ) : (
            Array.from(groups.entries()).map(([group, opts]) => (
              <SelectGroup key={group || "__all"}>
                {group && <SelectLabel>{group}</SelectLabel>}
                {opts.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="text-[13px]"
                  >
                    {opt.ne ? t(opt.label, opt.ne) : opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Convenience: plain (non-searchable) select with simple string options. */
export function SimpleSelect({
  options, // Array<string> or Array<{value,label,ne}>
  ...rest
}: Omit<AdvancedSelectProps, "options"> & {
  options: Array<string | AdvancedOption>;
}) {
  const normalized: AdvancedOption[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return <AdvancedSelect options={normalized} {...rest} />;
}
