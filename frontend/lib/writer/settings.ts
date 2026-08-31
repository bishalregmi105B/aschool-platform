/**
 * Writer v2 — shared types, page geometry and settings.
 *
 * The writer settings are persisted in canvas_state.config so documents
 * round-trip. Old docs only carry the first 7 fields; everything else
 * is merged from DEFAULT_SETTINGS on load (backwards compatible).
 */

export type PageId = "A4" | "A5" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";
export type Align = "left" | "center" | "right" | "justify";
export type BulletStyle = "disc" | "circle" | "square";
export type NumberStyle = "decimal" | "lowerLetter" | "lowerRoman";
export type BorderPreset = "none" | "top" | "bottom" | "topbottom" | "box";
export type PageNumberPos = "none" | "bottom-left" | "bottom-center" | "bottom-right";
export type ShapeKind = "rect" | "ellipse" | "arrow" | "star";
export type BoxKind = "textbox" | "wordart" | ShapeKind;

/** A floating, absolutely-positioned item over the page (Word text box / WordArt / shape). */
export interface FloatingBox {
  id: string;
  kind: BoxKind;
  x: number; // px, relative to page top-left (canvas coords)
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number; // pt
  font: string;
  color: string;
  align: Align;
  fill?: string; // textbox bg / shape fill
  stroke?: string; // shape outline
  border?: boolean; // textbox border
  artStyle?: number; // wordart preset index
}

export interface WriterSettings {
  // page setup
  pageSize: PageId;
  orientation: Orientation;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  // typography defaults
  font: string;
  fontSize: number;
  // layout
  columns: number; // 1 | 2 | 3
  columnSpacing: number; // px
  columnDivider: boolean;
  lineNumbers: boolean;
  // header / footer
  headerOn: boolean;
  headerText: string;
  footerOn: boolean;
  footerText: string;
  pageNumber: PageNumberPos;
  // view prefs (persisted so the workspace feels the same next session)
  ruler: boolean;
  darkPageBorder: boolean;
  rulerUnit: "cm" | "in";
}

export interface WriterDocState {
  type: "writer2";
  doc: unknown; // TipTap JSONContent
  config: Partial<WriterSettings>;
  boxes?: FloatingBox[];
}

export interface PageSizeDef {
  /** page size in mm (portrait) */
  wMm: number;
  hMm: number;
  /** px @96dpi (portrait) */
  pxW: number;
  pxH: number;
  css: string;
}

export const PAGE_SIZES: Record<PageId, PageSizeDef> = {
  A4: { wMm: 210, hMm: 297, pxW: 794, pxH: 1123, css: "A4" },
  A5: { wMm: 148, hMm: 210, pxW: 559, pxH: 794, css: "A5" },
  Letter: { wMm: 215.9, hMm: 279.4, pxW: 816, pxH: 1056, css: "letter" },
  Legal: { wMm: 215.9, hMm: 355.6, pxW: 816, pxH: 1344, css: "legal" },
};

export const MM_TO_PX = 96 / 25.4;
export const PX_TO_TWIP = 15; // 1px @96dpi = 15 twentieths of a point

export const DEFAULT_SETTINGS: WriterSettings = {
  pageSize: "A4",
  orientation: "portrait",
  marginTop: 96,
  marginRight: 76,
  marginBottom: 96,
  marginLeft: 76,
  font: "Calibri",
  fontSize: 11,
  columns: 1,
  columnSpacing: 48,
  columnDivider: false,
  lineNumbers: false,
  headerOn: false,
  headerText: "",
  footerOn: false,
  footerText: "",
  pageNumber: "none",
  ruler: true,
  darkPageBorder: false,
  rulerUnit: "cm",
};

/** Word margin presets, in mm (top / right / bottom / left). */
export const MARGIN_PRESETS: Record<string, [number, number, number, number]> = {
  Normal: [25.4, 31.7, 25.4, 31.7],
  Narrow: [12.7, 12.7, 12.7, 12.7],
  Moderate: [25.4, 19.05, 25.4, 19.05],
  Wide: [25.4, 50.8, 25.4, 50.8],
};

export function marginsToPreset(s: WriterSettings): string {
  const cur: [number, number, number, number] = [
    s.marginTop / MM_TO_PX,
    s.marginRight / MM_TO_PX,
    s.marginBottom / MM_TO_PX,
    s.marginLeft / MM_TO_PX,
  ];
  for (const [name, p] of Object.entries(MARGIN_PRESETS)) {
    if (p.every((v, i) => Math.abs(v - cur[i]) < 0.8)) return name;
  }
  return "Custom";
}

export function mmMargins(top: number, right: number, bottom: number, left: number) {
  return {
    marginTop: Math.round(top * MM_TO_PX),
    marginRight: Math.round(right * MM_TO_PX),
    marginBottom: Math.round(bottom * MM_TO_PX),
    marginLeft: Math.round(left * MM_TO_PX),
  };
}

/** Resolved page geometry in px for the current settings. */
export function pageGeometry(s: WriterSettings) {
  const def = PAGE_SIZES[s.pageSize] ?? PAGE_SIZES.A4;
  const pw = s.orientation === "landscape" ? def.pxH : def.pxW;
  const ph = s.orientation === "landscape" ? def.pxW : def.pxH;
  return { pw, ph, def };
}

export function mergeSettings(partial?: Partial<WriterSettings> | null): WriterSettings {
  return { ...DEFAULT_SETTINGS, ...(partial || {}) };
}

export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

export const SYSTEM_FONTS = [
  "Calibri", "Cambria", "Arial", "Georgia", "Times New Roman", "Courier New",
  "Consolas", "Verdana", "Tahoma", "Trebuchet MS", "Impact", "Segoe UI",
];
export const GOOGLE_FONTS = [
  "Poppins", "Roboto", "Open Sans", "Lato", "Montserrat", "Nunito",
  "Playfair Display", "Merriweather", "PT Serif", "Libre Baskerville",
  "Noto Sans Devanagari", "Mukta", "Hind",
];
export const ALL_FONTS = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

export const THEME_COLORS = [
  "#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0", "#f1f5f9", "#ffffff",
  "#7f1d1d", "#b91c1c", "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2",
  "#78350f", "#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7",
  "#14532d", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7",
  "#0c4a6e", "#0369a1", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd", "#e0f2fe",
  "#3730a3", "#4338ca", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff",
  "#581c87", "#7e22ce", "#9333ea", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff", "#f3e8ff",
];

export const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fecaca", "#fed7aa", "#e2e8f0", "none"];

export const SYMBOL_SETS: { name: string; chars: string[] }[] = [
  { name: "Latin & quotes", chars: ["©", "®", "™", "§", "¶", "†", "‡", "•", "…", "«", "»", "\u201C", "\u201D", "\u2018", "\u2019", "—", "–", "¡", "¿", "æ", "œ", "ß", "å", "ø"] },
  { name: "Currency", chars: ["$", "¢", "€", "£", "¥", "₹", "₨", "₣", "₤", "₩", "₽", "₱", "₦", "฿", "₫", "₴"] },
  { name: "Math", chars: ["±", "×", "÷", "≠", "≈", "≤", "≥", "∞", "∑", "∏", "√", "∫", "∂", "∆", "π", "µ", "Ω", "°", "′", "″", "‰", "∴", "∈", "∅"] },
  { name: "Arrows", chars: ["←", "→", "↑", "↓", "↔", "↕", "⇐", "⇒", "⇔", "⇕", "↵", "⇧", "➢", "➤", "▶", "◀", "▲", "▼", "◆", "●"] },
  { name: "Greek", chars: ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω"] },
];

export const WORDART_STYLES: { name: string; from: string; to: string; outline: boolean; font: string; weight: number }[] = [
  { name: "Fill Blue", from: "#1d4ed8", to: "#38bdf8", outline: false, font: "Arial Black", weight: 800 },
  { name: "Fill Red", from: "#b91c1c", to: "#f87171", outline: false, font: "Arial Black", weight: 800 },
  { name: "Fill Gold", from: "#b45309", to: "#fde047", outline: false, font: "Impact", weight: 700 },
  { name: "Outline Dark", from: "#0f172a", to: "#475569", outline: true, font: "Impact", weight: 700 },
  { name: "Outline Violet", from: "#6d28d9", to: "#c084fc", outline: true, font: "Arial Black", weight: 800 },
  { name: "Fill Green", from: "#14532d", to: "#4ade80", outline: false, font: "Impact", weight: 700 },
];

export const LINE_SPACINGS = ["1", "1.15", "1.5", "2", "3"];
