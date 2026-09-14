# Wave J — Creators: Designer canvas + Writer (Word-like) editors

Scope (exclusive): `components/designer/**` (11 files), `components/writer/**` (11),
`lib/designer/**`, `lib/writer/**`, `app/dashboard/designer/**` (incl. writer/writer2/editor/templates).
Archetype: A6 workspace/editor (IMPROVEMENT_PLAN 31.0/31.3/32, Part 34 row 54,
Part 4.3 row 16, aschool-frontend.md §6/§7, §14 #6/#7/#11).

## 0. Research notes (per area)

**Canva editor simplification** — Canva keeps ONE contextual surface: a thin
top command bar + a left icon-rail that slides a single panel + a right
properties rail that only appears when something is selected. Lesson applied:
group the designer top-bar controls into the same visual rhythm (Undo/Redo,
Zoom, Snap/Grid separators) and make the right rail *confirm* what it is
editing ("Properties — <layer name>") instead of a generic header.
**Figma / FigJam panel UX** — layers are a true indented tree with
always-visible eye/lock state icons (state at a glance, not hover-only) and
chevron-collapsible groups. Applied to LayersPanel (win11-treeview feel) and
PropertiesPanel (Layout/Fill/Stroke/Text collapsible sections).
**Microsoft Word ribbon (2025)** — ribbon = labelled command *groups*, buttons
carry shortcut hints in their tooltips *only* where the accelerator exists;
the View tab owns Zoom/Ruler/Show, never duplicated in Review. Applied:
ViewTab verified genuinely distinct (Zoom/Show/Window), and Home-tab tooltips
now advertise only verified TipTap/Browser keys.
**Document-editor autosave status UX** — best practice is a two-state pill
that shows the *latency* honestly: "Saving…" while the (here ~3.6s) round
trip is in flight, then "Saved ✓ HH:MM" with a timestamp; an offline dot when
the network is down so silent autosave failures are visible. Applied to both
editors' chrome + the Writer status bar.

*(Search engines (Bing/DDG) returned only product-home listings; patterns
above were distilled from the named reference products' surfaces.)*

## 1. DESIGNER (9-panel canvas editor)

### LayersPanel — treeview + robust keys (fixes §14 #7)
- `components/designer/LayersPanel.tsx`: rewritten onto the 11.css
  `win11-treeview` family with `role=tree`. Fabric **group** objects now
  render as collapsible nodes (children nested under a chevron) — hierarchy
  where nesting actually exists.
- React keys are now **stable per-object identity** (`objKey()`) rather than
  the old `type-?` string that collided (the 28-key console bug) — and every
  mutation (select / rename / move / lock / hide) now addresses the **object
  reference itself**, not `o.name`. Templates with repeated or empty names can
  no longer act on the wrong layer (the residual half of the bug).
- Visibility + lock icons are **always visible** (dimmed when inactive,
  amber lock when locked) with reorder arrows in a hover reveal — Figma's
  "state at a glance". Grip + `Alt+↑/↓` keyboard reorder + clearer hints.

### PropertiesPanel — sectioned + expanders + tabular + Devanagari
- `components/designer/PropertiesPanel.tsx`: `SectionCard` gained a
  win11-expander collapse header (chevron, `aria-expanded`). Sections
  renamed/re-split to **Layout / Fill / Stroke / Text** per the 31.3 mapping
  (shape Fill and Stroke now separate collapsible cards). Number fields use
  `font-variant-numeric: tabular-nums` (aligned digit columns like the
  detail/transform rails).
- **Devanagari fonts**: the picker already led with Mukta/Noto Sans
  Devanagari/Hind; **Preeti + Kalimati** added as a first-class "Nepali
  (local fonts)" group (audit §6). `loadGoogleFont()` never tries to fetch
  those two from Google (they are school-PC fonts); Devanagari families load
  the `&subset=devanagari` Google URL.
- **Devanagari line-height**: selecting a Devanagari font on a text object
  with a tight line height (<1.55) bumps it to **1.6** so matras/descenders
  don't clip.

### Top bar — save pill, zoom, grouped export (A6 statusbar grammar)
- `components/designer/CanvasEditor.tsx`: added a live **save-state pill**
  ("Unsaved" amber / "Saving…" accent / "Saved ✓ HH:MM" green) + a `?` help
  button. Export menu items are now grouped under **Print & PDF / Image /
  Slides & vector** headers and a new **Print** action (renders the page to a
  hi-res PNG and opens the browser print dialog) was added next to PNG/PDF.
- Right rail header now **confirms the selected layer** (was the §6 "panel
  didn't flip to Properties" ambiguity) and exposes a Layers shortcut.

### Template gallery — search + category filter
- Editor Templates panel: added **category chips** (derived from the loaded
  catalog) next to the existing search, plus a "Clear search & filter" afford
  in the empty state. Cards already carry preview thumbs (TemplateThumb).

### Empty state + error boundary + shortcuts (? help)
- Empty canvas now shows a non-blocking "Start your design — Templates / Add
  text" acrylic card over the page (`emptyCanvas` derived from live object
  count) instead of a blank board.
- New `components/designer/EditorErrorBoundary.tsx` wraps both the Designer
  page (`app/dashboard/designer/editor/page.tsx`) and the Writer page: a
  fabric/TipTap init crash renders a `win11-infobar error` with **Reload** and
  **New blank document** instead of a dead AOS window.
- New shared `components/designer/ShortcutsHelp.tsx`: `?` / `Ctrl+/` opens a
  Fluent shortcut list. Designer list is the **verified** `lib/designer/
  shortcuts.ts` keymap (added `help` to that keymap + `?` / `Ctrl+/` bindings).

## 2. WRITER (Word-like ribbon)

### View tab — verified distinct, not a Review duplicate (§7/§14 #11)
- Read-and-confirmed: `components/writer/tabView.tsx` is genuinely
  Zoom (slider 50–200%, 100/Fit) / Show (Ruler+cm/in, Border, Focus) / Window
  (Collapse) — **no** duplication of Review's proofing/export groups. No
  change needed; defect from the earlier pass is already resolved.

### Ribbon tooltips — real shortcut hints only (rule 3)
- `components/writer/tabHome.tsx`: tooltips now advertise **only verified**
  accelerators — Bold/Italic/Underline (Ctrl+B/I/U), Strikethrough
  (Ctrl+⇧+X), Bullets/Numbering (Ctrl+⇧+8/7), Cut/Copy/Paste (Ctrl+X/C/V),
  Find (Ctrl+F). Non-existent keys (e.g. a fake "clear formatting" shortcut)
  were not added; the painter got a *descriptive* tooltip instead of a key.

### Find & Replace — match position (§7)
- `components/writer/dialogs.tsx`: the count line now shows **"Match X of Y"**
  (reads the ProseMirror plugin's current `index` via `findReplaceKey`) with
  the Enter/Shift+Enter navigation affordance, and recomputes after
  Replace / Replace All. Core match/replace logic in `lib/writer/findReplace.ts`
  is unchanged (contract preserved).

### Status bar — save state + connection (3.6s round-trip)
- `components/writer/chrome.tsx`: `StatusBar` upgraded to a full A6 status
  bar — page/word/char counts, a **Saving… → Unsaved → Saved ✓ HH:MM** pill
  (the mutation `isPending` drives the in-flight "Saving…" text), a live
  **online/offline** Wifi indicator (autosave failures become visible), and
  the zoom slider. `WriterRuler` is `React.memo`'d.
- Writer page (`app/dashboard/designer/writer2/page.tsx`) tracks `savedAt`,
  wires **Ctrl+S → save**, and feeds the new StatusBar props.

### Export — one grouped dropdown (§7)
- Writer's single Export menu is grouped under **Documents / Print & source**
  headers: DOCX, server PDF, Browser Print, Export raw HTML.

### Templates dialog — recent-first + search + thumbs (§7)
- `components/writer/TemplatesDialog.tsx`: added **recent-first** ordering —
  last-opened template ids persisted to `localStorage`, ranked ahead of
  `updated_at` recency — with a "Recent" clock badge on those cards. Cards,
  search, and category chips retained.

### Fonts — Mukta + Preeti (§6/§7) + error boundary + ? help
- `lib/writer/settings.ts`: added `LOCAL_NEPALI_FONTS` (Preeti/Kalimati) and
  `DEVANAGARI_FONTS`; `ALL_FONTS` now leads with the Nepali fonts so the
  font combobox includes Mukta **and** Preeti/Kalimati.
- Writer `loadGoogleFont` skips the local fonts and requests the Devanagari
  subset for Google Devanagari families; the editor base style gets a **Mukta
  fallback** after a Devanagari font so Nepali text survives on PCs without
  Preeti installed.
- Writer wrapped in the same `EditorErrorBoundary`; added the shared
  `ShortcutsHelp` dialog (`?` / `Ctrl+/`) listing the verified TipTap/browser
  keys, a title-bar `?` button, and a **new-user empty state** ("Start from a
  school template — or just begin typing", with Templates / Write-blank).

## 3. Contract & performance notes

- **Data contracts untouched**: all `/design-studio/documents`,
  `/design-studio/templates`, `/design-studio/export/pdf`, DOCX client/server
  export, and the shared writer/designer template registry flows are called
  exactly as before. No payload shape or endpoint changed.
- **Re-render avoidance**: the heavy catalog panels (`ExplorePanel`,
  `GraphicsPanel`, `DataFillPanel`) are `React.memo`'d and now receive
  **stable callbacks** created through a `canvasApiRef` (the canvas API
  object is new every render) — so Ctrl+wheel zoom, snapping and store ticks
  no longer re-render the Explore grid, the element gallery or the data-fill
  table. `WriterRuler` is memoised (per-keystroke page canvas no longer
  rebuilds the ruler tick list).
- **28 React-key errors**: kept gone and hardened (see LayersPanel object
  identity); verified via the same `objKey` path.

## 4. Files changed
- designer: `CanvasEditor.tsx`, `LayersPanel.tsx`, `PropertiesPanel.tsx`,
  `ExplorePanel.tsx`, `GraphicsPanel.tsx`, `DataFillPanel.tsx`,
  `ShortcutsHelp.tsx` (new), `EditorErrorBoundary.tsx` (new),
  `lib/designer/shortcuts.ts`, `app/dashboard/designer/editor/page.tsx`.
- writer: `chrome.tsx`, `dialogs.tsx`, `tabHome.tsx`, `TemplatesDialog.tsx`,
  `lib/writer/settings.ts`, `app/dashboard/designer/writer2/page.tsx`.

## 5. Verification
- `npx tsc --noEmit` filtered to `components/{designer,writer}`,
  `lib/{designer,writer}`, `app/dashboard/designer`: **0 errors**.
- `npx eslint` on every touched file: **0 problems**.
- Not runtime-tested (no browser drive in this wave); logic is incremental
  and tsc/lint-clean. Suggested live pass: load the Student ID Card template
  (confirm 0 key errors + tree groups), pick Preeti on a text layer (1.6 line
  height), press `?` in both editors, Ctrl+S in Writer and watch the pill
  transition, and open Templates → confirm recent-first ordering.
