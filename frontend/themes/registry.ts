/** School Website Theme Registry — 10 themes ported from real, openly-licensed
 *  school/college website designs (see THEMES_CREDITS.md for sources + licenses). */

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  text: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
}

export interface FestivalOverlay {
  accent_color: string;
  border_pattern: string;
  months: number[];
}

export interface SchoolTheme {
  id: string;
  name: string;
  description: string;
  tier: "free" | "pro";
  colors: ThemeColors;
  fonts: ThemeFonts;
  preview?: string;
  festival_overlays?: Record<string, FestivalOverlay>;
}

export const THEMES: SchoolTheme[] = [
  {
    // Education Hub (WEN Themes, GPLv3) — classic collegiate navy & amber
    id: "collegiate-heritage",
    name: "Collegiate Heritage",
    description: "Classic academic look from the GPL 'Education Hub' design — deep navy, amber accents, formal Merriweather Sans",
    tier: "free",
    colors: { primary: "#294a70", secondary: "#ffab1f", accent: "#15305b", bg: "#ffffff", text: "#333333" },
    fonts: { heading: "Merriweather Sans", body: "Open Sans" },
  },
  {
    // University Hub (WEN Themes, GPLv3) — collegiate indigo/sky/orange
    id: "university-azure",
    name: "University Azure",
    description: "College & university design from the GPL 'University Hub' theme — indigo blue, sky links, orange call-to-action",
    tier: "pro",
    colors: { primary: "#505ba0", secondary: "#179bd7", accent: "#ff6000", bg: "#ffffff", text: "#222222" },
    fonts: { heading: "Roboto", body: "Roboto" },
  },
  {
    // Educenter (Sparkle Themes, GPLv2+) — clean modern K-12, deep blue + red
    id: "educenter-bright",
    name: "Educenter Bright",
    description: "Modern K-12 look from the GPL 'Educenter' theme — deep institutional blue with energetic red highlights",
    tier: "free",
    colors: { primary: "#004a8d", secondary: "#e74c3c", accent: "#014b8d", bg: "#f9f9f9", text: "#222222" },
    fonts: { heading: "Roboto Condensed", body: "Roboto" },
  },
  {
    // Kids Campus (Grace Themes, GPLv2+) — playful kindergarten cyan/yellow
    id: "kids-campus-playful",
    name: "Kids Campus Playful",
    description: "Playful kindergarten design from the GPL 'Kids Campus' theme — aqua cyan, sunny yellow, handwritten Amatic SC headings",
    tier: "pro",
    colors: { primary: "#0f9fbc", secondary: "#efc62c", accent: "#f380b2", bg: "#fefefe", text: "#1e1e1e" },
    fonts: { heading: "Amatic SC", body: "Open Sans" },
  },
  {
    // Preschool and Kindergarten (Rara Theme, GPLv2+) — pastel montessori
    id: "blossom-montessori",
    name: "Blossom Montessori",
    description: "Gentle montessori style from the GPL 'Preschool and Kindergarten' theme — pastel blue, blossom pink, teal accents, friendly Lato",
    tier: "free",
    colors: { primary: "#41aad4", secondary: "#f380b2", accent: "#4fbba9", bg: "#f9f9f9", text: "#313131" },
    fonts: { heading: "Lato", body: "Lato" },
  },
  {
    // Education Zone (Rara Theme, GPLv2+) — accessible community school
    id: "community-skyline",
    name: "Community Skyline",
    description: "Accessible community-school design from the GPL 'Education Zone' theme — friendly sky blue, deep steel, high-contrast Roboto",
    tier: "free",
    colors: { primary: "#4aa0d7", secondary: "#21577a", accent: "#474b4e", bg: "#f9fcff", text: "#393939" },
    fonts: { heading: "Roboto", body: "Roboto" },
  },
  {
    // eLearning (Masteriyo/ThemeGrill, GPLv3+) — international LMS
    id: "global-elearning",
    name: "Global eLearning",
    description: "International LMS look from the GPL 'eLearning' theme — confident course blue, airy grays, modern DM Sans + Inter",
    tier: "pro",
    colors: { primary: "#027abb", secondary: "#269bd1", accent: "#1e7ba6", bg: "#fafafa", text: "#16181a" },
    fonts: { heading: "DM Sans", body: "Inter" },
  },
  {
    // VW School Education (VW Themes, GPLv3+) — boarding heritage navy/crimson
    id: "boarding-crimson",
    name: "Boarding Crimson",
    description: "Residential boarding-school design from the GPL 'VW School Education' theme — heritage navy, crest crimson, scholarly PT Serif",
    tier: "pro",
    colors: { primary: "#002b46", secondary: "#c2272d", accent: "#0d2b46", bg: "#f8f8f8", text: "#1a1a1a" },
    fonts: { heading: "PT Serif", body: "PT Sans" },
  },
  {
    // Education Insight (Ovation Themes, GPLv3+) — technical institute charcoal/green
    id: "institute-industrial",
    name: "Institute Industrial",
    description: "Technical-institute style from the GPL 'Education Insight' theme — charcoal panels, lab green accents, sturdy Roboto Slab",
    tier: "pro",
    colors: { primary: "#2c2c2c", secondary: "#8fb90e", accent: "#db6159", bg: "#f5f5f5", text: "#222222" },
    fonts: { heading: "Roboto Slab", body: "Roboto" },
  },
  {
    // Campus Education (Themesglance, GPLv3) — warm day school
    id: "campus-warm",
    name: "Campus Warm",
    description: "Warm campus-day design from the GPL 'Campus Education' theme — sunrise orange, amber highlights, classic Merriweather headings",
    tier: "pro",
    colors: { primary: "#ff8634", secondary: "#ffcc73", accent: "#15305b", bg: "#ffffff", text: "#333333" },
    fonts: { heading: "Merriweather", body: "Roboto" },
  },
];

export const FREE_THEMES = THEMES.filter((t) => t.tier === "free");
export const PRO_THEMES = THEMES.filter((t) => t.tier === "pro");

/** Default theme used when a school website has no theme configured. */
export const DEFAULT_THEME_ID = "global-elearning";

export function getThemeById(id: string): SchoolTheme | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Generate CSS custom properties from a theme */
export function generateThemeCSS(theme: SchoolTheme, overrides?: Partial<ThemeColors>): string {
  const colors = { ...theme.colors, ...overrides };
  return `:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-bg: ${colors.bg};
  --color-text: ${colors.text};
  --font-heading: '${theme.fonts.heading}', sans-serif;
  --font-body: '${theme.fonts.body}', sans-serif;
}`;
}

/** Get active festival overlay for the current month */
export function getActiveFestival(theme: SchoolTheme): FestivalOverlay | null {
  if (!theme.festival_overlays) return null;
  const month = new Date().getMonth() + 1;
  for (const [, overlay] of Object.entries(theme.festival_overlays)) {
    if (overlay.months.includes(month)) return overlay;
  }
  return null;
}
