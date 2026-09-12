"use client";

import { useState } from "react";
import { FolderOpen, Image as ImageIcon, X } from "lucide-react";
import { FilePicker } from "@/components/files/FilePicker";

export interface VaultImageFieldProps {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  circular?: boolean;
  fileType?: "image" | "";
}

/**
 * 48px preview thumb. Keyed by url at the call site so it remounts (and
 * resets its error state) whenever the selected file changes.
 */
function PreviewThumb({
  url,
  circular,
  alt,
}: {
  url: string | null;
  circular: boolean;
  alt: string;
}) {
  const [errored, setErrored] = useState(false);
  const shape = circular ? "rounded-full" : "rounded-md";

  if (!url || errored) {
    return (
      <div
        className={`h-12 w-12 shrink-0 flex items-center justify-center ${shape}`}
        style={{
          border: "1px dashed var(--w11-border-default)",
          background: "var(--w11-control-bg)",
          color: "var(--w11-text-tertiary)",
        }}
      >
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className={`h-12 w-12 shrink-0 overflow-hidden ${shape}`}
      style={{
        border: "1px solid var(--w11-border-default)",
        background: "var(--w11-control-bg)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => setErrored(true)}
      />
    </div>
  );
}

/**
 * Image/file selector backed by the school vault (FilePicker).
 * Replaces free-text URL inputs: users pick an existing file or upload a
 * new one inside the picker — the stored value stays a plain URL string.
 */
export function VaultImageField({
  value,
  onChange,
  label,
  circular = false,
  fileType = "image",
}: VaultImageFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <PreviewThumb
        key={value ?? ""}
        url={value}
        circular={circular}
        alt={label || "Selected image"}
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[var(--w11-radius-md)] px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-[var(--w11-accent)] hover:text-[var(--w11-text-primary)]"
        style={{
          border: "1px solid var(--w11-border-default)",
          background: "var(--w11-control-bg)",
          color: "var(--w11-text-secondary)",
        }}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Choose from Vault
      </button>

      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Clear selection"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--w11-radius-sm)] transition-colors hover:bg-[var(--w11-control-hover)] hover:text-[var(--w11-text-primary)]"
          style={{ color: "var(--w11-text-tertiary)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <FilePicker
        open={open}
        onOpenChange={setOpen}
        onSelect={(files) => {
          const file = files[0];
          if (file) onChange(file.url);
        }}
        fileType={fileType}
        multiple={false}
        title={label ? `Select ${label}` : "Select Image"}
      />
    </div>
  );
}
