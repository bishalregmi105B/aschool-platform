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
 */
export function computePagination(editor: Editor, geom: PageGeom): PaginationResult {
  const view = editor.view;
  const doc = editor.state.doc;
  const pch = Math.max(100, geom.ph - geom.marginTop - geom.marginBottom);
  const breaks: PageBreakSpec[] = [];
  let y = 0; // content coordinate of the block cursor
  let lastBottom = 0;

  doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset) as HTMLElement | null;
    const h = el && el.nodeType === 1 ? el.offsetHeight || 0 : 0;
    const band = Math.floor(y / pch);
    const local = y - band * pch;
    const blockCanvasTop = band * (geom.ph + PAGE_GAP) + geom.marginTop + local;
    const nextOrigin = (band + 1) * (geom.ph + PAGE_GAP) + geom.marginTop;

    // Floating boxes are absolutely positioned — they take no flow height.
    if (node.type.name === "floatingBox") return;

    if (node.type.name === "pageBreak") {
      const markerH = h || 2;
      if (local > 4) {
        breaks.push({ pos: offset, h: Math.max(0, nextOrigin - blockCanvasTop) });
        y = (band + 1) * pch + markerH;
      } else {
        y += markerH;
      }
      lastBottom = Math.max(lastBottom, y);
      return;
    }

    const crosses = local + h > pch && local > 2 && h <= pch;
    if (crosses) {
      breaks.push({ pos: offset, h: Math.max(0, nextOrigin - blockCanvasTop) });
      y = (band + 1) * pch + h;
    } else {
      y += h;
    }
    lastBottom = Math.max(lastBottom, y);
  });

  const pages = Math.max(1, Math.floor((lastBottom - 1) / pch) + 1);
  const stackH = pages * (geom.ph + PAGE_GAP) - PAGE_GAP;
  return { pages, breaks, stackH };
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
