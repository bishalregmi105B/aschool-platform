"use client";

/**
 * Writer v2 — shared context passed from the page into every ribbon tab,
 * dialog and control. Keeps tabs stateless and the page the single owner
 * of the editor + settings.
 */
import type { Editor } from "@tiptap/core";
import type {
  PageNumberPos, ShapeKind, WriterSettings,
} from "@/lib/writer/settings";
import type { FindState } from "@/lib/writer/findReplace";

export interface WordCounts {
  words: number;
  chars: number;
  paras: number;
  pages: number;
  page: number;
}

export interface WriterCtx {
  editor: Editor;
  settings: WriterSettings;
  /** merge a settings patch + mark the doc dirty */
  update: (patch: Partial<WriterSettings>) => void;

  // view state
  zoom: number;
  setZoom: (z: number) => void;
  focusMode: boolean;
  setFocusMode: (b: boolean) => void;
  toggleRibbon: () => void;
  spellCheck: boolean;
  toggleSpellCheck: () => void;

  // shared editing state
  painterActive: boolean;
  togglePainter: (marks?: { type: string; attrs: Record<string, unknown> }[]) => void;
  counts: WordCounts;
  find: FindState;
  setFind: (patch: Partial<FindState>) => void;

  // actions
  openFindReplace: (showReplace?: boolean) => void;
  openHeaderFooter: () => void;
  insertWordArt: () => void;
  insertSymbol: (ch: string) => void;
  insertImageFile: (file: File) => void;
  insertImageUrl: (url: string) => void;
  insertLink: (url: string) => void;
  insertTextbox: () => void;
  insertShape: (kind: ShapeKind) => void;
  insertPageBreak: () => void;
  insertDivider: () => void;
  insertTable: (rows: number, cols: number, header?: boolean) => void;
  setPageNumber: (pos: PageNumberPos) => void;
  exportDocx: () => void;
  exportPdf?: () => void;
  exporting: boolean;

  // review (comments + tracked changes)
  trackChanges: boolean;
  toggleTrackChanges: () => void;
  addCommentOnSelection: () => void;
  acceptAllChanges: () => void;
  rejectAllChanges: () => void;
}
