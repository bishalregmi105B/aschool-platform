"use client";

import { useCallback, useState } from "react";
import type { DragEvent } from "react";

/**
 * Cross-app drag & drop for vault files.
 *
 * Files dragged out of the AOS File Manager (or a FilePicker grid) carry a
 * JSON payload under this custom MIME type, plus the file URL under
 * "text/uri-list" / "text/plain" so generic targets still receive something
 * useful. Drop targets use {@link useVaultFileDrop}.
 */

/** Custom MIME type identifying a vault-file drag. */
export const VAULT_FILE_MIME = "application/x-aschool-file";

/** Payload carried by a vault-file drag. */
export interface VaultDragPayload {
  id: string;
  url: string;
  name: string;
  file_type: string;
}

/** Anything with the fields needed to start a vault-file drag (e.g. ManagedFile). */
export interface VaultDragSource {
  id: string;
  url?: string | null;
  original_name: string;
  file_type: string;
}

/** Mark a drag as carrying a vault file (custom MIME + plain-URL fallbacks). */
export function setVaultDragData(e: DragEvent, file: VaultDragSource): void {
  const payload: VaultDragPayload = {
    id: file.id,
    url: file.url ?? "",
    name: file.original_name,
    file_type: file.file_type,
  };
  e.dataTransfer.setData(VAULT_FILE_MIME, JSON.stringify(payload));
  if (payload.url) {
    e.dataTransfer.setData("text/uri-list", payload.url);
    e.dataTransfer.setData("text/plain", payload.url);
  }
  e.dataTransfer.effectAllowed = "copy";
}

/**
 * True when a drag carries a vault-file payload — or, failing that, a plain
 * URL it can fall back to. OS file drags ("Files") are never treated as
 * vault/URL drags, even where the browser also advertises text types.
 */
export function isVaultFileDrag(e: DragEvent): boolean {
  const types = e.dataTransfer.types;
  if (types.includes(VAULT_FILE_MIME)) return true;
  if (types.includes("Files")) return false;
  return types.includes("text/uri-list") || types.includes("text/plain");
}

function firstDroppedUrl(e: DragEvent): string {
  // "text/uri-list" lines may start with "#" comments; take the first real URL.
  const uriList = e.dataTransfer.getData("text/uri-list");
  if (uriList) {
    const url = uriList
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    if (url) return url;
  }
  return e.dataTransfer.getData("text/plain").trim();
}

export interface VaultDropHandlers {
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

/**
 * Drop target for vault-file drags.
 *
 *   const { isOver, dropProps } = useVaultFileDrop({ onFile: (f) => ... });
 *   <div {...dropProps} style={{ outline: isOver ? "2px dashed var(--w11-accent)" : "none" }} />
 *
 * Handlers ignore (and let bubble) anything that isn't a vault/URL drag, so
 * they compose cleanly with existing OS-file drop zones.
 */
export function useVaultFileDrop({
  onFile,
  onUrl,
}: {
  /** Receives the dragged vault file ({ id, url, name, file_type }). */
  onFile: (file: VaultDragPayload) => void;
  /** Optional: accept plain URL drops (text/uri-list) from generic sources. */
  onUrl?: (url: string) => void;
}): { isOver: boolean; dropProps: VaultDropHandlers } {
  const [isOver, setIsOver] = useState(false);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!isVaultFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    // Only clear when the pointer leaves the element itself, not its children.
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      if (!isVaultFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setIsOver(false);
      const raw = e.dataTransfer.getData(VAULT_FILE_MIME);
      if (raw) {
        try {
          const payload = JSON.parse(raw) as VaultDragPayload;
          if (payload && typeof payload.id === "string") {
            onFile(payload);
            return;
          }
        } catch {
          // Malformed payload — fall through to the plain-URL path.
        }
      }
      const url = firstDroppedUrl(e);
      if (url && onUrl) onUrl(url);
    },
    [onFile, onUrl],
  );

  return { isOver, dropProps: { onDragOver, onDragLeave, onDrop } };
}
