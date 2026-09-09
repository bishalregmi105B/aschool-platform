"use client";
/**
 * MultiSelect — checkbox dropdown emitting a JSON array of strings.
 * Used for subjects, sections, permission rows, tag-style picks.
 * Value contract: string[] (serialized by the caller if the API wants CSV).
 */
import * as React from "react";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { AdvancedOption } from "@/components/ui/advanced-select";

interface MultiSelectProps {
  value?: string[];
  onChange?: (values: string[]) => void;
  options: AdvancedOption[];
  placeholder?: string;
  nePlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Cap visible tokens before "+N more" (default 3). */
  maxTokens?: number;
  className?: string;
  id?: string;
}

export function MultiSelect({
  value = [],
  onChange,
  options,
  placeholder,
  nePlaceholder,
  disabled = false,
  loading = false,
  maxTokens = 3,
  className,
  id,
}: MultiSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("");

  const selectedOptions = options.filter((o) => value.includes(o.value));
  const visible = filter.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(filter.toLowerCase()) ||
          (o.ne ?? "").includes(filter.trim())
      )
    : options;

  function toggle(v: string) {
    onChange?.(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-auto min-h-9 w-full justify-between px-3 py-1.5 text-left font-normal",
            className
          )}
        >
          <span className="flex flex-wrap items-center gap-1">
            {loading ? (
              <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("Loading…", "लोड हुँदै…")}
              </span>
            ) : selectedOptions.length === 0 ? (
              <span className="text-[13px] text-muted-foreground">
                {nePlaceholder ? t(placeholder ?? t("Select", "छान्नुहोस्"), nePlaceholder) : placeholder ?? t("Select", "छान्नुहोस्")}
              </span>
            ) : (
              <>
                {selectedOptions.slice(0, maxTokens).map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {opt.ne ? t(opt.label, opt.ne) : opt.label}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggle(opt.value); }}
                      className="rounded-sm hover:bg-primary/20"
                      aria-label={t("Remove", "हटाउनुहोस्")}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {selectedOptions.length > maxTokens && (
                  <span className="text-[11px] text-muted-foreground">
                    +{selectedOptions.length - maxTokens}
                  </span>
                )}
              </>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("Filter…", "खोज्नुहोस्…")}
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
              {t("No options", "विकल्प छैन")}
            </p>
          ) : (
            visible.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] hover:bg-accent"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  {opt.group && (
                    <span className="text-[10px] uppercase text-muted-foreground">{opt.group} ·</span>
                  )}
                  <span className="min-w-0 truncate">{opt.ne ? t(opt.label, opt.ne) : opt.label}</span>
                </button>
              );
            })
          )}
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange?.([])}
            className="w-full border-t px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-accent"
          >
            {t("Clear all", "सबै हटाउनुहोस्")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * TagsField — free-form list of short values (aliases, keywords, emails).
 * Enter/comma adds; backspace on empty removes last; × removes.
 * Value contract: string[].
 */
export function TagsField({
  value = [],
  onChange,
  placeholder,
  nePlaceholder,
  max = 30,
  className,
  id,
}: {
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  nePlaceholder?: string;
  max?: number;
  className?: string;
  id?: string;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState("");

  function add(raw: string) {
    const tag = raw.trim().replace(/,$/, "");
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange?.([...value, tag]);
    setDraft("");
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-[13px] focus-within:ring-2 focus-within:ring-ring",
        className
      )}
      onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange?.(value.filter((x) => x !== tag))}
            aria-label={t("Remove", "हटाउनुहोस्")}
            className="rounded-sm hover:bg-primary/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          if (e.target.value.endsWith(",")) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && value.length) {
            onChange?.(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length ? "" : nePlaceholder ? t(placeholder ?? t("Add", "थप्नुहोस्"), nePlaceholder) : placeholder ?? t("Add", "थप्नुहोस्")}
        className="min-w-[80px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
