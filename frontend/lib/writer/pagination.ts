/**
 * Writer v2 — visual pagination.
 *
 * The editor is a single continuous ProseMirror surface laid over a stack of
 * fixed-height page "bands". We measure the height of every top-level block
 * and, when a block would cross a page boundary, insert a spacer widget
 * (ProseMirror Decoration.widget) before it that pushes it to the next
 * page's content origin — Word-style pagination with block-level overflow
 * splitting. Explicit page-break nodes force a break too.
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";

export const PAGE_GAP = 24; // visual gap between page bands (px)

export interface PageBreakSpec {
  /** doc position of the widget (just before the block) */
  pos: number;
  /** spacer height in px */
  h: number;
}

export interface PaginationResult {
  pages: number;
  breaks: PageBreakSpec[];
  /** total painted height of the band stack (px) */
  stackH: number;
  /** true when some block is taller than one content page — it will flow
   *  across page boundaries and needs the continuous-paper fallback */
  hasTallBlock?: boolean;
}

export interface PageGeom {
  pw: number; // page width px
  ph: number; // page height px
  marginTop: number;
  marginBottom: number;
}

/**
 * Walk top-level blocks, decide page pushes. Pure function over the live DOM
 * (heights) + doc (positions), so decorations from a previous pass do not
 * skew results.
 *
 * COORDINATE MODEL (important): `y` tracks the ACTUAL flow position inside
 * the single continuous editor surface — cumulative block heights plus every
 * spacer inserted so far. y=0 is the surface top, which is page 0's content
 * origin (marginTop). Page i's content origin in surface coords is
 *   origin(i) = i*(ph + PAGE_GAP) + marginTop
 * and its content bottom is origin(i) + pch. Pushing a block inserts a
 * spacer of (nextOrigin - y) and moves y to nextOrigin, so the model always
 * equals what the DOM will render. (The previous page-relative model
 * "forgot" the margin+gap jump each spacer inserted and drifted by ~96px
 * per pushed page — content visibly floated into the gap between bands.)
 */
export function computePagination(editor: Editor, geom: PageGeom): PaginationResult {
  const view = editor.view;
  const doc = editor.state.doc;
  const pch = Math.max(100, geom.ph - geom.marginTop - geom.marginBottom);
  const breaks: PageBreakSpec[] = [];
  let y = 0; // actual flow coordinate (see above)
  let lastBottom = 0;
  let hasTall = false;

  doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset) as HTMLElement | null;
    const h = el && el.nodeType === 1 ? el.offsetHeight || 0 : 0;

    // Floating boxes are absolutely positioned — they take no flow height.
    if (node.type.name === "floatingBox") return;

    // Page containing the current flow position (clamp: y starts at the
    // page-0 origin, before it floor() would give -1).
    const p = Math.max(0, Math.floor((y - geom.marginTop) / (geom.ph + PAGE_GAP)));
    const origin = p * (geom.ph + PAGE_GAP) + geom.marginTop;
    const contentBottom = origin + pch;
    const nextOrigin = origin + geom.ph + PAGE_GAP;

    if (node.type.name === "pageBreak") {
      const markerH = h || 2;
      if (y > origin + 4) {
        breaks.push({ pos: offset, h: Math.max(0, nextOrigin - y) });
        y = nextOrigin + markerH;
      } else {
        y += markerH;
      }
      lastBottom = Math.max(lastBottom, y);
      return;
    }

    // A block taller than one content page cannot be split — let it flow
    // across the boundary (the page shows a continuous-paper fallback).
    const crosses = y + h > contentBottom && h <= pch;
    if (crosses) {
      breaks.push({ pos: offset, h: Math.max(0, nextOrigin - y) });
      y = nextOrigin + h;
    } else {
      if (h > pch) hasTall = true;
      y += h;
    }
    lastBottom = Math.max(lastBottom, y);
  });

  const lastPage = Math.max(0, Math.floor((lastBottom - geom.marginTop) / (geom.ph + PAGE_GAP)));
  const pages = Math.max(1, lastPage + 1);
  const stackH = pages * (geom.ph + PAGE_GAP) - PAGE_GAP;
  return { pages, breaks, stackH, hasTallBlock: hasTall };
}

export const paginationKey = new PluginKey< { breaks: PageBreakSpec[] } >("writerPagination");

export const PaginationExtension = Extension.create({
  name: "writerPagination",
  addProseMirrorPlugins() {
    return [
      new Plugin<{ breaks: PageBreakSpec[] }>({
        key: paginationKey,
        state: {
          init: () => ({ breaks: [] }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(paginationKey);
            if (meta) return meta as { breaks: PageBreakSpec[] };
            return prev;
          },
        },
        props: {
          decorations(state) {
            const state0 = paginationKey.getState(state);
            const raw = state0 ? state0.breaks : [];
            if (!raw || !raw.length) return DecorationSet.empty;
            // positions may be one frame stale after doc changes — clamp so
            // DecorationSet.create never sees an out-of-range position
            const size = state.doc.content.size;
            const breaks = raw
              .filter((b) => b.pos >= 0 && b.pos <= size)
              .map((b) => ({ ...b, pos: Math.min(b.pos, size) }));
            if (!breaks.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              breaks.map((b: PageBreakSpec) =>
                Decoration.widget(
                  b.pos,
                  () => {
                    const el = document.createElement("div");
                    el.className = "writer-pagespacer";
                    el.style.height = `${Math.max(0, Math.round(b.h))}px`;
                    return el;
                  },
                  { side: -1, key: `spacer-${b.pos}-${Math.round(b.h)}` },
                ),
              ),
            );
          },
        },
      }),
    ];
  },
});

/** Dispatch fresh break positions into the pagination plugin. */
export function applyPagination(view: EditorView, breaks: PageBreakSpec[]) {
  const prev = paginationKey.getState(view.state)?.breaks || [];
  const same =
    prev.length === breaks.length &&
    prev.every((b, i) => b.pos === breaks[i].pos && Math.abs(b.h - breaks[i].h) < 1.5);
  if (same) return;
  view.dispatch(view.state.tr.setMeta(paginationKey, { breaks }).setMeta("addToHistory", false));
}
