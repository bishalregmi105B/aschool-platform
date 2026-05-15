"use client";
/**
 * BSDateInput - shows a BS (Bikram Sambat) date picker.
 * Emits AD date strings ("YYYY-MM-DD") so the backend stays unchanged.
 */
import { useState, useEffect, useRef } from "react";
import {
  adToBS,
  bsToAD,
  BS_MONTHS,
  BS_DATA,
  type BSDate,
} from "@/lib/nepali_date";

function getDaysInMonth(y: number, m: number): number {
  return BS_DATA[y]?.[m - 1] ?? 30;
}

interface BSDateInputProps {
  value?: string;
  onChange?: (adDate: string) => void;
  name?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export function BSDateInput({
  value,
  onChange,
  name,
  className = "",
  disabled = false,
  required = false,
}: BSDateInputProps) {
  const init = adToBS(value || new Date().toISOString().split("T")[0]);
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [day, setDay] = useState(init.day);
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
    const ad = bsToAD({ year: y, month: m, day: sd });
    onChange?.(ad.toISOString().split("T")[0]);
    setOpen(false);
  }

  const adHidden = bsToAD({ year, month, day }).toISOString().split("T")[0];
  const displayStr = `${day} ${BS_MONTHS[month - 1]} ${year}`;
  const years = Array.from({ length: 20 }, (_, i) => 2075 + i);
  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {name && (
        <input type="hidden" name={name} value={adHidden} required={required} />
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-input rounded-md px-3 py-2 text-sm bg-background hover:bg-accent/50 disabled:opacity-50"
      >
        <span>{displayStr}</span>
        <svg className="h-4 w-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[260px]">
          <div className="flex gap-2 mb-3">
            <select
              value={year}
              onChange={(e) => {
                const y = Number(e.target.value);
                setYear(y);
                const md = getDaysInMonth(y, month);
                if (day > md) setDay(md);
              }}
              className="flex-1 border border-input rounded px-2 py-1 text-sm bg-background"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y} BS</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonth(m);
                const md = getDaysInMonth(year, m);
                if (day > md) setDay(md);
              }}
              className="flex-1 border border-input rounded px-2 py-1 text-sm bg-background"
            >
              {BS_MONTHS.map((label, i) => (
                <option key={i + 1} value={i + 1}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
            ))}
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => commit(year, month, d)}
                className={`h-7 w-7 rounded text-sm hover:bg-primary hover:text-primary-foreground transition-colors ${
                  d === day ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"
                }`}
              >
                {d}
              </button>
            ))}
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
  const today = adToBS(new Date());
  const parts = value?.split("-") ?? [];
  const [year, setYear] = useState(parts[0] ? Number(parts[0]) : today.year);
  const [month, setMonth] = useState(parts[1] ? Number(parts[1]) : today.month);

  function emit(y: number, m: number) {
    onChange?.(`${y}-${String(m).padStart(2, "0")}`);
  }

  const years = Array.from({ length: 15 }, (_, i) => 2075 + i);

  return (
    <div className={`flex gap-2 ${className}`}>
      {name && (
        <input type="hidden" name={name} value={`${year}-${String(month).padStart(2, "0")}`} />
      )}
      <select
        disabled={disabled}
        value={year}
        onChange={(e) => { const y = Number(e.target.value); setYear(y); emit(y, month); }}
        className="border border-input rounded px-2 py-1 text-sm bg-background"
      >
        {years.map((y) => <option key={y} value={y}>{y} BS</option>)}
      </select>
      <select
        disabled={disabled}
        value={month}
        onChange={(e) => { const m = Number(e.target.value); setMonth(m); emit(year, m); }}
        className="border border-input rounded px-2 py-1 text-sm bg-background"
      >
        {BS_MONTHS.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
    </div>
  );
}
