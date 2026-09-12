"use client";
/**
 * TimePicker — accessible HH:MM picker (bilingual).
 *
 * Replaces raw <input type="time"> which (a) renders the browser's English
 * AM/PM chrome inconsistently, (b) is tiny to hit on touch laptops. Two
 * select columns (hour/minute) with a visual clock readout; emits "HH:MM"
 * 24h so the backend contract is unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface TimePickerProps {
  /** "HH:MM" 24-hour string. */
  value?: string;
  onChange?: (hhmm: string) => void;
  name?: string;
  className?: string;
  disabled?: boolean;
  /** Minute granularity (default 5). */
  step?: 1 | 5 | 10 | 15 | 30;
  placeholder?: string;
}

export function TimePicker({
  value,
  onChange,
  name,
  className,
  disabled = false,
  step = 5,
  placeholder,
}: TimePickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<number | null>(null);
  const [minute, setMinute] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && /^\d{1,2}:\d{2}/.test(value)) {
      const [h, m] = value.split(":");
      setHour(Math.min(23, parseInt(h, 10)));
      setMinute(Math.min(59, parseInt(m, 10)));
    } else if (!value) {
      setHour(null);
      setMinute(null);
    }
  }, [value]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  function emit(h: number | null, m: number | null) {
    if (h !== null && m !== null) onChange?.(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  const display =
    hour !== null && minute !== null
      ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      : "";

  const minutes = Array.from({ length: Math.round(60 / step) }, (_, i) => i * step);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={display} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className={cn("tabular-nums", !display && "text-tertiary")}>
          {display || placeholder || t("Pick time", "समय छान्नुहोस्")}
        </span>
        <Clock className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 border border-[var(--w11-border-default)] bg-[var(--w11-surface-flyout)] p-3 shadow-[var(--w11-elevation-flyout)] backdrop-blur-xl">
          <div className="text-tertiary mb-2 rounded-[var(--w11-radius-md)] bg-[var(--w11-control-hover)] px-3 py-1.5 text-center text-sm font-semibold tabular-nums">
            {display || "--:--"}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-tertiary mb-1 text-center text-[10px] font-medium uppercase">
                {t("Hour", "घण्टा")}
              </p>
              <div className="grid max-h-40 grid-cols-4 gap-0.5 overflow-y-auto pr-1">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => { setHour(h); emit(h, minute); }}
                    className={cn(
                      "h-7 rounded-sm text-[11px] tabular-nums",
                      h === hour ? "accent font-semibold" : "subtle"
                    )}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-[104px]">
              <p className="text-tertiary mb-1 text-center text-[10px] font-medium uppercase">
                {t("Minute", "मिनेट")}
              </p>
              <div className="grid max-h-40 grid-cols-3 gap-0.5 overflow-y-auto pr-1">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMinute(m); emit(hour, m); }}
                    className={cn(
                      "h-7 rounded-sm text-[11px] tabular-nums",
                      m === minute ? "accent font-semibold" : "subtle"
                    )}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {display && (
            <button
              type="button"
              className="!h-6 !min-h-0 mt-2 w-full py-1 !text-[var(--w11-text-secondary)] subtle !px-0"
              onClick={() => { setHour(null); setMinute(null); onChange?.(""); setOpen(false); }}
            >
              {t("Clear", "मेटाउनुहोस्")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
