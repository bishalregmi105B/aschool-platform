"use client";

/**
 * ShortcutsHelp — shared "?" / Ctrl+/ keyboard-shortcut overlay for the
 * Designer canvas and the Writer ribbon (wave-J, A6 workspace polish).
 *
 * The two editors pass their OWN verified shortcut lists, so the dialog
 * only ever advertises keys that actually work (hard rule 3: "check which
 * shortcuts actually exist in the editor and only advertise real ones").
 * Fluent card styling via --w11-* tokens; Esc / backdrop closes; the list
 * is scrollable on short viewports.
 */
import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

export function ShortcutChips({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1 justify-end">
      {keys.map((k, i) => (
        <kbd
          key={`${k}-${i}`}
          className="min-w-[20px] px-1.5 py-0.5 rounded-[var(--w11-radius-sm)] border border-[var(--w11-border-default)] text-[10px] font-mono font-semibold text-center"
          style={{ background: "var(--w11-control-bg)", color: "var(--w11-text-secondary)" }}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutsHelpDialog({
  open, onClose, title = "Keyboard shortcuts", groups,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  groups: ShortcutGroup[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Keyboard className="h-4 w-4" style={{ color: "var(--w11-accent)" }} />
            {title}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto commandbar-button !h-7 !min-h-0 w-7 text-[var(--w11-text-secondary)]"
              aria-label="Close"
              style={{ borderRadius: "var(--w11-radius-sm)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 space-y-4 text-sm">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--w11-text-tertiary)] mb-1.5">{g.title}</div>
              <div className="space-y-1">
                {g.items.map((it) => (
                  <div key={it.label} className="flex items-center justify-between gap-3 py-0.5">
                    <span className="text-[13px] text-[var(--w11-text-primary)]">{it.label}</span>
                    <ShortcutChips keys={it.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-[var(--w11-text-tertiary)] pt-1">
            Press <kbd className="px-1 rounded border" style={{ borderColor: "var(--w11-border-default)" }}>?</kbd> or{" "}
            <kbd className="px-1 rounded border" style={{ borderColor: "var(--w11-border-default)" }}>Ctrl+/</kbd> to toggle this panel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
