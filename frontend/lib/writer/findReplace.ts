/**
 * Writer v2 — Find & Replace engine (ProseMirror plugin).
 *
 * Highlight-all via inline decorations, find next/prev, single replace and
 * replace-all. Shared by the Home (Editing group) and Review tabs.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";

export interface FindState {
  query: string;
  caseSensitive: boolean;
  index: number; // current match index
}

interface Match {
  from: number;
  to: number;
}

/** Collect every occurrence of `query` in the document text. */
export function findMatches(doc: { descendants: (cb: (node: any, pos: number) => void) => void }, query: string, caseSensitive: boolean): Match[] {
  const out: Match[] = [];
  if (!query) return out;
  const needle = caseSensitive ? query : query.toLowerCase();
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return true;
    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let i = text.indexOf(needle);
    while (i !== -1) {
      out.push({ from: pos + i, to: pos + i + needle.length });
      i = text.indexOf(needle, i + needle.length);
    }
    return true;
  });
  return out;
}

export function countMatches(editor: Editor, query: string, caseSensitive: boolean): number {
  return findMatches(editor.state.doc, query, caseSensitive).length;
}

export const findReplaceKey = new PluginKey<{ query: string; caseSensitive: boolean; index: number; tick: number }>(
  "writerFindReplace",
);

export const FindReplaceExtension = Extension.create({
  name: "writerFindReplace",
  addProseMirrorPlugins() {
    return [
      new Plugin<{ query: string; caseSensitive: boolean; index: number; tick: number }>({
        key: findReplaceKey,
        state: {
          init: () => ({ query: "", caseSensitive: false, index: 0, tick: 0 }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(findReplaceKey);
            if (meta) return { ...prev, ...meta };
            return prev;
          },
        },
        props: {
          decorations(state) {
            const s = findReplaceKey.getState(state);
            if (!s || !s.query) return DecorationSet.empty;
            const matches = findMatches(state.doc, s.query, s.caseSensitive);
            if (!matches.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              matches.map((m, i) =>
                Decoration.inline(m.from, m.to, {
                  class: i === s.index % matches.length ? "writer-find-hit current" : "writer-find-hit",
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

/** Update the shared find state and force a decorations re-render. */
export function setFindState(editor: Editor, patch: Partial<FindState> & { tick?: number }) {
  const cur = findReplaceKey.getState(editor.state) || { query: "", caseSensitive: false, index: 0, tick: 0 };
  const next = { ...cur, ...patch };
  // keep index in range
  const matches = findMatches(editor.state.doc, next.query, next.caseSensitive);
  if (matches.length) next.index = ((next.index % matches.length) + matches.length) % matches.length;
  const tr = editor.state.tr.setMeta(findReplaceKey, next).setMeta("addToHistory", false);
  editor.view.dispatch(tr);
  return matches.length;
}

export function findNextMatch(editor: Editor, dir: 1 | -1 = 1) {
  const s = findReplaceKey.getState(editor.state);
  if (!s || !s.query) return;
  const matches = findMatches(editor.state.doc, s.query, s.caseSensitive);
  if (!matches.length) return;
  let idx = (s.index + dir + matches.length) % matches.length;
  setFindState(editor, { index: idx, tick: (s.tick || 0) + 1 });
  const m = matches[idx];
  editor.view.dispatch(
    editor.state.tr
      .setSelection(TextSelection.create(editor.state.doc, m.from, m.to))
      .scrollIntoView()
      .setMeta(findReplaceKey, { ...s, index: idx, tick: (s.tick || 0) + 1 }),
  );
}

/** Replace the currently selected match (if it matches the query). */
export function replaceCurrentMatch(editor: Editor, replacement: string): boolean {
  const s = findReplaceKey.getState(editor.state);
  if (!s || !s.query) return false;
  const matches = findMatches(editor.state.doc, s.query, s.caseSensitive);
  if (!matches.length) return false;
  const idx = s.index % matches.length;
  const m = matches[idx];
  const { from, to } = editor.state.selection;
  const sel = { from, to };
  const target = sel.from === m.from && sel.to === m.to ? sel : m;
  editor.chain().focus().insertContentAt({ from: target.from, to: target.to }, replacement).run();
  setFindState(editor, { index: idx, tick: (s.tick || 0) + 1 });
  return true;
}

/** Replace every match, walking from the end so positions stay valid. */
export function replaceAllMatches(editor: Editor, replacement: string): number {
  const s = findReplaceKey.getState(editor.state);
  if (!s || !s.query) return 0;
  const matches = findMatches(editor.state.doc, s.query, s.caseSensitive);
  if (!matches.length) return 0;
  const { tr } = editor.state;
  for (let i = matches.length - 1; i >= 0; i--) {
    tr.insertText(replacement, matches[i].from, matches[i].to);
  }
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
  setFindState(editor, { index: 0 });
  return matches.length;
}

/** Convenience: jump the view to the current match (used after query edits). */
export function scrollToCurrentMatch(view: import("@tiptap/pm/view").EditorView) {
  const s = findReplaceKey.getState(view.state);
  if (!s || !s.query) return;
  const matches = findMatches(view.state.doc, s.query, s.caseSensitive);
  if (!matches.length) return;
  const m = matches[s.index % matches.length];
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView());
}
