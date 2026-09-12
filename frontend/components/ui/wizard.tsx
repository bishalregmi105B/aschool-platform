"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wizard — multi-step form shell for long flows (admissions, bulk import,
 * onboarding). Owns ONLY the step chrome: progress rail, back/next gating,
 * per-step validation hooks. Steps render their own fields — pair with
 * FormRenderer for schema-driven steps.
 *
 * The pattern this replaces: one mile-long form where step 3's error is
 * invisible until you scroll, and "Cancel" loses everything silently.
 */

export interface WizardStep {
  key: string;
  title: string;
  description?: string;
  /** Return an error string to block Next; null/undefined passes. */
  validate?: () => string | null;
  /** Optional async gate (e.g. server-side uniqueness check). */
  validateAsync?: () => Promise<string | null>;
  content: React.ReactNode;
  /** Skipped steps render nothing but keep their number. */
  skipped?: boolean;
}

export interface WizardProps {
  steps: WizardStep[];
  onFinish: () => Promise<void> | void;
  onCancel?: () => void;
  finishLabel?: string;
  className?: string;
  /** Hide the rail on narrow layouts (stepper-only). */
  compact?: boolean;
}

export function Wizard({
  steps,
  onFinish,
  onCancel,
  finishLabel = "Finish",
  className,
  compact,
}: WizardProps) {
  const activeSteps = steps.filter((s) => !s.skipped);
  const [current, setCurrent] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const step = activeSteps[current];
  const isFirst = current === 0;
  const isLast = current === activeSteps.length - 1;

  React.useEffect(() => {
    setError(null);
  }, [current]);

  const runValidation = async (): Promise<string | null> => {
    if (step.validate) {
      const sync = step.validate();
      if (sync) return sync;
    }
    if (step.validateAsync) return await step.validateAsync();
    return null;
  };

  const goNext = async () => {
    setBusy(true);
    try {
      const err = await runValidation();
      if (err) {
        setError(err);
        return;
      }
      setCompleted((prev) => new Set(prev).add(step.key));
      if (isLast) {
        await onFinish();
      } else {
        setCurrent((c) => c + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-5", className)}>
      {/* Progress rail */}
      <ol className={cn("flex items-center gap-1.5", compact && "hidden md:flex")}>
        {activeSteps.map((s, idx) => {
          const isDone = completed.has(s.key) || idx < current;
          const isCurrent = idx === current;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                disabled={idx > current}
                onClick={() => idx < current && setCurrent(idx)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[var(--w11-radius-sm)] px-2 py-1 text-xs font-medium",
                  isCurrent && "text-[var(--w11-accent)]",
                  isDone && !isCurrent && "text-[var(--w11-accent)] hover:bg-[var(--w11-control-hover)]",
                  !isDone && !isCurrent && "text-[var(--w11-text-tertiary)]",
                  idx < current && "cursor-pointer"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                    isCurrent && "border-[var(--w11-accent)] text-[var(--w11-accent)]",
                    isDone && !isCurrent && "border-[var(--w11-accent)] bg-[var(--w11-accent)] text-[var(--w11-accent-text)]",
                    !isDone && !isCurrent && "border-[var(--w11-border-default)]"
                  )}
                >
                  {isDone && !isCurrent ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="hidden truncate sm:inline">{s.title}</span>
              </button>
              {idx < activeSteps.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1",
                    idx < current ? "bg-[var(--w11-accent)]" : "bg-[var(--w11-border-default)]"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step body */}
      <div className="space-y-1">
        <h2 className="text-subtitle text-[var(--w11-text-primary)]">{step.title}</h2>
        {step.description && (
          <p className="text-[12px] text-[var(--w11-text-secondary)]">{step.description}</p>
        )}
      </div>

      <div className="win11-card min-h-0">{step.content}</div>

      {error && (
        <p role="alert" className="text-sm text-[#c42b1c]">
          {error}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--w11-border-default)] pt-4">
        <div>
          {isFirst ? (
            onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <Button type="button" onClick={goNext} disabled={busy}>
          {busy
            ? "Working…"
            : isLast
              ? finishLabel
              : "Next"}
        </Button>
      </div>
    </div>
  );
}
