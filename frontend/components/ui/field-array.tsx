"use client";
/**
 * FieldArray — repeatable field blocks (guardians, pickup points, fee lines)
 * with add/remove/reorder, replacing hand-rolled "Second Guardian (Optional)"
 * style duplications. Value contract: Array<Record<string, string>>.
 */
import * as React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FieldArrayColumn {
  key: string;
  label: string;
  ne?: string;
  /** Width class for the column inside the row grid. */
  className?: string;
  type?: "text" | "number" | "email" | "tel";
  placeholder?: string;
}

export function FieldArray({
  value = [],
  onChange,
  columns,
  createEmpty,
  addLabel,
  neAddLabel,
  max = 10,
  className,
}: {
  value?: Array<Record<string, string>>;
  onChange?: (rows: Array<Record<string, string>>) => void;
  columns: FieldArrayColumn[];
  createEmpty: () => Record<string, string>;
  addLabel?: string;
  neAddLabel?: string;
  max?: number;
  className?: string;
}) {
  const { t } = useI18n();

  function update(idx: number, key: string, v: string) {
    const next = value.map((row, i) => (i === idx ? { ...row, [key]: v } : row));
    onChange?.(next);
  }

  function remove(idx: number) {
    onChange?.(value.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange?.(next);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="hidden gap-2 px-1 sm:grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr)) 72px` }}>
          {columns.map((c) => (
            <span key={c.key} className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.ne ? t(c.label, c.ne) : c.label}
            </span>
          ))}
          <span />
        </div>
      )}
      {value.map((row, idx) => (
        <div
          key={idx}
          className="grid items-center gap-2 rounded-md border bg-muted/30 p-2 sm:border-0 sm:bg-transparent sm:p-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr)) 72px` }}
        >
          {columns.map((c) => (
            <input
              key={c.key}
              type={c.type ?? "text"}
              value={row[c.key] ?? ""}
              placeholder={c.placeholder}
              onChange={(e) => update(idx, c.key, e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ))}
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
              aria-label={t("Move up", "माथि सार्नुहोस्")}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === value.length - 1}
              className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
              aria-label={t("Move down", "तल सार्नुहोस्")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="rounded p-1 text-destructive hover:bg-destructive/10"
              aria-label={t("Remove", "हटाउनुहोस्")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      {value.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange?.([...value, createEmpty()])}
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel ? t(addLabel, neAddLabel ?? addLabel) : t("Add row", "पङ्क्ति थप्नुहोस्")}
        </Button>
      )}
    </div>
  );
}
