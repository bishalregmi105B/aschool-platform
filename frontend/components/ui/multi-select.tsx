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
import { Win11Scope } from "@/lib/win11-scope";
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
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-9 w-full items-center justify-between gap-2 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-default)] bg-[var(--w11-control-bg)] px-3 py-1.5 text-left text-[13px] text-[var(--w11-text-primary)] transition-colors hover:bg-[var(--w11-control-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--w11-accent)] disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {loading ? (
              <span className="flex items-center gap-2 text-[13px] text-[var(--w11-text-secondary)]">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("Loading…", "लोड हुँदै…")}
              </span>
            ) : selectedOptions.length === 0 ? (
              <span className="text-[13px] text-[var(--w11-text-secondary)]">
                {nePlaceholder ? t(placeholder ?? t("Select", "छान्नुहोस्"), nePlaceholder) : placeholder ?? t("Select", "छान्नुहोस्")}
              </span>
            ) : (
              <>
                {selectedOptions.slice(0, maxTokens).map((opt) => (
                  <span
                    key={opt.value}
                    className="win11-chip accent px-1.5 py-0.5 text-[11px]"
                  >
                    {opt.ne ? t(opt.label, opt.ne) : opt.label}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggle(opt.value); }}
                      className="rounded-[var(--w11-radius-sm)] hover:opacity-70"
                      aria-label={t("Remove", "हटाउनुहोस्")}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {selectedOptions.length > maxTokens && (
                  <span className="text-[11px] text-[var(--w11-text-secondary)]">
                    +{selectedOptions.length - maxTokens}
                  </span>
                )}
              </>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--w11-text-tertiary)]" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] rounded-[var(--w11-radius-lg)] border-[var(--w11-acrylic-border)] bg-[var(--w11-surface-flyout)] p-0 shadow-[var(--w11-elevation-flyout)] backdrop-blur-[24px] backdrop-saturate-[1.8]" align="start">
        <Win11Scope>
        <div className="flex items-center gap-2 border-b border-[var(--w11-border-subtle)] px-2.5 py-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("Filter…", "खोज्नुहोस्…")}
            className="w-full bg-transparent text-[12px] text-[var(--w11-text-primary)] outline-none placeholder:text-[var(--w11-text-tertiary)]"
          />
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-[var(--w11-text-secondary)]">
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
                  className={cn(
                    "flex min-h-8 w-full items-center gap-2.5 px-3 text-left text-[13px] text-[var(--w11-text-primary)] hover:bg-[var(--w11-control-hover)]",
                    checked && "bg-[var(--w11-accent-light)] text-[var(--w11-accent)]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-[var(--w11-radius-sm)] border",
                      checked
                        ? "border-[var(--w11-accent)] bg-[var(--w11-accent)] text-[var(--w11-accent-text)]"
                        : "border-[var(--w11-border-default)]"
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  {opt.group && (
                    <span className="text-[10px] uppercase text-[var(--w11-text-tertiary)]">{opt.group} ·</span>
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
            className="w-full border-t border-[var(--w11-border-subtle)] px-3 py-1.5 text-[11px] text-[var(--w11-text-secondary)] hover:bg-[var(--w11-control-hover)]"
          >
            {t("Clear all", "सबै हटाउनुहोस्")}
          </button>
        )}
        </Win11Scope>
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
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-[var(--w11-radius-md)] border border-[var(--w11-border-default)] bg-[var(--w11-control-bg)] px-2 py-1.5 text-[13px] text-[var(--w11-text-primary)] focus-within:ring-1 focus-within:ring-[var(--w11-accent)]",
        className
      )}
      onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="win11-chip accent px-1.5 py-0.5 text-[11px]"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange?.(value.filter((x) => x !== tag))}
            aria-label={t("Remove", "हटाउनुहोस्")}
            className="rounded-[var(--w11-radius-sm)] hover:opacity-70"
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
        className="min-w-[80px] flex-1 bg-transparent text-[13px] text-[var(--w11-text-primary)] outline-none placeholder:text-[var(--w11-text-tertiary)]"
      />
    </div>
  );
}
