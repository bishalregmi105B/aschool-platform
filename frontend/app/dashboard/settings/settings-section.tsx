"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

/**
 * Section-scoped save (plan 32 A8 / 48.5 / Part 35): one Save button per
 * FormSection with change detection — a section is dirty only while its own
 * draft differs from the loaded values, so admins never wonder which of 30
 * fields a global Save touched, and unrelated half-typed edits can't be
 * committed accidentally.
 *
 * `useSectionSave(initial, onSave)` — `initial` is the server snapshot
 * (re-seeded whenever it changes AND the section is clean). `onSave(values)`
 * should throw on failure; the hook handles pending/saved feedback states.
 */

export interface SectionForm<T> {
  values: T;
  /** Patch one or more fields: `setField({ name: "x" })`. */
  setField: (patch: Partial<T>) => void;
  dirty: boolean;
  saving: boolean;
  /** True for ~2.5s after a successful save ("Saved ✓" affordance). */
  saved: boolean;
  save: () => void;
  reset: () => void;
}

export function useSectionSave<T extends object>(
  initial: T,
  onSave: (values: T) => Promise<void>,
  options?: { validate?: (values: T) => string | null },
): SectionForm<T> {
  const [draft, setDraft] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftJson = JSON.stringify(draft);
  const baseJson = JSON.stringify(baseline);
  const dirty = draftJson !== baseJson;

  // Follow the server snapshot while the section is clean (first load,
  // background refetch). Never clobber a dirty draft.
  useEffect(() => {
    const incoming = JSON.stringify(initial);
    if (incoming !== JSON.stringify(baseline)) {
      setBaseline(initial);
      setDraft((d) => (JSON.stringify(d) === JSON.stringify(baseline) ? initial : d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingKey(initial)]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const setField = useCallback(
    (patch: Partial<T>) => setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );

  const save = useCallback(async () => {
    if (options?.validate) {
      const err = options.validate(draft);
      if (err) {
        toast.error(err);
        return;
      }
    }
    setSaving(true);
    try {
      await onSave(draft);
      setBaseline(draft);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (
              (err as { response?: { data?: { error?: string } } }).response?.data
                ?.error ?? "Save failed"
            )
          : err instanceof Error && err.message
            ? err.message
            : "Save failed";
      toast.error(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, onSave]);

  const reset = useCallback(() => {
    setDraft(baseline);
  }, [baseline]);

  return { values: draft, setField, dirty, saving, saved, save, reset };
}

/** Stable key so the snapshot effect only runs when the data actually changes. */
function incomingKey<T>(v: T): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

/**
 * SettingsSection — FormSection chrome with the save controls in the section
 * header (per A8: "sticky Save per section … with change-detection"). Pass the
 * matching `useSectionSave` result as `form`.
 */
export function SettingsSection<T extends object>({
  title,
  description,
  form,
  children,
  saveLabel = "Save",
  hideActions = false,
  className,
}: {
  title: React.ReactNode;
  /** One-line explanation of what this section controls. */
  description?: React.ReactNode;
  /** The matching `useSectionSave` result. Omit for read-only sections. */
  form?: SectionForm<T>;
  children: React.ReactNode;
  saveLabel?: string;
  /** Render no save controls (read-only sections). */
  hideActions?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className ? `win11-card ${className}` : "win11-card"}
      role="group"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--w11-text-primary)" }}>
            {title}
          </h2>
          {description && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--w11-text-secondary)" }}>
              {description}
            </p>
          )}
        </div>
        {!hideActions && form && (
          <div className="flex items-center gap-2 shrink-0">
            {form.saved ? (
              <span
                className="inline-flex items-center gap-1 text-[12px] font-semibold"
                style={{ color: "var(--w11-success, #107c10)" }}
                role="status"
              >
                Saved ✓
              </span>
            ) : form.dirty ? (
              <span className="text-[11px]" style={{ color: "var(--w11-text-tertiary)" }}>
                Unsaved changes
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              disabled={!form.dirty || form.saving}
              onClick={form.reset}
              title="Discard changes in this section"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              disabled={!form.dirty || form.saving}
              onClick={form.save}
            >
              {form.saving ? <Spinner size="sm" className="mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {form.saving ? "Saving…" : saveLabel}
            </Button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * SettingField — a labeled control with the one-line effect explanation the
 * A8 rule requires under EVERY setting ("Parents receive SMS when a fee is
 * overdue", not just a bare label).
 */
export function SettingField({
  label,
  help,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode;
  /** REQUIRED effect text — what turning/changing this actually does. */
  help: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium mb-1 block"
        style={{ color: "var(--w11-text-primary)" }}
      >
        {label}
      </label>
      {children}
      <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--w11-text-tertiary)" }}>
        {help}
      </p>
    </div>
  );
}
