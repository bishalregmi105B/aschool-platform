/**
 * elements.ts — Canva-style element library for the designer GraphicsPanel.
 *
 * ~150 hand-authored, single-color SVG elements across 12 categories
 * (shapes & blobs, lines & dividers, arrows, speech bubbles, stars & bursts,
 * badges & seals, banners & ribbons, checkmarks, brackets, social & media
 * icons, basic charts, cursors & pointers).
 *
 * Conventions:
 *  - Every SVG is a small set of path elements with a single dominant paint
 *    (`currentColor`, or `fill="none" stroke="currentColor"` for line work),
 *    so the panel can bake any accent color in before insert and thumbnails
 *    resolve it via CSS `color`.
 *  - `width`/`height` attributes equal the viewBox so fabric imports each
 *    element at its natural (100–160px) size — no scaling ambiguity.
 *  - Knockouts (donuts, seals with holes, glyphs) use fill-rule="evenodd"
 *    with subpaths; fabric preserves fillRule on import.
 *  - Insert path: GraphicsPanel → onAddIcon(svgWithColorBaked) →
 *    canvas.addSVG(svg, {}, color) → colorable fabric Group.
 */

export interface DesignerElementItem {
  id: string;
  label: string;
  svg: string;
  tags: string[];
}

export interface DesignerElementCategory {
  id: string;
  label: string;
  /** emoji shown in the left category rail */
  icon: string;
  items: DesignerElementItem[];
}

/** swatch row shown above the elements grid (plus a free color input) */
export const ELEMENT_PRESET_COLORS = [
  "#1e293b", "#ef4444", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
] as const;

// ── svg builders ────────────────────────────────────────────────────

/** wrap path bodies into a full svg with 1:1 width/height/viewBox */
const S = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** filled path (currentColor), optional evenodd for knockouts */
const FP = (d: string, evenodd = false): string =>
  `<path fill="currentColor"${evenodd ? ' fill-rule="evenodd"' : ""} d="${d}"/>`;

/** stroked path (currentColor) for line work */
const SP = (d: string, sw: number, extra = ""): string =>
  `<path fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ""} d="${d}"/>`;

/** circle as a path (two arcs) so it can be a subpath of a bigger shape */
const C = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;

// ── generated regular geometry (star/burst/scallop/wavy math) ───────

const PENTAGON = "M60 12L109.5 47.9L90.6 106.1L29.4 106.1L10.5 47.9Z";
const HEXAGON = "M60 8L105 34L105 86L60 112L15 86L15 34Z";
const OCTAGON = "M79.9 12L108 40.1L108 79.9L79.9 108L40.1 108L12 79.9L12 40.1L40.1 12Z";
const STAR5 = "M60 8L74.1 42.6L111.4 45.3L82.8 69.4L91.7 105.7L60 86L28.3 105.7L37.2 69.4L8.6 45.3L45.9 42.6Z";
const STAR6 = "M60 6L72.5 38.3L106.8 33L85 60L106.8 87L72.5 81.7L60 114L47.5 81.7L13.2 87L35 60L13.2 33L47.5 38.3Z";
const STAR8 = "M60 4L70.3 35.1L99.6 20.4L84.9 49.7L116 60L84.9 70.3L99.6 99.6L70.3 84.9L60 116L49.7 84.9L20.4 99.6L35.1 70.3L4 60L35.1 49.7L20.4 20.4L49.7 35.1Z";
const STAR12 = "M60 4L69.1 26.2L88 11.5L84.7 35.3L108.5 32L93.8 50.9L116 60L93.8 69.1L108.5 88L84.7 84.7L88 108.5L69.1 93.8L60 116L50.9 93.8L32 108.5L35.3 84.7L11.5 88L26.2 69.1L4 60L26.2 50.9L11.5 32L35.3 35.3L32 11.5L50.9 26.2Z";
const BURST8 = "M60 4L75.3 23L99.6 20.4L97 44.7L116 60L97 75.3L99.6 99.6L75.3 97L60 116L44.7 97L20.4 99.6L23 75.3L4 60L23 44.7L20.4 20.4L44.7 23Z";
const BURST12 = "M60 4L70.6 20.4L88 11.5L89 31L108.5 32L99.6 49.4L116 60L99.6 70.6L108.5 88L89 89L88 108.5L70.6 99.6L60 116L49.4 99.6L32 108.5L31 89L11.5 88L20.4 70.6L4 60L20.4 49.4L11.5 32L31 31L32 11.5L49.4 20.4Z";
const BURST16 = "M60 4L68.4 17.8L81.4 8.3L83.9 24.2L99.6 20.4L95.8 36.1L111.7 38.6L102.2 51.6L116 60L102.2 68.4L111.7 81.4L95.8 83.9L99.6 99.6L83.9 95.8L81.4 111.7L68.4 102.2L60 116L51.6 102.2L38.6 111.7L36.1 95.8L20.4 99.6L24.2 83.9L8.3 81.4L17.8 68.4L4 60L17.8 51.6L8.3 38.6L24.2 36.1L20.4 20.4L36.1 24.2L38.6 8.3L51.6 17.8Z";
const BURST24 = "M60 4L65.9 15.4L74.5 5.9L77.2 18.4L88 11.5L87.4 24.3L99.6 20.4L95.7 32.6L108.5 32L101.6 42.8L114.1 45.5L104.6 54.1L116 60L104.6 65.9L114.1 74.5L101.6 77.2L108.5 88L95.7 87.4L99.6 99.6L87.4 95.7L88 108.5L77.2 101.6L74.5 114.1L65.9 104.6L60 116L54.1 104.6L45.5 114.1L42.8 101.6L32 108.5L32.6 95.7L20.4 99.6L24.3 87.4L11.5 88L18.4 77.2L5.9 74.5L15.4 65.9L4 60L15.4 54.1L5.9 45.5L18.4 42.8L11.5 32L24.3 32.6L20.4 20.4L32.6 24.3L32 11.5L42.8 18.4L45.5 5.9L54.1 15.4Z";
const BOOM = "M60 6.8L70.1 25.5L90.4 12.7L87.2 36.4L105.6 39.2L95.6 54.9L117.1 68.2L92.7 75L95.3 90.6L79.5 90.3L76.4 115.9L60 96L46.9 104.5L40.5 90.3L16.3 97.8L27.3 75L10.6 67.1L24.4 54.9L8.7 36.6L32.8 36.4L31.3 15.4L49.9 25.5Z";
const SPARKLE = "M60 6C67.6 52.4 67.6 52.4 114 60C67.6 67.6 67.6 67.6 60 114C52.4 67.6 52.4 67.6 6 60C52.4 52.4 52.4 52.4 60 6Z";
const SPARKLE_PAIR = "M46 10C51 41 51 41 82 46C51 51 51 51 46 82C41 51 41 51 10 46C41 41 41 41 46 10ZM88 66C90.5 81.5 90.5 81.5 106 84C90.5 86.5 90.5 86.5 88 102C85.5 86.5 85.5 86.5 70 84C85.5 81.5 85.5 81.5 88 66Z";
const TWINKLE_TRIO = "M38 14C41.6 36.4 41.6 36.4 64 40C41.6 43.6 41.6 43.6 38 66C34.4 43.6 34.4 43.6 12 40C34.4 36.4 34.4 36.4 38 14ZM84 20C86 32 86 32 98 34C86 36 86 36 84 48C82 36 82 36 70 34C82 32 82 32 84 20ZM74 62C76.8 79.2 76.8 79.2 94 82C76.8 84.8 76.8 84.8 74 102C71.2 84.8 71.2 84.8 54 82C71.2 79.2 71.2 79.2 74 62Z";
const SCALLOP12 = "M70 14A15.7 15.7 0 0 1 98 21.5A15.7 15.7 0 0 1 118.5 42A15.7 15.7 0 0 1 126 70A15.7 15.7 0 0 1 118.5 98A15.7 15.7 0 0 1 98 118.5A15.7 15.7 0 0 1 70 126A15.7 15.7 0 0 1 42 118.5A15.7 15.7 0 0 1 21.5 98A15.7 15.7 0 0 1 14 70A15.7 15.7 0 0 1 21.5 42A15.7 15.7 0 0 1 42 21.5A15.7 15.7 0 0 1 70 14Z";
const SCALLOP20 = "M70 14A9.5 9.5 0 0 1 87.3 16.7A9.5 9.5 0 0 1 102.9 24.7A9.5 9.5 0 0 1 115.3 37.1A9.5 9.5 0 0 1 123.3 52.7A9.5 9.5 0 0 1 126 70A9.5 9.5 0 0 1 123.3 87.3A9.5 9.5 0 0 1 115.3 102.9A9.5 9.5 0 0 1 102.9 115.3A9.5 9.5 0 0 1 87.3 123.3A9.5 9.5 0 0 1 70 126A9.5 9.5 0 0 1 52.7 123.3A9.5 9.5 0 0 1 37.1 115.3A9.5 9.5 0 0 1 24.7 102.9A9.5 9.5 0 0 1 16.7 87.3A9.5 9.5 0 0 1 14 70A9.5 9.5 0 0 1 16.7 52.7A9.5 9.5 0 0 1 24.7 37.1A9.5 9.5 0 0 1 37.1 24.7A9.5 9.5 0 0 1 52.7 16.7A9.5 9.5 0 0 1 70 14Z";
const SCALLOP14_RING = "M70 14A13.5 13.5 0 0 1 94.3 19.5A13.5 13.5 0 0 1 113.8 35.1A13.5 13.5 0 0 1 124.6 57.5A13.5 13.5 0 0 1 124.6 82.5A13.5 13.5 0 0 1 113.8 104.9A13.5 13.5 0 0 1 94.3 120.5A13.5 13.5 0 0 1 70 126A13.5 13.5 0 0 1 45.7 120.5A13.5 13.5 0 0 1 26.2 104.9A13.5 13.5 0 0 1 15.4 82.5A13.5 13.5 0 0 1 15.4 57.5A13.5 13.5 0 0 1 26.2 35.1A13.5 13.5 0 0 1 45.7 19.5A13.5 13.5 0 0 1 70 14Z" + C(70, 70, 40);
const BURST16_BADGE = "M70 12L78.6 26.8L92.2 16.4L94.4 33.4L111 29L106.6 45.6L123.6 47.8L113.2 61.4L128 70L113.2 78.6L123.6 92.2L106.6 94.4L111 111L94.4 106.6L92.2 123.6L78.6 113.2L70 128L61.4 113.2L47.8 123.6L45.6 106.6L29 111L33.4 94.4L16.4 92.2L26.8 78.6L12 70L26.8 61.4L16.4 47.8L33.4 45.6L29 29L45.6 33.4L47.8 16.4L61.4 26.8Z";
const WAVY_SEAL = "M124 70L127.1 75L125.4 79.8L120.5 83.5L117.5 87.3L118.4 92.6L119.4 98.5L116.4 102.5L110.4 103.9L105.7 105.7L103.9 110.4L102.5 116.4L98.5 119.4L92.6 118.4L87.3 117.5L83.5 120.5L79.8 125.4L75 127.1L70 124L65.6 120.5L61 121L55.6 123.9L50.4 124L46.9 119.5L44.5 114.1L40.6 112L34.5 112.3L29.3 110.7L27.7 105.5L28 99.4L25.9 95.5L20.5 93.1L16 89.6L16.1 84.4L19 79L19.5 74.4L16 70L12.9 65L14.6 60.2L19.5 56.5L22.5 52.7L21.6 47.4L20.6 41.5L23.6 37.5L29.6 36.1L34.3 34.3L36.1 29.6L37.5 23.6L41.5 20.6L47.4 21.6L52.7 22.5L56.5 19.5L60.2 14.6L65 12.9L70 16L74.4 19.5L79 19L84.4 16.1L89.6 16L93.1 20.5L95.5 25.9L99.4 28L105.5 27.7L110.7 29.3L112.3 34.5L112 40.6L114.1 44.5L119.5 46.9L124 50.4L123.9 55.6L121 61L120.5 65.6Z";
const COG = "M70 14L82.2 24.6L98 21.5L103.2 36.8L118.5 42L115.4 57.8L126 70L115.4 82.2L118.5 98L103.2 103.2L98 118.5L82.2 115.4L70 126L57.8 115.4L42 118.5L36.8 103.2L21.5 98L24.6 82.2L14 70L24.6 57.8L21.5 42L36.8 36.8L42 21.5L57.8 24.6Z";
const HEX140_OUTER = "M70 14L118.5 42L118.5 98L70 126L21.5 98L21.5 42Z";
const HEX140_INNER = "M70 26L108.1 48L108.1 92L70 114L31.9 92L31.9 48Z";
const STAR_HOLE = "M70 34L75.9 49.9L92.8 50.6L79.5 61.1L84.1 77.4L70 68L55.9 77.4L60.5 61.1L47.2 50.6L64.1 49.9Z";
const BURST14_SPLAT = "M70 0L79.8 11.1L93.4 5.3L97.4 19.6L112.2 20.3L109.6 34.9L122.6 42L114 54L122.6 66L109.6 73.1L112.2 87.7L97.4 88.4L93.4 102.7L79.8 96.9L70 108L60.2 96.9L46.6 102.7L42.6 88.4L27.8 87.7L30.4 73.1L17.4 66L26 54L17.4 42L30.4 34.9L27.8 20.3L42.6 19.6L46.6 5.3L60.2 11.1Z";

/** wavy divider path reused at three stroke weights (caps stay inside viewBox) */
const WAVE_D = "M3 16C6 6 11 6 14 16C17 26 22 26 25 16C28 6 33 6 36 16C39 26 44 26 47 16C50 6 55 6 58 16C61 26 66 26 69 16C72 6 77 6 80 16C83 26 88 26 91 16C94 6 99 6 102 16C105 26 110 26 113 16C116 6 121 6 124 16C127 26 132 26 135 16C138 6 143 6 146 16C149 26 154 26 157 16";

// ── category catalogue ──────────────────────────────────────────────

export const ELEMENT_CATEGORIES: DesignerElementCategory[] = [
  // ── Shapes & Blobs ──────────────────────────────────────────────
  {
    id: "shapes",
    label: "Shapes & Blobs",
    icon: "🔷",
    items: [
      { id: "square", label: "Square", svg: S(120, 120, FP("M10 10H110V110H10Z")), tags: ["square", "rect", "box"] },
      { id: "rounded-square", label: "Rounded Square", svg: S(120, 120, FP("M30 10H90A20 20 0 0 1 110 30V90A20 20 0 0 1 90 110H30A20 20 0 0 1 10 90V30A20 20 0 0 1 30 10Z")), tags: ["square", "rounded", "rect"] },
      { id: "squircle", label: "Squircle", svg: S(120, 120, FP("M60 10C95 10 110 25 110 60C110 95 95 110 60 110C25 110 10 95 10 60C10 25 25 10 60 10Z")), tags: ["squircle", "rounded", "superellipse"] },
      { id: "circle", label: "Circle", svg: S(120, 120, FP(C(60, 60, 50))), tags: ["circle", "round", "dot"] },
      { id: "oval", label: "Oval", svg: S(120, 120, FP("M10 60A50 35 0 1 0 110 60A50 35 0 1 0 10 60Z")), tags: ["oval", "ellipse"] },
      { id: "pill", label: "Pill", svg: S(120, 120, FP("M40 20H80A40 40 0 0 1 80 100H40A40 40 0 0 1 40 20Z")), tags: ["pill", "capsule", "rounded"] },
      { id: "arch", label: "Arch", svg: S(120, 120, FP("M15 110V55A45 45 0 0 1 105 55V110Z")), tags: ["arch", "door", "window"] },
      { id: "triangle-up", label: "Triangle", svg: S(120, 120, FP("M60 12L110 104H10Z")), tags: ["triangle", "up"] },
      { id: "triangle-down", label: "Triangle Down", svg: S(120, 120, FP("M10 16H110L60 108Z")), tags: ["triangle", "down"] },
      { id: "triangle-right", label: "Triangle Right", svg: S(120, 120, FP("M14 12L108 60L14 108Z")), tags: ["triangle", "right", "play"] },
      { id: "diamond", label: "Diamond", svg: S(120, 120, FP("M60 10L110 60L60 110L10 60Z")), tags: ["diamond", "rhombus"] },
      { id: "pentagon", label: "Pentagon", svg: S(120, 120, FP(PENTAGON)), tags: ["pentagon", "polygon"] },
      { id: "hexagon", label: "Hexagon", svg: S(120, 120, FP(HEXAGON)), tags: ["hexagon", "polygon", "honeycomb"] },
      { id: "octagon", label: "Octagon", svg: S(120, 120, FP(OCTAGON)), tags: ["octagon", "polygon", "stop"] },
      { id: "trapezoid", label: "Trapezoid", svg: S(120, 120, FP("M35 25H85L110 95H10Z")), tags: ["trapezoid", "quad"] },
      { id: "parallelogram", label: "Parallelogram", svg: S(120, 120, FP("M40 25H110L80 95H10Z")), tags: ["parallelogram", "skew"] },
      { id: "half-circle", label: "Half Circle", svg: S(120, 120, FP("M10 95A50 50 0 0 1 110 95Z")), tags: ["semicircle", "dome", "half"] },
      { id: "quarter-circle", label: "Quarter Circle", svg: S(120, 120, FP("M15 105V15A90 90 0 0 1 105 105Z")), tags: ["quarter", "pie", "corner"] },
      { id: "plus", label: "Cross Plus", svg: S(120, 120, FP("M45 10H75V45H110V75H75V110H45V75H10V45H45Z")), tags: ["plus", "cross", "add", "medical"] },
      { id: "heart", label: "Heart", svg: S(120, 120, FP("M60 104C30 82 10 62 10 38C10 22 22 12 36 12C46 12 56 18 60 28C64 18 74 12 84 12C98 12 110 22 110 38C110 62 90 82 60 104Z")), tags: ["heart", "love", "like"] },
      { id: "teardrop", label: "Teardrop", svg: S(120, 120, FP("M60 10C60 10 100 55 100 78A40 40 0 0 1 20 78C20 55 60 10 60 10Z")), tags: ["teardrop", "drop", "water"] },
      { id: "crescent", label: "Crescent Moon", svg: S(120, 120, FP("M60 15A30 30 0 0 0 105 60A45 45 0 1 1 60 15Z")), tags: ["moon", "crescent", "night"] },
      { id: "shield", label: "Shield", svg: S(120, 120, FP("M60 10L105 25V60C105 85 85 102 60 110C35 102 15 85 15 60V25Z")), tags: ["shield", "security", "badge"] },
      { id: "leaf", label: "Leaf", svg: S(120, 120, FP("M20 100C20 55 55 20 100 20C100 65 65 100 20 100Z")), tags: ["leaf", "nature", "plant", "eco"] },
      { id: "egg", label: "Egg", svg: S(120, 120, FP("M60 10C85 10 102 40 102 65C102 92 83 110 60 110C37 110 18 92 18 65C18 40 35 10 60 10Z")), tags: ["egg", "oval", "organic"] },
      { id: "blob-a", label: "Blob A", svg: S(120, 120, FP("M60 10C85 10 108 25 110 50C112 75 95 100 65 108C40 114 15 95 12 65C9 38 35 10 60 10Z")), tags: ["blob", "organic", "abstract"] },
      { id: "blob-b", label: "Blob B", svg: S(120, 120, FP("M95 15C112 30 115 60 100 80C85 100 50 112 30 98C10 84 8 50 22 30C36 12 78 0 95 15Z")), tags: ["blob", "organic", "abstract"] },
      { id: "blob-c", label: "Blob C", svg: S(120, 120, FP("M70 10C95 15 112 40 108 65C104 90 80 110 55 108C28 106 8 85 10 58C12 32 45 5 70 10Z")), tags: ["blob", "organic", "abstract"] },
      { id: "blob-d", label: "Blob D", svg: S(120, 120, FP("M30 30C55 5 105 15 110 50C114 85 80 112 48 108C20 104 8 80 14 60C18 46 20 40 30 30Z")), tags: ["blob", "organic", "bean"] },
    ],
  },

  // ── Lines & Dividers ────────────────────────────────────────────
  {
    id: "lines",
    label: "Lines & Dividers",
    icon: "➖",
    items: [
      { id: "line-solid", label: "Solid Line", svg: S(160, 32, FP("M0 14H160V18H0Z")), tags: ["line", "divider", "rule"] },
      { id: "line-thick", label: "Thick Line", svg: S(160, 32, FP("M0 10H160V22H0Z")), tags: ["line", "divider", "bold"] },
      { id: "line-dashed", label: "Dashed Line", svg: S(160, 32, FP("M0 13H24V19H0ZM32 13H56V19H32ZM64 13H88V19H64ZM96 13H120V19H96ZM128 13H152V19H128Z")), tags: ["dashed", "divider"] },
      { id: "line-dotted", label: "Dotted Line", svg: S(160, 32, FP(C(8, 16, 3) + C(24, 16, 3) + C(40, 16, 3) + C(56, 16, 3) + C(72, 16, 3) + C(88, 16, 3) + C(104, 16, 3) + C(120, 16, 3) + C(136, 16, 3) + C(152, 16, 3))), tags: ["dotted", "divider", "dots"] },
      { id: "line-double", label: "Double Line", svg: S(160, 32, FP("M0 9H160V14H0ZM0 18H160V23H0Z")), tags: ["double", "divider"] },
      { id: "line-wavy", label: "Wavy Line", svg: S(160, 32, SP(WAVE_D, 4)), tags: ["wavy", "squiggle", "divider"] },
      { id: "line-wave-thick", label: "Thick Wave", svg: S(160, 32, SP(WAVE_D, 7)), tags: ["wavy", "thick", "divider"] },
      { id: "line-zigzag", label: "Zigzag Line", svg: S(160, 32, SP("M3 24L25 8L47 24L69 8L91 24L113 8L135 24L157 8", 4)), tags: ["zigzag", "divider", "chevron"] },
      { id: "line-scallop", label: "Scallop Line", svg: S(160, 32, SP("M3 24A7.7 7.7 0 0 1 18.4 24A7.7 7.7 0 0 1 33.8 24A7.7 7.7 0 0 1 49.2 24A7.7 7.7 0 0 1 64.6 24A7.7 7.7 0 0 1 80 24A7.7 7.7 0 0 1 95.4 24A7.7 7.7 0 0 1 110.8 24A7.7 7.7 0 0 1 126.2 24A7.7 7.7 0 0 1 141.6 24A7.7 7.7 0 0 1 157 24", 3)), tags: ["scallop", "bumps", "divider"] },
      { id: "line-dashed-wave", label: "Dashed Wave", svg: S(160, 32, SP(WAVE_D, 4, 'stroke-dasharray="10 8"')), tags: ["wavy", "dashed", "divider"] },
      { id: "line-hatch", label: "Diagonal Hatch", svg: S(160, 32, SP("M4 24L20 8M16 24L32 8M28 24L44 8M40 24L56 8M52 24L68 8M64 24L80 8M76 24L92 8M88 24L104 8M100 24L116 8M112 24L128 8M124 24L140 8M136 24L152 8", 3)), tags: ["hatch", "diagonal", "texture", "divider"] },
      { id: "underline-hand", label: "Hand Underline", svg: S(160, 32, SP("M4 20C30 15 60 24 90 18C110 14 135 19 156 14", 5)), tags: ["underline", "hand", "marker"] },
      { id: "underline-brush", label: "Brush Underline", svg: S(160, 32, FP("M2 17C40 11 120 11 158 16C120 19 40 21 2 17Z")), tags: ["underline", "brush", "highlight"] },
      { id: "dots-trio", label: "Three Dots", svg: S(160, 32, FP(C(68, 16, 4) + C(80, 16, 4) + C(92, 16, 4))), tags: ["dots", "separator", "ellipsis"] },
    ],
  },

  // ── Arrows & Pointers ───────────────────────────────────────────
  {
    id: "arrows",
    label: "Arrows & Pointers",
    icon: "➡️",
    items: [
      { id: "arrow-right", label: "Arrow Right", svg: S(160, 80, FP("M10 30H95V15L150 40L95 65V50H10Z")), tags: ["arrow", "right", "block"] },
      { id: "arrow-left", label: "Arrow Left", svg: S(160, 80, FP("M150 30H65V15L10 40L65 65V50H150Z")), tags: ["arrow", "left", "block"] },
      { id: "arrow-up", label: "Arrow Up", svg: S(80, 160, FP("M30 150V65H15L40 10L65 65H50V150Z")), tags: ["arrow", "up", "block"] },
      { id: "arrow-down", label: "Arrow Down", svg: S(80, 160, FP("M50 10V95H65L40 150L15 95H30V10Z")), tags: ["arrow", "down", "block"] },
      { id: "arrow-updown", label: "Arrow Up Down", svg: S(80, 160, FP("M40 10L62 42H48V118H62L40 150L18 118H32V42H18Z")), tags: ["arrow", "vertical", "swap"] },
      { id: "arrow-double", label: "Double Arrow", svg: S(160, 80, FP("M10 40L40 18V32H120V18L150 40L120 62V48H40V62Z")), tags: ["arrow", "double", "both", "exchange"] },
      { id: "arrow-curved", label: "Curved Arrow", svg: S(160, 80, SP("M14 58A62 46 0 0 1 124 40", 8) + FP("M112 18L150 38L108 56Z")), tags: ["arrow", "curved", "arc"] },
      { id: "arrow-uturn", label: "U-Turn Arrow", svg: S(160, 80, SP("M30 72V40A28 28 0 0 1 86 40V52", 10) + FP("M68 48H104L86 74Z")), tags: ["arrow", "uturn", "return", "back"] },
      { id: "arrow-refresh", label: "Refresh Arrow", svg: S(160, 80, SP("M118 44A34 30 0 1 1 104 18", 9) + FP("M96 2L132 14L104 38Z")), tags: ["arrow", "refresh", "cycle", "rotate", "loop"] },
      { id: "arrow-chevron", label: "Chevron Arrow", svg: S(160, 80, FP("M20 12L80 40L20 68V48L45 40L20 32Z")), tags: ["chevron", "arrow", "next"] },
      { id: "arrow-chevrons-double", label: "Double Chevron", svg: S(160, 80, FP("M20 12L80 40L20 68V48L45 40L20 32ZM70 12L130 40L70 68V48L95 40L70 32Z")), tags: ["chevron", "double", "fast", "arrow"] },
      { id: "arrow-thin", label: "Thin Arrow", svg: S(160, 80, SP("M4 40H128", 4) + FP("M116 26L150 40L116 54Z")), tags: ["arrow", "thin", "long"] },
      { id: "arrow-dashed", label: "Dashed Arrow", svg: S(160, 80, SP("M6 40H126", 5, 'stroke-dasharray="12 9"') + FP("M114 24L148 40L114 56Z")), tags: ["arrow", "dashed", "dotted"] },
      { id: "arrow-elbow", label: "Elbow Arrow", svg: S(160, 80, SP("M20 70H90V30", 10) + FP("M70 32L90 6L110 32Z")), tags: ["arrow", "elbow", "turn", "bent"] },
      { id: "arrow-zigzag", label: "Zigzag Arrow", svg: S(160, 80, SP("M10 62L55 32L85 52L138 22", 8) + FP("M116 10L150 18L132 46Z")), tags: ["arrow", "zigzag", "hand-drawn"] },
    ],
  },

  // ── Speech Bubbles ──────────────────────────────────────────────
  {
    id: "bubbles",
    label: "Speech Bubbles",
    icon: "💬",
    items: [
      { id: "bubble-round-left", label: "Bubble Tail Left", svg: S(140, 120, FP("M70 10C105 10 132 30 132 55C132 80 105 98 70 98C60 98 51 97 43 95L20 112L27 88C14 79 8 68 8 55C8 30 35 10 70 10Z")), tags: ["speech", "bubble", "chat", "talk"] },
      { id: "bubble-round-center", label: "Bubble Tail Center", svg: S(140, 120, FP("M70 10C105 10 132 30 132 55C132 80 105 98 70 98C62 98 55 97 48 96L58 114L36 90C18 82 8 70 8 55C8 30 35 10 70 10Z")), tags: ["speech", "bubble", "chat"] },
      { id: "bubble-round-right", label: "Bubble Tail Right", svg: S(140, 120, FP("M70 10C35 10 8 30 8 55C8 80 35 98 70 98C80 98 89 97 97 95L120 112L113 88C126 79 132 68 132 55C132 30 105 10 70 10Z")), tags: ["speech", "bubble", "chat"] },
      { id: "bubble-square", label: "Square Bubble", svg: S(140, 120, FP("M18 12H122Q130 12 130 20V80Q130 88 122 88H84L64 114L60 88H18Q10 88 10 80V20Q10 12 18 12Z")), tags: ["speech", "bubble", "square", "chat"] },
      { id: "bubble-oval", label: "Oval Callout", svg: S(140, 120, FP("M70 10C103 10 130 30 130 54C130 78 103 96 70 96C37 96 10 78 10 54C10 30 37 10 70 10ZM52 93L38 114L66 95Z")), tags: ["speech", "bubble", "oval", "callout"] },
      { id: "bubble-side", label: "Side Callout", svg: S(140, 120, FP("M34 20H122Q130 20 130 28V76Q130 84 122 84H54L18 110L36 84H34Q26 84 26 76V28Q26 20 34 20Z")), tags: ["speech", "bubble", "callout", "side"] },
      { id: "thought-cloud", label: "Thought Cloud", svg: S(140, 120, FP("M32 62A16 16 0 0 1 36 30A19 19 0 0 1 64 17A20 20 0 0 1 98 21A17 17 0 0 1 113 46A15 15 0 0 1 104 69A20 20 0 0 1 70 74A18 18 0 0 1 40 72A16 16 0 0 1 32 62Z" + C(46, 92, 7) + C(30, 108, 5))), tags: ["thought", "cloud", "dream", "bubble"] },
      { id: "bubble-splat", label: "Shout Bubble", svg: S(140, 120, FP(BURST14_SPLAT + "M58 100L46 118L78 102Z")), tags: ["shout", "splat", "burst", "comic", "bubble"] },
      { id: "bubble-dots", label: "Chat Dots Bubble", svg: S(140, 120, FP("M32 12H108Q126 12 126 30V62Q126 80 108 80H62L44 104L48 80H32Q14 80 14 62V30Q14 12 32 12Z" + C(43, 46, 6) + C(70, 46, 6) + C(97, 46, 6), true)), tags: ["chat", "typing", "message", "bubble"] },
      { id: "bubble-love", label: "Love Bubble", svg: S(140, 120, FP("M32 12H108Q126 12 126 30V62Q126 80 108 80H62L44 104L48 80H32Q14 80 14 62V30Q14 12 32 12ZM70 64C56 53 48 46 48 37C48 30 53 26 59 26C63 26 68 28 70 33C72 28 77 26 81 26C87 26 92 30 92 37C92 46 84 53 70 64Z", true)), tags: ["love", "heart", "like", "bubble"] },
    ],
  },

  // ── Stars & Bursts ──────────────────────────────────────────────
  {
    id: "stars",
    label: "Stars & Bursts",
    icon: "⭐",
    items: [
      { id: "star5", label: "Star 5pt", svg: S(120, 120, FP(STAR5)), tags: ["star", "five", "rating"] },
      { id: "star4-sparkle", label: "Sparkle", svg: S(120, 120, FP(SPARKLE)), tags: ["sparkle", "star", "shine", "glint"] },
      { id: "star4-diamond", label: "Diamond Star", svg: S(120, 120, FP("M60 10L70 50L110 60L70 70L60 110L50 70L10 60L50 50Z")), tags: ["star", "sparkle", "diamond"] },
      { id: "star6", label: "Star 6pt", svg: S(120, 120, FP(STAR6)), tags: ["star", "six"] },
      { id: "star8", label: "Star 8pt", svg: S(120, 120, FP(STAR8)), tags: ["star", "eight", "compass"] },
      { id: "star12", label: "Star 12pt", svg: S(120, 120, FP(STAR12)), tags: ["star", "twelve", "sun"] },
      { id: "sparkle-pair", label: "Sparkle Pair", svg: S(120, 120, FP(SPARKLE_PAIR)), tags: ["sparkle", "stars", "magic", "clean"] },
      { id: "twinkle-trio", label: "Twinkle Trio", svg: S(120, 120, FP(TWINKLE_TRIO)), tags: ["twinkle", "stars", "night", "magic"] },
      { id: "burst8", label: "Burst 8pt", svg: S(120, 120, FP(BURST8)), tags: ["burst", "seal", "starburst"] },
      { id: "burst12", label: "Burst 12pt", svg: S(120, 120, FP(BURST12)), tags: ["burst", "seal", "starburst"] },
      { id: "burst16", label: "Burst 16pt", svg: S(120, 120, FP(BURST16)), tags: ["burst", "seal", "spike"] },
      { id: "burst24", label: "Burst 24pt", svg: S(120, 120, FP(BURST24)), tags: ["burst", "seal", "sun", "spike"] },
      { id: "boom", label: "Boom Burst", svg: S(120, 120, FP(BOOM)), tags: ["boom", "explosion", "comic", "sale"] },
    ],
  },

  // ── Badges & Seals ──────────────────────────────────────────────
  {
    id: "badges",
    label: "Badges & Seals",
    icon: "🏅",
    items: [
      { id: "seal-ring", label: "Circle Seal", svg: S(140, 140, FP(C(70, 70, 56) + C(70, 70, 44), true)), tags: ["seal", "ring", "circle", "badge"] },
      { id: "seal-scallop12", label: "Scallop Seal", svg: S(140, 140, FP(SCALLOP12)), tags: ["seal", "scallop", "badge", "award", "certificate"] },
      { id: "seal-scallop20", label: "Fine Scallop Seal", svg: S(140, 140, FP(SCALLOP20)), tags: ["seal", "scallop", "sticker", "award"] },
      { id: "seal-scallop-ring", label: "Scallop Ring Seal", svg: S(140, 140, FP(SCALLOP14_RING, true)), tags: ["seal", "scallop", "ring", "certified"] },
      { id: "seal-burst16", label: "Starburst Seal", svg: S(140, 140, FP(BURST16_BADGE)), tags: ["seal", "starburst", "sale", "award"] },
      { id: "seal-wavy", label: "Wavy Seal", svg: S(140, 140, FP(WAVY_SEAL)), tags: ["seal", "wavy", "stamp", "organic"] },
      { id: "seal-cog", label: "Cog Seal", svg: S(140, 140, FP(COG + C(70, 70, 34), true)), tags: ["seal", "cog", "gear", "settings", "badge"] },
      { id: "badge-rosette", label: "Rosette Award", svg: S(140, 140, FP(C(70, 52, 36) + "M50 84L38 126L56 115L64 130ZM90 84L102 126L84 115L76 130Z")), tags: ["rosette", "award", "medal", "prize", "ribbon"] },
      { id: "badge-shield-star", label: "Shield Star Badge", svg: S(140, 140, FP("M70 12L122 28V70C122 100 99 120 70 130C41 120 18 100 18 70V28Z" + STAR_HOLE, true)), tags: ["shield", "badge", "award", "verified", "star"] },
      { id: "badge-hex-frame", label: "Hex Badge Frame", svg: S(140, 140, FP(HEX140_OUTER + HEX140_INNER, true)), tags: ["hexagon", "badge", "frame", "ring"] },
      { id: "badge-ribbons", label: "Ribbon Badge", svg: S(140, 140, FP(C(70, 60, 40) + "M46 90L34 132L54 120L62 134ZM94 90L106 132L86 120L78 134Z")), tags: ["badge", "ribbon", "medal", "award"] },
    ],
  },

  // ── Banners & Ribbons ───────────────────────────────────────────
  {
    id: "banners",
    label: "Banners & Ribbons",
    icon: "🎀",
    items: [
      { id: "banner-notch", label: "Notched Banner", svg: S(160, 80, FP("M32 20H128L144 38L128 56H32L16 38Z")), tags: ["banner", "ribbon", "title"] },
      { id: "banner-folded", label: "Folded Ribbon", svg: S(160, 80, FP("M34 22H126V54H34ZM12 34L34 40V62L12 56ZM148 34L126 40V62L148 56Z")), tags: ["ribbon", "banner", "folded"] },
      { id: "banner-droop", label: "Droop Ribbon", svg: S(160, 80, FP("M35 20H125V50H35ZM18 50H35V74L26.5 63L18 74ZM125 50H142V74L133.5 63L142 74Z")), tags: ["ribbon", "banner", "droop", "header"] },
      { id: "banner-arc-up", label: "Arc Banner Up", svg: S(160, 80, FP("M20 58Q80 18 140 58L140 70Q80 30 20 70Z")), tags: ["banner", "arc", "curve", "smile"] },
      { id: "banner-arc-down", label: "Arc Banner Down", svg: S(160, 80, FP("M20 22Q80 62 140 22L140 34Q80 74 20 34Z")), tags: ["banner", "arc", "curve", "frown"] },
      { id: "banner-single", label: "Single Ribbon", svg: S(160, 80, FP("M46 26H140V54H46ZM24 36L46 42V64L35 53L24 64Z")), tags: ["ribbon", "banner", "one-sided", "label"] },
      { id: "banner-scroll", label: "Scroll Banner", svg: S(160, 80, FP("M28 26H132V54H28ZM28 26C14 26 8 33 14 40C8 47 14 54 28 54ZM132 26C146 26 152 33 146 40C152 47 146 54 132 54Z")), tags: ["scroll", "banner", "parchment", "vintage"] },
      { id: "banner-bunting", label: "Bunting Flags", svg: S(160, 80, FP("M4 10H156V15H4ZM12 15L36 15L24 36ZM40 15L64 15L52 36ZM68 15L92 15L80 36ZM96 15L120 15L108 36ZM124 15L148 15L136 36Z")), tags: ["bunting", "flags", "pennant", "party", "decoration"] },
      { id: "banner-vertical", label: "Vertical Ribbon", svg: S(80, 160, FP("M16 20H64V150L40 126L16 150Z")), tags: ["ribbon", "vertical", "bookmark", "banner"] },
      { id: "banner-frame", label: "Framed Banner", svg: S(160, 80, FP("M12 14H148V46H12ZM24 22H136V38H24Z", true)), tags: ["banner", "frame", "outline", "label"] },
    ],
  },

  // ── Checkmarks & Ticks ──────────────────────────────────────────
  {
    id: "ticks",
    label: "Checkmarks & Ticks",
    icon: "✔️",
    items: [
      { id: "check-bold", label: "Bold Check", svg: S(120, 120, FP("M52 92L18 58L30 46L52 68L90 24L102 36Z")), tags: ["check", "tick", "done", "correct"] },
      { id: "check-thin", label: "Thin Check", svg: S(120, 120, SP("M22 62L50 90L100 28", 9)), tags: ["check", "tick", "done"] },
      { id: "check-circle", label: "Check Circle", svg: S(120, 120, FP(C(60, 60, 50) + "M32 61L52 81L89 38L78 28L52 61L43 52Z", true)), tags: ["check", "circle", "approved", "verified"] },
      { id: "check-ring", label: "Check Ring", svg: S(120, 120, FP(C(60, 60, 50) + C(60, 60, 42) + "M32 60L52 80L88 40L78 30L52 62L41 51Z", true)), tags: ["check", "ring", "outline", "done"] },
      { id: "check-square", label: "Check Square", svg: S(120, 120, FP("M24 10H96A14 14 0 0 1 110 24V96A14 14 0 0 1 96 110H24A14 14 0 0 1 10 96V24A14 14 0 0 1 24 10ZM32 60L52 80L88 40L78 30L52 62L41 51Z", true)), tags: ["checkbox", "check", "square", "task"] },
      { id: "check-double", label: "Double Check", svg: S(120, 120, FP("M14 60L34 80L68 40L57 30L34 62L25 53ZM46 78L66 98L100 58L89 48L66 80L57 71Z")), tags: ["double", "check", "read", "done"] },
      { id: "cross-x", label: "Cross X", svg: S(120, 120, FP("M32 30L60 52L88 30L96 38L68 60L96 82L88 90L60 68L32 90L24 82L52 60L24 38Z")), tags: ["cross", "x", "wrong", "close", "no"] },
      { id: "cross-circle", label: "Cross Circle", svg: S(120, 120, FP(C(60, 60, 50) + "M32 30L60 52L88 30L96 38L68 60L96 82L88 90L60 68L32 90L24 82L52 60L24 38Z", true)), tags: ["cross", "circle", "wrong", "cancel"] },
      { id: "check-bubble", label: "Check Bubble", svg: S(120, 120, FP(C(60, 54, 44) + "M44 96L32 116L63 99Z" + "M34 56L54 76L90 36L79 27L54 58L44 48Z", true)), tags: ["check", "bubble", "verified", "chat"] },
    ],
  },

  // ── Brackets ────────────────────────────────────────────────────
  {
    id: "brackets",
    label: "Brackets",
    icon: "{ }",
    items: [
      { id: "brackets-square", label: "Square Brackets", svg: S(120, 120, FP("M28 14H52V26H40V94H52V106H28ZM92 14H68V26H80V94H68V106H92Z")), tags: ["bracket", "square", "array"] },
      { id: "brackets-round", label: "Parentheses", svg: S(120, 120, FP("M46 12C26 24 20 42 20 60C20 78 26 96 46 108L56 108C38 96 32 78 32 60C32 42 38 24 56 12ZM74 12C94 24 100 42 100 60C100 78 94 96 74 108L64 108C82 96 88 78 88 60C88 42 82 24 64 12Z")), tags: ["parentheses", "round", "bracket"] },
      { id: "braces", label: "Curly Braces", svg: S(120, 120, FP("M52 10C34 10 30 20 30 32C30 44 24 52 12 56V64C24 68 30 76 30 88C30 100 34 110 52 110V98C44 98 42 92 42 84C42 72 46 64 56 60C46 56 42 48 42 36C42 28 44 22 52 22ZM68 10C86 10 90 20 90 32C90 44 96 52 108 56V64C96 68 90 76 90 88C90 100 86 110 68 110V98C76 98 78 92 78 84C78 72 74 64 64 60C74 56 78 48 78 36C78 28 76 22 68 22Z")), tags: ["braces", "curly", "code", "bracket"] },
      { id: "brackets-angle", label: "Angle Brackets", svg: S(120, 120, FP("M56 22L20 60L56 98L68 88L42 60L68 32ZM64 22L100 60L64 98L52 88L78 60L52 32Z")), tags: ["angle", "brackets", "code", "chevron"] },
      { id: "brackets-floor", label: "Floor Brackets", svg: S(120, 120, FP("M28 14H40V94H52V106H28ZM92 14H80V94H68V106H92Z")), tags: ["bracket", "floor", "ceiling"] },
      { id: "corners-four", label: "Corner Frame", svg: S(120, 120, FP("M14 14H52L40 26H26V40L14 52ZM106 14H68L80 26H94V40L106 52ZM14 106H52L40 94H26V80L14 68ZM106 106H68L80 94H94V80L106 68Z")), tags: ["corners", "frame", "focus", "crop"] },
      { id: "rails", label: "Side Rails", svg: S(120, 120, FP("M34 14H46V106H34ZM74 14H86V106H74Z")), tags: ["rails", "bars", "quote", "columns"] },
      { id: "slashes", label: "Double Slash", svg: S(120, 120, FP("M52 14H66L48 106H34ZM86 14H100L82 106H68Z")), tags: ["slash", "lines", "code"] },
    ],
  },

  // ── Social & Media ──────────────────────────────────────────────
  {
    id: "social",
    label: "Social & Media",
    icon: "📣",
    items: [
      { id: "soc-facebook", label: "Facebook", svg: S(96, 96, FP(C(48, 48, 44) + "M54 78V54H64V42H54V34C54 29 56 27 61 27H65V15H57C45 15 40 22 40 33V42H30V54H40V78Z", true)), tags: ["facebook", "social", "share"] },
      { id: "soc-instagram", label: "Instagram", svg: S(96, 96, FP("M30 8H66A22 22 0 0 1 88 30V66A22 22 0 0 1 66 88H30A22 22 0 0 1 8 66V30A22 22 0 0 1 30 8ZM30 18H66A12 12 0 0 1 78 30V66A12 12 0 0 1 66 78H30A12 12 0 0 1 18 66V30A12 12 0 0 1 30 18Z" + C(48, 50, 14) + C(48, 50, 6) + C(66, 30, 4), true)), tags: ["instagram", "social", "camera", "photo"] },
      { id: "soc-x", label: "X (Twitter)", svg: S(96, 96, FP("M20 12L44 48L20 84H36L52 60L68 84H84L60 48L84 12H68L52 36L36 12Z")), tags: ["x", "twitter", "social"] },
      { id: "soc-youtube", label: "YouTube", svg: S(96, 96, FP("M8 30A14 14 0 0 1 22 16H74A14 14 0 0 1 88 30V66A14 14 0 0 1 74 80H22A14 14 0 0 1 8 66ZM40 34L64 48L40 62Z", true)), tags: ["youtube", "video", "social", "play"] },
      { id: "soc-linkedin", label: "LinkedIn", svg: S(96, 96, FP("M8 24A14 14 0 0 1 22 10H74A14 14 0 0 1 88 24V72A14 14 0 0 1 74 86H22A14 14 0 0 1 8 72ZM18 24C18 23 19 22 22 22H74C77 22 78 23 78 24V72C78 73 77 74 74 74H22C19 74 18 73 18 72Z" + C(36, 38, 6) + "M30 48H42V70H30ZM48 48H58V52C60 49 64 47 68 47C76 47 80 52 80 60V70H68V61C68 56 66 54 63 54C60 54 58 56 58 60V70H48Z", true)), tags: ["linkedin", "social", "business", "network"] },
      { id: "soc-whatsapp", label: "WhatsApp", svg: S(96, 96, FP(C(48, 48, 42) + "M66 86L88 92L82 74Z" + "M40 26C42 24 46 24 47 28L49 34C50 37 48 39 46 41C48 46 52 50 57 52C59 50 61 48 64 49L70 51C74 52 74 56 72 58C68 63 60 64 53 60C44 55 36 47 33 38C31 34 35 29 40 26Z", true)), tags: ["whatsapp", "chat", "message", "social"] },
      { id: "soc-telegram", label: "Telegram", svg: S(96, 96, FP("M10 44L86 12L72 82L46 60L38 70L36 54ZM24 42L70 26L46 56Z", true)), tags: ["telegram", "send", "paper", "plane", "share"] },
      { id: "soc-mail", label: "Mail", svg: S(96, 96, FP("M8 30A8 8 0 0 1 16 22H80A8 8 0 0 1 88 30V66A8 8 0 0 1 80 74H16A8 8 0 0 1 8 66ZM12 26L48 52L84 26L84 36L48 62L12 36Z", true)), tags: ["mail", "email", "envelope", "contact"] },
      { id: "soc-phone", label: "Phone", svg: S(96, 96, FP("M30 12C36 12 40 16 42 22L44 30C45 34 43 37 40 39L36 42C40 51 47 58 56 62L59 58C61 55 64 53 68 54L76 56C82 58 86 62 86 68C86 78 78 86 68 86C40 86 12 58 12 30C12 20 20 12 30 12Z")), tags: ["phone", "call", "contact", "mobile"] },
      { id: "soc-link", label: "Link Chain", svg: S(96, 96, FP("M22 36H44A14 14 0 0 1 44 64H22A14 14 0 0 1 22 36ZM24 44A6 6 0 0 0 24 56H42A6 6 0 0 0 42 44ZM52 36H74A14 14 0 0 1 74 64H52A14 14 0 0 1 52 36ZM54 44A6 6 0 0 0 54 56H72A6 6 0 0 0 72 44Z", true)), tags: ["link", "chain", "url", "hyperlink"] },
      { id: "soc-share", label: "Share Nodes", svg: S(96, 96, FP(C(24, 48, 10) + C(74, 24, 10) + C(74, 72, 10) + "M29 45L69 27L73 35L33 53ZM33 43L73 61L69 69L29 51Z")), tags: ["share", "network", "nodes", "social"] },
      { id: "soc-heart", label: "Heart Like", svg: S(96, 96, FP("M48 88C24 70 8 54 8 34C8 20 18 10 30 10C38 10 45 14 48 22C51 14 58 10 66 10C78 10 88 20 88 34C88 54 72 70 48 88Z")), tags: ["heart", "like", "love", "social"] },
      { id: "soc-thumbsup", label: "Thumbs Up", svg: S(96, 96, FP("M10 44H24V84H10ZM28 84H70C76 84 80 80 81 75L86 52C87 46 83 42 78 42H60L64 26C65 19 61 12 54 12C51 12 48 14 47 17L40 42H28Z")), tags: ["thumbs", "up", "like", "approve", "social"] },
      { id: "soc-globe", label: "Globe Web", svg: S(96, 96, SP("M48 10A38 38 0 1 1 48 86A38 38 0 1 1 48 10", 5) + SP("M48 10C60 20 66 33 66 48C66 63 60 76 48 86C36 76 30 63 30 48C30 33 36 20 48 10", 5) + SP("M11 48H85M16 29H80M16 67H80", 5)), tags: ["globe", "web", "internet", "language", "world"] },
      { id: "soc-camera", label: "Camera", svg: S(96, 96, FP("M20 28H36L42 18H54L60 28H76A10 10 0 0 1 86 38V68A10 10 0 0 1 76 78H20A10 10 0 0 1 10 68V38A10 10 0 0 1 20 28Z" + C(48, 52, 16) + C(48, 52, 7), true)), tags: ["camera", "photo", "picture", "media"] },
      { id: "soc-video", label: "Video Camera", svg: S(96, 96, FP("M16 28H58A8 8 0 0 1 66 36V60A8 8 0 0 1 58 68H16A8 8 0 0 1 8 60V36A8 8 0 0 1 16 28ZM70 42L90 28V68L70 54Z")), tags: ["video", "camera", "movie", "record", "media"] },
      { id: "soc-mic", label: "Microphone", svg: S(96, 96, FP("M48 10A14 14 0 0 1 62 24V44A14 14 0 0 1 34 44V24A14 14 0 0 1 48 10Z") + SP("M24 44A24 24 0 0 0 72 44", 5) + SP("M48 68V82M36 84H60", 5)), tags: ["mic", "microphone", "audio", "record", "voice"] },
      { id: "soc-bell", label: "Bell", svg: S(96, 96, FP("M48 12C30 12 22 26 22 42V58L14 70H82L74 58V42C74 26 66 12 48 12Z" + "M40 74A8 8 0 0 0 56 74Z")), tags: ["bell", "notification", "alert", "reminder"] },
      { id: "soc-rss", label: "RSS Feed", svg: S(96, 96, FP("M14 14A68 68 0 0 1 82 82H68A54 54 0 0 0 14 28ZM14 42A40 40 0 0 1 54 82H40A26 26 0 0 0 14 56Z" + C(22, 74, 8))), tags: ["rss", "feed", "subscribe", "blog"] },
      { id: "soc-hash", label: "Hashtag", svg: S(96, 96, FP("M38 12H50L44 84H32ZM66 12H78L72 84H60ZM14 34H84V44H14ZM14 60H84V70H14Z")), tags: ["hashtag", "tag", "social", "trending"] },
    ],
  },

  // ── Basic Charts ────────────────────────────────────────────────
  {
    id: "charts",
    label: "Basic Charts",
    icon: "📊",
    items: [
      { id: "chart-bars", label: "Bar Chart", svg: S(120, 120, FP("M16 108V64H40V108ZM48 108V44H72V108ZM80 108V28H104V108Z")), tags: ["chart", "bar", "graph", "stats"] },
      { id: "chart-bars-asc", label: "Growing Bars", svg: S(120, 120, FP("M10 108V84H24V108ZM30 108V68H44V108ZM50 108V52H64V108ZM70 108V34H84V108ZM90 108V16H104V108Z")), tags: ["chart", "growth", "graph", "increase"] },
      { id: "chart-bars-h", label: "Horizontal Bars", svg: S(120, 120, FP("M12 18H76V32H12ZM12 50H96V64H12ZM12 82H60V96H12Z")), tags: ["chart", "bars", "horizontal", "graph"] },
      { id: "chart-donut", label: "Donut Chart", svg: S(120, 120, FP(C(60, 60, 50) + C(60, 60, 32), true)), tags: ["chart", "donut", "ring", "graph"] },
      { id: "chart-pie", label: "Pie Chart", svg: S(120, 120, FP("M60 60L60 10A50 50 0 1 1 24.6 95.4Z")), tags: ["chart", "pie", "graph", "share"] },
      { id: "chart-donut-half", label: "Half Donut", svg: S(120, 120, FP("M10 60A50 50 0 0 1 110 60H78A18 18 0 0 0 42 60Z")), tags: ["chart", "gauge", "half", "donut"] },
      { id: "chart-area", label: "Area Chart", svg: S(120, 120, FP("M12 100V70L36 46L60 58L84 30L108 44V100Z")), tags: ["chart", "area", "trend", "graph"] },
      { id: "chart-ring", label: "Progress Ring", svg: S(120, 120, FP("M60 10A50 50 0 1 1 10 60L26 60A34 34 0 1 0 60 26Z")), tags: ["progress", "ring", "loader", "chart", "percent"] },
    ],
  },

  // ── Cursors & Pointers ──────────────────────────────────────────
  {
    id: "cursors",
    label: "Cursors & Pointers",
    icon: "🖱️",
    items: [
      { id: "cursor-arrow", label: "Mouse Cursor", svg: S(120, 120, FP("M26 8V92L47 71L60 104L78 96L64 65L94 60Z")), tags: ["cursor", "mouse", "pointer", "click"] },
      { id: "cursor-hand", label: "Pointing Hand", svg: S(120, 120, FP("M30 50H44V108H30ZM46 108H78C88 108 94 102 95 94L98 66C99 58 94 52 86 52H70L74 34C76 24 70 16 62 16C58 16 55 18 54 22L46 48V108Z")), tags: ["hand", "pointer", "click", "touch"] },
      { id: "pointer-triangle", label: "Triangle Pointer", svg: S(120, 120, FP("M20 16L100 60L20 104L38 60Z")), tags: ["pointer", "play", "triangle", "arrow"] },
      { id: "target-crosshair", label: "Target Crosshair", svg: S(120, 120, FP(C(60, 60, 40) + C(60, 60, 30) + "M56 4H64V18H56ZM56 102H64V116H56ZM4 56H18V64H4ZM102 56H116V64H102Z", true)), tags: ["target", "crosshair", "focus", "aim"] },
      { id: "map-pin", label: "Map Pin", svg: S(120, 120, FP("M60 8C82 8 96 24 96 44C96 66 74 84 60 108C46 84 24 66 24 44C24 24 38 8 60 8Z" + C(60, 44, 14), true)), tags: ["pin", "location", "map", "marker", "place"] },
      { id: "magnifier", label: "Magnifier", svg: S(120, 120, FP(C(50, 50, 30) + C(50, 50, 21) + "M70 78L96 104C100 108 94 114 90 110L64 84Z", true)), tags: ["search", "magnifier", "zoom", "find"] },
      { id: "ibeam", label: "Text Cursor", svg: S(120, 120, FP("M44 8H76V16H64V104H76V112H44V104H56V16H44Z")), tags: ["ibeam", "text", "cursor", "edit"] },
      { id: "cursor-sparkle", label: "Magic Cursor", svg: S(120, 120, FP("M26 8V92L47 71L60 104L78 96L64 65L94 60Z" + SPARKLE_PAIR)), tags: ["cursor", "magic", "wand", "sparkle", "ai"] },
    ],
  },
];

/** total element count (handy for panel headers) */
export const ELEMENT_TOTAL = ELEMENT_CATEGORIES.reduce(
  (sum, c) => sum + c.items.length, 0,
);

/** search across every category by label + tags; returns [category, item] pairs */
export function searchElements(query: string): Array<{ category: DesignerElementCategory; item: DesignerElementItem }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Array<{ category: DesignerElementCategory; item: DesignerElementItem }> = [];
  for (const category of ELEMENT_CATEGORIES) {
    for (const item of category.items) {
      if (item.label.toLowerCase().includes(q) || item.tags.some((t) => t.includes(q))) {
        out.push({ category, item });
      }
    }
  }
  return out;
}
