"use client";
/**
 * ColorField — swatch + hex input pair for brand-color pickers.
 * Replaces the bare native <input type="color"> (which renders differently
 * per OS and offers no hex entry) with one consistent control.
 */
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ColorField({
  value,
  onChange,
  className,
  id,
  disabled,
}: {
  value?: string;
  onChange?: (hex: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState(value ?? "#000000");

  React.useEffect(() => {
    setDraft(value ?? "#000000");
  }, [value]);

  const valid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(draft);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        className="relative h-9 w-12 shrink-0 cursor-pointer overflow-hidden rounded-[var(--w11-radius-sm)] border border-[var(--w11-control-border)]"
        title={valid ? draft : "Pick a color"}
      >
        <span
          className="absolute inset-0"
          style={{ background: valid ? draft : "#ffffff" }}
        />
        <input
          type="color"
          value={valid ? draft : "#000000"}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange?.(e.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Color picker"
        />
      </label>
      <Input
        id={id}
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange?.(v);
        }}
        className={cn("w-28 font-mono text-[12px]", !valid && "!border-red-600")}
        placeholder="#22577A"
      />
    </div>
  );
}
