"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Image as ImageIcon, X } from "lucide-react";
import { FilePicker } from "@/components/files/FilePicker";
import { useVaultFileDrop } from "@/components/files/dnd";

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
  const shape = circular ? "rounded-full" : "rounded-[var(--w11-radius-md)]";

  if (!url || errored) {
    return (
      <div
        className={`h-12 w-12 shrink-0 flex items-center justify-center ${shape}`}
        style={{
          border: "1px dashed var(--w11-border-default)",
          background: "var(--w11-control-bg)",
          color: "var(--w11-text-tertiary)",
          transition: "border-color var(--w11-transition-fast)",
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
        boxShadow: "var(--w11-elevation-card)",
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
 * Replaces free-text URL inputs: users pick an existing file, upload a
 * new one inside the picker, or drag a vault file onto the field —
 * the stored value stays a plain URL string.
 */
export function VaultImageField({
  value,
  onChange,
  label,
  circular = false,
  fileType = "image",
}: VaultImageFieldProps) {
  const [open, setOpen] = useState(false);

  // The whole field row accepts vault-file drags (and plain URL drags).
  const { isOver, dropProps } = useVaultFileDrop({
    onFile: (f) => {
      if (fileType && f.file_type && f.file_type !== fileType) {
        toast.error(`This field accepts ${fileType} files`);
        return;
      }
      if (f.url) onChange(f.url);
    },
    onUrl: (url) => onChange(url),
  });

  return (
    <div
      {...dropProps}
      className="flex items-center gap-2 rounded-[var(--w11-radius-md)]"
      style={{
        outline: isOver ? "2px dashed var(--w11-accent)" : "none",
        outlineOffset: 2,
        background: isOver ? "var(--w11-accent-light)" : undefined,
        transition: "background var(--w11-transition-fast)",
      }}
    >
      <PreviewThumb
        key={value ?? ""}
        url={value}
        circular={circular}
        alt={label || "Selected image"}
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="subtle inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
        style={{ color: "var(--w11-text-secondary)" }}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Choose from Vault
      </button>

      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Clear selection"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--w11-radius-sm)] transition-colors hover:bg-[var(--w11-control-hover)] hover:text-[var(--w11-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--w11-accent)]"
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
