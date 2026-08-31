"use client";

/**
 * useDesignerStore — central Canva-style editor state (zustand).
 *
 * Owns:
 *  - History: debounced JSON snapshots that SURVIVE page switches and restore
 *    selection on undo/redo (the old per-event snapshot was wiped on page turn)
 *  - Clipboard: copy/paste across pages and documents (async fabric v6 clone)
 *  - UI state: active panel, zoom, snapping toggle, guides visibility
 *
 * The store never touches the fabric instance directly — CanvasEditor wires
 * store actions to the canvas via useCanvas. This keeps the store testable
 * and the canvas lifecycle independent.
 */
import { create } from "zustand";

export const HISTORY_LIMIT = 100;

export interface HistoryEntry {
  /** full multi-page doc JSON + the page index it was captured on */
  doc: string;
  pageIdx: number;
  /** serialized selection (object names) to restore on undo/redo */
  selection: string[];
}

export type DesignerPanel =
  | "templates"
  | "shapes"
  | "text"
  | "media"
  | "graphics"
  | "background"
  | "data"
  | "layers"
  | "brand"
  | null;

interface DesignerState {
  // ── history ─────────────────────────────────────────────────────────
  // past = snapshot stack; the LAST entry mirrors the live document.
  // undo pops it and returns the previous entry to restore.
  past: HistoryEntry[];
  future: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clearHistory: () => void;

  // ── clipboard (serialized fabric objects) ──────────────────────────
  clipboard: object[] | null;
  setClipboard: (objs: object[]) => void;

  // ── ui ──────────────────────────────────────────────────────────────
  activePanel: DesignerPanel;
  setActivePanel: (p: DesignerPanel) => void;
  zoom: number;
  setZoom: (z: number) => void;
  snapping: boolean;
  toggleSnapping: () => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showRulers: boolean;
  toggleRulers: () => void;
  dirty: boolean;
  setDirty: (d: boolean) => void;
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  pushHistory: (entry) => {
    const { past } = get();
    const next = [...past, entry].slice(-HISTORY_LIMIT);
    set({ past: next, future: [], canUndo: next.length > 1, canRedo: false });
  },
  undo: () => {
    const { past, future } = get();
    if (past.length < 2) return null; // need a state beneath the live one
    const live = past[past.length - 1];
    const restore = past[past.length - 2];
    const newPast = past.slice(0, -1);
    const newFuture = [live, ...future].slice(0, HISTORY_LIMIT);
    set({
      past: newPast,
      future: newFuture,
      canUndo: newPast.length > 1,
      canRedo: true,
    });
    return restore;
  },
  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return null;
    const entry = future[0];
    const newFuture = future.slice(1);
    const newPast = [...past, entry].slice(-HISTORY_LIMIT);
    set({
      past: newPast,
      future: newFuture,
      canUndo: newPast.length > 1,
      canRedo: newFuture.length > 0,
    });
    return entry;
  },
  clearHistory: () => set({ past: [], future: [], canUndo: false, canRedo: false }),

  clipboard: null,
  setClipboard: (objs) => set({ clipboard: objs }),

  activePanel: "templates",
  setActivePanel: (p) =>
    set((s) => ({ activePanel: s.activePanel === p ? null : p })),
  zoom: 1,
  setZoom: (z) => set({ zoom: Math.min(4, Math.max(0.2, z)) }),
  snapping: true,
  toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
  showGrid: false,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  showRulers: false,
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  dirty: false,
  setDirty: (d) => set({ dirty: d }),
}));
