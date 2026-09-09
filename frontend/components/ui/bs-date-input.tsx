"use client";
/**
 * BSDateInput — Bikram Sambat-first date picker.
 * Emits AD date strings ("YYYY-MM-DD") so the backend stays unchanged.
 *
 * v2: bilingual month names (नेपाली/English follows the header toggle),
 * the AD equivalent is always visible under the chosen BS date, a "Today"
 * shortcut uses the *server* clock (not the browser's), weekday initials
 * localize, and the trigger matches the shared form control styling.
 */
import { useState, useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
import {
  adToBS,
  bsToAD,
  BS_MONTHS,
  BS_MONTHS_NE,
  BS_DATA,
  type BSDate,
} from "@/lib/nepali_date";
import { useI18n } from "@/lib/i18n";
import { useServerTime } from "@/lib/use-server-time";
import { cn } from "@/lib/utils";

function getDaysInMonth(y: number, m: number): number {
  return BS_DATA[y]?.[m - 1] ?? 30;
}

function fmtAD(y: number, m: number, d: number): string {
  // Local-date math (not toISOString) — toISOString shifts a day westward
  // after 15:45 NPT, which corrupted saved dates by one day.
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface BSDateInputProps {
  value?: string;
  onChange?: (adDate: string) => void;
  name?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  /** "ad" (default) emits/accepts "YYYY-MM-DD" AD; "bs" emits/accepts BS
   *  "YYYY-MM-DD" — for legacy fields that already store BS strings. */
  emit?: "ad" | "bs";
}

export function BSDateInput({
  value,
  onChange,
  name,
  className = "",
  disabled = false,
  required = false,
  placeholder,
  emit = "ad",
}: BSDateInputProps) {
  const { lang, t } = useI18n();
  const serverTime = useServerTime();
  const todayBS = adToBS(serverTime?.dateAD ?? new Date().toISOString().slice(0, 10));

  // Seed state from either an AD or a BS input string.
  const init = value
    ? /^\d{4}-(0[1-9]|1[0-2])-/.test(value) && emit === "bs"
      ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) }
      : adToBS(value)
    : todayBS;
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [day, setDay] = useState<number | null>(value ? init.day : null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const bs = adToBS(value);
      setYear(bs.year);
      setMonth(bs.month);
      setDay(bs.day);
    }
  }, [value]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  function commit(y: number, m: number, d: number) {
    const maxD = getDaysInMonth(y, m);
    const sd = Math.min(d, maxD);
    setDay(sd);
    if (emit === "bs") {
      onChange?.(fmtAD(y, m, sd)); // BS "YYYY-MM-DD" — same shape, BS numbers
      setOpen(false);
      return;
    }
    // bsToAD returns a Date built on the BS_EPOCH_AD local date — format it
    // with local components (not toISOString, which shifts a day westward
    // after 15:45 NPT and corrupted saved dates by one day).
    const ad = bsToAD({ year: y, month: m, day: sd });
    onChange?.(fmtAD(ad.getFullYear(), ad.getMonth() + 1, ad.getDate()));
    setOpen(false);
  }

  function pickToday() {
    commit(todayBS.year, todayBS.month, todayBS.day);
  }

  const months = lang === "ne" ? BS_MONTHS_NE : BS_MONTHS;
  const bsString = day !== null ? fmtAD(year, month, day) : ""; // BS numbers, "YYYY-MM-DD" shape
  const adString = day !== null
    ? (() => {
        const ad = bsToAD({ year, month, day });
        return fmtAD(ad.getFullYear(), ad.getMonth() + 1, ad.getDate());
      })()
    : "";
  const hiddenValue = emit === "bs" ? bsString : adString;
  const displayStr =
    day !== null ? `${day} ${months[month - 1]} ${year}` : "";
  const adDisplay = day !== null && emit === "ad" ? adString : null;
  const years = Array.from({ length: 20 }, (_, i) => 2075 + i);
  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);
  const weekDays = lang === "ne"
    ? ["आइ", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Weekday offset of the 1st of the shown BS month (grid alignment)
  const firstWeekday = (() => {
    try {
      const ad = bsToAD({ year, month, day: 1 });
      return new Date(ad.getFullYear(), ad.getMonth(), ad.getDate()).getDay();
    } catch {
      return 0;
    }
  })();

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {name && (
        <input type="hidden" name={name} value={hiddenValue} required={required} />
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-[13px] transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className={displayStr ? "" : "text-muted-foreground"}>
            {displayStr || placeholder || t("Pick date", "मिति छान्नुहोस्")}
          </span>
          {adDisplay && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{adDisplay} AD</span>
          )}
        </span>
        <CalendarDays className="h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[272px] rounded-lg border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex gap-2">
            <select
              aria-label="Year"
              value={year}
              onChange={(e) => {
                const y = Number(e.target.value);
                setYear(y);
                const md = getDaysInMonth(y, month);
                if (day !== null && day > md) setDay(md);
              }}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-[12px]"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y} BS</option>
              ))}
            </select>
            <select
              aria-label="Month"
              value={month}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonth(m);
                const md = getDaysInMonth(year, m);
                if (day !== null && day > md) setDay(md);
              }}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-[12px]"
            >
              {months.map((label, i) => (
                <option key={i + 1} value={i + 1}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {weekDays.map((d) => (
              <div key={d} className="py-1 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((d) => {
              const isToday =
                todayBS.year === year && todayBS.month === month && todayBS.day === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => commit(year, month, d)}
                  className={cn(
                    "h-7 w-7 justify-self-center rounded text-[12px] tabular-nums transition-colors hover:bg-accent",
                    d === day
                      ? "bg-primary font-semibold text-primary-foreground hover:bg-primary"
                      : "",
                    isToday && d !== day ? "ring-1 ring-primary/50 font-semibold" : ""
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <span className="text-[10px] text-muted-foreground">
              {adDisplay ? `${adDisplay} AD` : t("No date chosen", "मिति छानिएको छैन")}
            </span>
            <button
              type="button"
              onClick={pickToday}
              className="rounded-md border px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-accent"
            >
              {t("Today", "आज")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * BSMonthInput - picks a BS year+month, emits "YYYY-MM" BS string.
 */
export function BSMonthInput({
  value,
  onChange,
  name,
  className = "",
  disabled = false,
}: {
  value?: string;
  onChange?: (bsYearMonth: string) => void;
  name?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { lang } = useI18n();
  const today = adToBS(new Date().toISOString().slice(0, 10));
  const parts = value?.split("-") ?? [];
  const [year, setYear] = useState(parts[0] ? Number(parts[0]) : today.year);
  const [month, setMonth] = useState(parts[1] ? Number(parts[1]) : today.month);

  function emit(y: number, m: number) {
    onChange?.(`${y}-${String(m).padStart(2, "0")}`);
  }

  const years = Array.from({ length: 15 }, (_, i) => 2075 + i);
  const months = lang === "ne" ? BS_MONTHS_NE : BS_MONTHS;

  return (
    <div className={`flex gap-2 ${className}`}>
      {name && (
        <input type="hidden" name={name} value={`${year}-${String(month).padStart(2, "0")}`} />
      )}
      <select
        disabled={disabled}
        value={year}
        onChange={(e) => { const y = Number(e.target.value); setYear(y); emit(y, month); }}
        className="h-9 rounded-md border border-input bg-background px-2 text-[13px]"
      >
        {years.map((y) => <option key={y} value={y}>{y} BS</option>)}
      </select>
      <select
        disabled={disabled}
        value={month}
        onChange={(e) => { const m = Number(e.target.value); setMonth(m); emit(year, m); }}
        className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-[13px]"
      >
        {months.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
    </div>
  );
}
