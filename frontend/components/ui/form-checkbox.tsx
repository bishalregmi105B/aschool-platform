"use client";
/**
 * FormCheckbox — the labeled checkbox used by every form.
 *
 * Works in BOTH worlds: controlled (`checked`/`onCheckedChange`) for state
 * forms, and uncontrolled (`name`, `defaultChecked`) for FormData dialogs —
 * in uncontrolled mode a hidden input mirrors the check state so
 * `formData.get(name)` keeps working (Radix Checkbox submits nothing).
 */
import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface FormCheckboxProps {
  label: string;
  ne?: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
  neDescription?: string;
  className?: string;
  id?: string;
}

export function FormCheckbox({
  label,
  ne,
  name,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  description,
  neDescription,
  className,
  id,
}: FormCheckboxProps) {
  const [internal, setInternal] = React.useState(defaultChecked ?? false);
  const controlled = checked !== undefined;
  const isChecked = controlled ? checked : internal;

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Checkbox
        id={id}
        checked={isChecked}
        onCheckedChange={(v) => {
          if (!controlled) setInternal(v === true);
          onCheckedChange?.(v === true);
        }}
        disabled={disabled}
      />
      <div className="grid gap-0.5 leading-none">
        <label
          htmlFor={id}
          className="text-[13px] font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {ne ? `${label} / ${ne}` : label}
        </label>
        {description && (
          <p className="text-tertiary !text-[11px]">
            {neDescription ?? description}
          </p>
        )}
      </div>
      {name && !controlled && (
        <input type="hidden" name={name} value={isChecked ? "on" : ""} />
      )}
      {/* Controlled + named (FormData) forms also need the mirror */}
      {name && controlled && (
        <input type="hidden" name={name} value={isChecked ? "on" : ""} />
      )}
    </div>
  );
}
