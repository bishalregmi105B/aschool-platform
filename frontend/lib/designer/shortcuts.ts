"use client";

/**
 * shortcuts — Canva-style keyboard handling for the canvas editor.
 * One window keydown listener with an action map; CanvasEditor supplies the
 * implementations. Skips events originating in inputs/contentEditable.
 */
import type { DesignerPanel } from "./store";

export interface ShortcutHandlers {
  undo: () => void;
  redo: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  delete: () => void;
  escape: () => void;
  nudge: (dx: number, dy: number) => void;
  group: () => void;
  ungroup: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  save: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  togglePanel: (p: DesignerPanel) => void;
  nextPage: () => void;
  prevPage: () => void;
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable
  );
}

export function attachShortcuts(handlers: ShortcutHandlers): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // ── modifier combos ────────────────────────────────────────────
    if (mod) {
      switch (key) {
        case "z":
          e.preventDefault();
          e.shiftKey ? handlers.redo() : handlers.undo();
          return;
        case "y":
          e.preventDefault();
          handlers.redo();
          return;
        case "c":
          if (!e.shiftKey) {
            // don't block native copy inside selections — nothing editable here
            e.preventDefault();
            handlers.copy();
          }
          return;
        case "v":
          e.preventDefault();
          handlers.paste();
          return;
        case "d":
          e.preventDefault();
          handlers.duplicate();
          return;
        case "g":
          e.preventDefault();
          e.shiftKey ? handlers.ungroup() : handlers.group();
          return;
        case "s":
          e.preventDefault();
          handlers.save();
          return;
        case "]":
          e.preventDefault();
          handlers.bringToFront();
          return;
        case "[":
          e.preventDefault();
          handlers.sendToBack();
          return;
        case "=":
        case "+":
          e.preventDefault();
          handlers.zoomIn();
          return;
        case "-":
          e.preventDefault();
          handlers.zoomOut();
          return;
        case "0":
          e.preventDefault();
          handlers.zoomFit();
          return;
      }
      return;
    }

    // ── plain keys ─────────────────────────────────────────────────
    switch (e.key) {
      case "Delete":
      case "Backspace":
        e.preventDefault();
        handlers.delete();
        return;
      case "Escape":
        handlers.escape();
        return;
      case "ArrowLeft":
        e.preventDefault();
        handlers.nudge(e.shiftKey ? -10 : -1, 0);
        return;
      case "ArrowRight":
        e.preventDefault();
        handlers.nudge(e.shiftKey ? 10 : 1, 0);
        return;
      case "ArrowUp":
        e.preventDefault();
        handlers.nudge(0, e.shiftKey ? -10 : -1);
        return;
      case "ArrowDown":
        e.preventDefault();
        handlers.nudge(0, e.shiftKey ? 10 : 1);
        return;
      case "PageDown":
        handlers.nextPage();
        return;
      case "PageUp":
        handlers.prevPage();
        return;
      case "t":
        handlers.togglePanel("text");
        return;
      case "m":
        handlers.togglePanel("shapes");
        return;
      case "l":
        handlers.togglePanel("layers");
        return;
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
