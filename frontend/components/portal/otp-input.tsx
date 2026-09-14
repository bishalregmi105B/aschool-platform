"use client";

/**
 * OtpInput — a 6-box one-time-code field with auto-advance, backspace/arrow
 * navigation, and full-code paste.
 *
 * Research notes (this pass):
 * - MDN `autocomplete` doc: the standard token is `one-time-code` (NOT
 *   "otp"); the field needs name/id + a form context for the browser/SMS
 *   autofill to attach. Autofilling into the FIRST box is the supported
 *   behaviour, so this component keeps a visually-hidden single input
 *   carrying `autocomplete="one-time-code"` and mirrors its value into the
 *   boxes. (https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
 * - Mobile keyboards: inputMode="numeric" for the number pad; never block
 *   paste — users routinely paste the whole code from SMS.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  /** Fired once with the full code when all boxes are filled. */
  onComplete?: (v: string) => void;
  length?: number;
  disabled?: boolean;
  /** Accessible group label. */
  label?: string;
  autoFocus?: boolean;
  className?: string;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  label = "Verification code",
  autoFocus,
  className,
}: OtpInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");
  const completedRef = React.useRef<string>("");

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length && completedRef.current !== clean) {
      completedRef.current = clean;
      onComplete?.(clean);
    } else if (clean.length < length) {
      completedRef.current = "";
    }
    return clean;
  };

  // Autofill target: browsers put the whole code into ONE hidden field.
  const autofillRef = React.useRef<HTMLInputElement>(null);

  const setAt = (i: number, digit: string) => {
    const arr = [...chars];
    arr[i] = digit;
    commit(arr.join(""));
  };

  const handleInput = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length > 1) {
      // Typed/pasted multi-digit burst: distribute from this box onwards.
      const arr = [...chars];
      for (let k = 0; k < digits.length && i + k < length; k++) arr[i + k] = digits[k];
      commit(arr.join(""));
      refs.current[Math.min(i + digits.length, length - 1)]?.focus();
      return;
    }
    setAt(i, digits);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (chars[i]) {
        setAt(i, "");
      } else if (i > 0) {
        setAt(i - 1, "");
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "").slice(0, length);
    if (digits) {
      e.preventDefault();
      commit(digits);
      refs.current[Math.min(digits.length, length - 1)]?.focus();
    }
  };

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-center gap-2", className)}
      onPaste={handlePaste}
    >
      {/* Autofill receiver (standard token, hidden but focusable by managers) */}
      <input
        ref={autofillRef}
        aria-hidden="true"
        tabIndex={-1}
        name="otp"
        id="otp"
        autoComplete="one-time-code"
        inputMode="numeric"
        className="sr-only"
        value={value}
        onChange={(e) => commit(e.target.value)}
      />
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={`${label} digit ${i + 1}`}
          aria-invalid={value.length > 0 && !c ? "true" : undefined}
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          disabled={disabled}
          value={c}
          onInput={(e) => handleInput(i, (e.target as HTMLInputElement).value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-12 w-10 sm:h-14 sm:w-11 rounded-xl border text-center text-xl font-bold",
            "bg-white text-[color:var(--ink,#0d1f14)] focus:outline-none focus:ring-2",
            "disabled:opacity-50 min-h-[44px]",
            c
              ? "border-[color:var(--ocean,#0e3b2e)] ring-1 ring-[color:var(--ocean,#0e3b2e)]/20"
              : "border-black/15",
          )}
        />
      ))}
    </div>
  );
}
