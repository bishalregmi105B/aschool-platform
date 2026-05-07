/** School Website Theme Registry — 20 themes (5 free, 15 pro) */

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
    id: "government",
    name: "Government School",
    description: "NEB color scheme — maroon & gold, formal serif, government stamp look",
    tier: "free",
    colors: { primary: "#800020", secondary: "#DAA520", accent: "#4B0082", bg: "#FFF8F0", text: "#1A0A00" },
    fonts: { heading: "Merriweather", body: "Noto Serif" },
  },
  {
    id: "private-classic",
    name: "Private Classic",
    description: "Navy & gold, elegant Playfair Display, trust-building",
    tier: "free",
    colors: { primary: "#1E3A5F", secondary: "#C9A94E", accent: "#8B0000", bg: "#FFFFFF", text: "#1A1A2E" },
    fonts: { heading: "Playfair Display", body: "Lora" },
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "White + single accent, Inter font, generous whitespace",
    tier: "free",
    colors: { primary: "#2563EB", secondary: "#F8FAFC", accent: "#F59E0B", bg: "#FFFFFF", text: "#1E293B" },
    fonts: { heading: "Inter", body: "Inter" },
  },
  {
    id: "montessori",
    name: "Montessori",
    description: "Bright pastels, rounded corners, playful Nunito, child-friendly",
    tier: "free",
    colors: { primary: "#E76F51", secondary: "#2A9D8F", accent: "#E9C46A", bg: "#FFF5F0", text: "#264653" },
    fonts: { heading: "Nunito", body: "Nunito" },
  },
  {
    id: "nepal-heritage",
    name: "Nepal Heritage",
    description: "Terracotta & gold, traditional patterns, culturally rooted",
    tier: "free",
    colors: { primary: "#B91C1C", secondary: "#003893", accent: "#D97706", bg: "#FFFBEB", text: "#451A03" },
    fonts: { heading: "Mukta", body: "Mukta" },
  },
  {
    id: "tech-school",
    name: "Tech School",
    description: "Gray & orange, industrial feel, skill-focused",
    tier: "pro",
    colors: { primary: "#374151", secondary: "#F97316", accent: "#06B6D4", bg: "#F9FAFB", text: "#111827" },
    fonts: { heading: "JetBrains Mono", body: "Inter" },
  },
  {
    id: "international",
    name: "International School",
    description: "Clean white & blue, Cambridge/IB inspired, global feel",
    tier: "pro",
    colors: { primary: "#1D4ED8", secondary: "#EFF6FF", accent: "#10B981", bg: "#FFFFFF", text: "#1E3A5F" },
    fonts: { heading: "Poppins", body: "Open Sans" },
  },
  {
    id: "boarding",
    name: "Boarding School",
    description: "Warm wood tones & deep green, residential feel",
    tier: "pro",
    colors: { primary: "#14532D", secondary: "#A16207", accent: "#92400E", bg: "#F0FDF4", text: "#052E16" },
    fonts: { heading: "Crimson Text", body: "Source Sans 3" },
  },
  {
    id: "community",
    name: "Community School",
    description: "Simple, accessible, high contrast, works on slow connections",
    tier: "pro",
    colors: { primary: "#1F2937", secondary: "#3B82F6", accent: "#EF4444", bg: "#FFFFFF", text: "#111827" },
    fonts: { heading: "Roboto", body: "Roboto" },
  },
  {
    id: "college",
    name: "College / +2",
    description: "Young, energetic, purple & blue gradient",
    tier: "pro",
    colors: { primary: "#7C3AED", secondary: "#2563EB", accent: "#EC4899", bg: "#F5F3FF", text: "#1E1B4B" },
    fonts: { heading: "Space Grotesk", body: "DM Sans" },
  },
  {
    id: "primary-colorful",
    name: "Primary Colorful",
    description: "Rainbow palette, large text, fun for young students",
    tier: "pro",
    colors: { primary: "#DC2626", secondary: "#2563EB", accent: "#16A34A", bg: "#FFFBEB", text: "#1C1917" },
    fonts: { heading: "Fredoka One", body: "Nunito" },
  },
  {
    id: "secondary-professional",
    name: "Secondary Professional",
    description: "Professional gray & blue, grade 8-12 appropriate",
    tier: "pro",
    colors: { primary: "#1E40AF", secondary: "#6B7280", accent: "#F59E0B", bg: "#F8FAFC", text: "#1E293B" },
    fonts: { heading: "IBM Plex Sans", body: "IBM Plex Sans" },
  },
  {
    id: "sports-school",
    name: "Sports School",
    description: "Dynamic, red & black, sports photography heavy",
    tier: "pro",
    colors: { primary: "#DC2626", secondary: "#18181B", accent: "#FBBF24", bg: "#FFFFFF", text: "#18181B" },
    fonts: { heading: "Oswald", body: "Roboto Condensed" },
  },
  {
    id: "arts-school",
    name: "Arts School",
    description: "Free-form, colorful, portfolio showcase, expressive",
    tier: "pro",
    colors: { primary: "#9333EA", secondary: "#EC4899", accent: "#06B6D4", bg: "#FAF5FF", text: "#1E1B4B" },
    fonts: { heading: "Caveat", body: "Quicksand" },
  },
  {
    id: "religious",
    name: "Religious School",
    description: "Calm neutrals, community-focused",
    tier: "pro",
    colors: { primary: "#78350F", secondary: "#B45309", accent: "#D97706", bg: "#FFFBEB", text: "#422006" },
    fonts: { heading: "Cormorant Garamond", body: "EB Garamond" },
  },
  {
    id: "girls-school",
    name: "Girls' School",
    description: "Elegant rose & purple, empowerment messaging",
    tier: "pro",
    colors: { primary: "#9D174D", secondary: "#7E22CE", accent: "#F472B6", bg: "#FDF2F8", text: "#500724" },
    fonts: { heading: "Libre Baskerville", body: "Lato" },
  },
  {
    id: "science-school",
    name: "Science School",
    description: "Dark theme with neon accents, STEM-focused, lab feel",
    tier: "pro",
    colors: { primary: "#0F172A", secondary: "#22D3EE", accent: "#A3E635", bg: "#0F172A", text: "#E2E8F0" },
    fonts: { heading: "Space Mono", body: "Inter" },
  },
  {
    id: "language-school",
    name: "Language School",
    description: "Multi-script display, linguistics-inspired",
    tier: "pro",
    colors: { primary: "#0369A1", secondary: "#0891B2", accent: "#F97316", bg: "#F0F9FF", text: "#0C4A6E" },
    fonts: { heading: "Noto Sans", body: "Noto Sans" },
  },
  {
    id: "dark-premium",
    name: "Dark Premium",
    description: "Near-black & gold, ultra-premium, exclusive",
    tier: "pro",
    colors: { primary: "#111827", secondary: "#D4AF37", accent: "#F5F5DC", bg: "#0A0A0A", text: "#F5F5F5" },
    fonts: { heading: "Playfair Display", body: "Inter" },
  },
  {
    id: "festival-auto",
    name: "Festival Auto",
    description: "Seasonal overlays: Dashain, Tihar, Saraswati Puja, Republic Day",
    tier: "pro",
    colors: { primary: "#B91C1C", secondary: "#F59E0B", accent: "#16A34A", bg: "#FFFFFF", text: "#1A1A2E" },
    fonts: { heading: "Mukta", body: "Inter" },
    festival_overlays: {
      dashain: { accent_color: "#DC2626", border_pattern: "marigold", months: [9, 10] },
      tihar: { accent_color: "#F59E0B", border_pattern: "diyo_lights", months: [10, 11] },
      saraswati_puja: { accent_color: "#FBBF24", border_pattern: "white_yellow", months: [1, 2] },
      republic_day: { accent_color: "#003893", border_pattern: "flag", months: [5] },
    },
  },
];

export const FREE_THEMES = THEMES.filter((t) => t.tier === "free");
export const PRO_THEMES = THEMES.filter((t) => t.tier === "pro");

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
