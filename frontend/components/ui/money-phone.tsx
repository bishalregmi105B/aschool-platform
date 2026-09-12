"use client";
/**
 * Money & Phone inputs — locale-aware masks for Nepali data entry.
 *
 * MoneyInput: NPR grouping (last 3, then 2s — 1,23,456.75), optional NPR
 * prefix, emits a raw number string so payloads stay numeric.
 * PhoneInput: normalizes to 10 digits, +977 handling, formats as it types.
 */
import * as React from "react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function MoneyInput({
  value,
  onChange,
  className,
  id,
  placeholder,
  disabled,
  name,
}: {
  value?: string | number;
  onChange?: (raw: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}) {
  const { t } = useI18n();
  const [display, setDisplay] = React.useState(() => format(value ?? ""));

  function format(v: string | number): string {
    if (v === "" || v === null || v === undefined) return "";
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    // Nepali grouping: last 3 then groups of 2
    const [intPart, decPart] = n.toString().split(".");
    let s = intPart.replace(/-/g, "");
    let out = "";
    if (s.length > 3) {
      out = s.slice(-3);
      s = s.slice(0, -3);
      while (s.length > 0) {
        out = s.slice(-2) + "," + out;
        s = s.slice(0, -2);
      }
    } else out = s;
    return (n < 0 ? "-" : "") + out + (decPart ? "." + decPart : "");
  }

  function handle(raw: string) {
    const digits = raw.replace(/[^0-9.]/g, "");
    // only first dot
    const clean = digits.includes(".")
      ? digits.slice(0, digits.indexOf(".") + 1) +
        digits.slice(digits.indexOf(".") + 1).replace(/\./g, "")
      : digits;
    setDisplay(format(clean));
    onChange?.(clean);
  }

  return (
    <div className={cn("relative", className)}>
      <span className="text-tertiary pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium">
        {t("Rs.", "रू")}
      </span>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        disabled={disabled}
        className="pl-9 text-right tabular-nums"
        value={display}
        placeholder={placeholder ?? "0"}
        onChange={(e) => handle(e.target.value)}
      />
    </div>
  );
}

export function PhoneInput({
  value,
  onChange,
  className,
  id,
  placeholder,
  disabled,
  name,
}: {
  value?: string;
  onChange?: (raw: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}) {
  const { t } = useI18n();
  const [display, setDisplay] = React.useState(() => normalize(value ?? "").replace(/^(\d{3})(\d{3})(\d{0,4}).*/, (_m, a, b, c) => c ? `${a}-${b}-${c}` : `${a}-${b}`));

  function normalize(raw: string): string {
    let d = raw.replace(/[^0-9]/g, "");
    if (d.startsWith("977")) d = d.slice(3);
    return d.slice(0, 10);
  }

  function handle(raw: string) {
    const d = normalize(raw);
    setDisplay(
      d.length > 6 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
      : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}`
      : d
    );
    onChange?.(d);
  }

  return (
    <div className={cn("relative", className)}>
      <span className="text-tertiary pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium">
        +977
      </span>
      <Input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        className="pl-14 tabular-nums"
        value={display}
        placeholder={placeholder ?? "98XXXXXXXX"}
        onChange={(e) => handle(e.target.value)}
      />
    </div>
  );
}
