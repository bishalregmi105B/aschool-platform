/**
 * School Theme Loader — Unified theme loading from folders + API.
 *
 * WordPress-like theme architecture for school websites:
 *   1. Built-in themes live in /themes/{slug}/index.ts
 *   2. DB-stored themes from API
 *   3. School installations merge base theme + overrides
 */
import type {
  SchoolThemeDefinition,
  SchoolThemeOverrides,
  SchoolColorPalette,
  SchoolTypography,
  SchoolSpacing,
  SchoolHeaderConfig,
  SchoolFooterConfig,
  SchoolHeroConfig,
  SchoolSectionsConfig,
  SchoolMobileConfig,
} from "./types";
import { THEMES as REGISTRY_THEMES, type SchoolTheme as RegistryTheme } from "./registry";

// ─── Built-in Theme Registry ─────────────────────────────

import vidyalaya from "./vidyalaya";
import himalSchool from "./himal-school";

function mapCategory(theme: RegistryTheme): SchoolThemeDefinition["category"] {
  if (["government", "nepal-heritage", "religious", "language-school"].includes(theme.id)) {
    return "nepal-traditional";
  }
  if (["montessori", "primary-colorful", "arts-school", "festival-auto"].includes(theme.id)) {
    return "colorful-vibrant";
  }
  if (["boarding"].includes(theme.id)) {
    return "boarding-school";
  }
  if (["college", "dark-premium", "science-school", "secondary-professional"].includes(theme.id)) {
    return "professional";
  }
  return "modern-minimal";
}

function registryThemeToDefinition(theme: RegistryTheme): SchoolThemeDefinition {
  const navItems = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Academics", href: "/academics" },
    { label: "Admission", href: "/admission" },
    { label: "Teachers", href: "/teachers" },
    { label: "Gallery", href: "/gallery" },
    { label: "Results", href: "/results" },
    { label: "Contact", href: "/contact" },
  ];

  return {
    id: theme.id,
    slug: theme.id,
    name: theme.name,
    description: theme.description,
    category: mapCategory(theme),
    tags: [theme.tier, theme.id, theme.name.toLowerCase()],
    isPremium: theme.tier === "pro",
    price: theme.tier === "pro" ? 299 : 0,
    colors: {
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      accent: theme.colors.accent,
      background: theme.colors.bg,
      foreground: theme.colors.text,
      muted: theme.colors.bg,
      card: "#ffffff",
      border: "rgba(15, 23, 42, 0.12)",
      success: "#16a34a",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFont: theme.fonts.heading,
      bodyFont: theme.fonts.body,
      fontUrls: [],
      sizes: { h1: "3rem", h2: "2.2rem", h3: "1.6rem", h4: "1.25rem", body: "1rem", small: "0.875rem" },
      weights: { heading: 700, body: 400 },
      lineHeights: { heading: 1.15, body: 1.65 },
    },
    spacing: {
      sectionPadding: "4.5rem 2rem",
      cardPadding: "1.5rem",
      gap: "1.5rem",
      containerMaxWidth: "1200px",
      borderRadius: { none: "0", sm: "0.25rem", md: "0.5rem", lg: "0.75rem", full: "9999px" },
    },
    header: {
      style: "sticky",
      layout: "logo-nav-actions",
      height: "72px",
      bgColor: theme.colors.primary,
      textColor: "#ffffff",
      logo: { position: "left", maxHeight: "48px" },
      navigation: { style: "horizontal", items: navItems },
      cta: { text: "Apply Now", href: "/admission", style: "button" },
      mobileMenu: "slide",
    },
    footer: {
      style: "columns",
      columns: [
        { title: "School", links: navItems.slice(1, 4) },
        { title: "Community", links: navItems.slice(4, 7) },
        { title: "Support", links: [{ label: "Contact", href: "/contact" }, { label: "Admission", href: "/admission" }] },
      ],
      socialLinks: [],
      copyright: "© {year} {schoolName}",
      bgColor: theme.colors.primary,
      textColor: "#ffffff",
    },
    hero: {
      style: theme.id === "festival-auto" ? "slideshow" : "fullscreen",
      height: "78vh",
      overlay: true,
      overlayOpacity: 0.35,
      contentPosition: "center",
      animation: "fade",
      textAlignment: "center",
    },
    sections: {
      animations: true,
      animationStyle: "slide-up",
      sectionDivider: "none",
      sectionSpacing: "normal",
    },
    mobile: {
      heroHeight: "56vh",
      fontSize: "0.95rem",
      hideSections: [],
      mobileMenu: "slide",
      stickyNav: true,
    },
    defaultPages: {
      home: {
        sections: [
          { id: "hero", type: "hero-slideshow", props: { slides: 3 } },
          { id: "welcome", type: "welcome-message", props: {} },
          { id: "stats", type: "school-stats", props: {} },
          { id: "programs", type: "program-cards", props: { columns: 3 } },
          { id: "notices", type: "latest-notices", props: { count: 5 } },
          { id: "gallery", type: "photo-gallery", props: { count: 8 } },
          { id: "cta", type: "admission-cta", props: {} },
        ],
      },
      about: {
        sections: [
          { id: "hero", type: "page-hero", props: { title: "About Us" } },
          { id: "mission", type: "mission-vision", props: {} },
          { id: "principal", type: "principal-message", props: {} },
        ],
      },
      academics: {
        sections: [
          { id: "hero", type: "page-hero", props: { title: "Academics" } },
          { id: "curriculum", type: "curriculum-overview", props: {} },
          { id: "subjects", type: "subject-grid", props: {} },
        ],
      },
      admission: {
        sections: [
          { id: "hero", type: "page-hero", props: { title: "Admission" } },
          { id: "cta", type: "admission-cta", props: {} },
        ],
      },
      contact: {
        sections: [
          { id: "hero", type: "page-hero", props: { title: "Contact" } },
          { id: "contact", type: "contact-form", props: {} },
        ],
      },
    },
    customCss: "",
    requiredWidgets: ["hero-slideshow", "school-stats", "latest-notices"],
    supportedWidgets: [
      "hero-slideshow",
      "welcome-message",
      "school-stats",
      "program-cards",
      "latest-notices",
      "photo-gallery",
      "admission-cta",
      "page-hero",
      "mission-vision",
      "principal-message",
      "curriculum-overview",
      "subject-grid",
      "contact-form",
    ],
  };
}

const GENERATED_THEMES: SchoolThemeDefinition[] = REGISTRY_THEMES.map(registryThemeToDefinition);

const BUILTIN_THEMES: SchoolThemeDefinition[] = [
  vidyalaya,
  himalSchool,
  ...GENERATED_THEMES.filter((theme) => !["vidyalaya", "himal-school"].includes(theme.slug)),
];

const BUILTIN_MAP = new Map<string, SchoolThemeDefinition>(
  BUILTIN_THEMES.map((t) => [t.slug, t])
);

// ─── Theme Categories ────────────────────────────────────

export const SCHOOL_THEME_CATEGORIES = [
  { id: "nepal-traditional", name: "Nepal Traditional", description: "Themes inspired by Nepali culture and education heritage" },
  { id: "modern-minimal", name: "Modern Minimal", description: "Clean, contemporary school designs" },
  { id: "colorful-vibrant", name: "Colorful & Vibrant", description: "Lively, engaging designs for primary schools" },
  { id: "professional", name: "Professional", description: "Formal designs for colleges and higher education" },
  { id: "boarding-school", name: "Boarding School", description: "Comprehensive designs showcasing campus life" },
] as const;

// ─── Deep Merge Utility ──────────────────────────────────

function deepMerge<T extends object>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const val = overrides[key];
    if (val !== undefined && val !== null) {
      if (typeof val === "object" && !Array.isArray(val) && typeof result[key] === "object" && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key] as Record<string, unknown>, val as Record<string, unknown>) as T[keyof T];
      } else {
        result[key] = val as T[keyof T];
      }
    }
  }
  return result;
}

// ─── Theme Operations ────────────────────────────────────

export function getBuiltinTheme(slug: string): SchoolThemeDefinition | undefined {
  return BUILTIN_MAP.get(slug);
}

export function getAllBuiltinThemes(): SchoolThemeDefinition[] {
  return [...BUILTIN_THEMES];
}

export function getThemesByCategory(category: string): SchoolThemeDefinition[] {
  return BUILTIN_THEMES.filter((t) => t.category === category);
}

export function getFreeThemes(): SchoolThemeDefinition[] {
  return BUILTIN_THEMES.filter((t) => !t.isPremium);
}

export function searchThemes(query: string): SchoolThemeDefinition[] {
  const q = query.toLowerCase();
  return BUILTIN_THEMES.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q))
  );
}

/** Apply per-school overrides to a base theme */
export function applyOverrides(
  base: SchoolThemeDefinition,
  overrides: SchoolThemeOverrides
): SchoolThemeDefinition {
  return {
    ...base,
    colors: overrides.colors ? deepMerge(base.colors, overrides.colors) as unknown as SchoolColorPalette : base.colors,
    darkColors: overrides.darkColors
      ? deepMerge(base.darkColors || base.colors, overrides.darkColors) as unknown as SchoolColorPalette
      : base.darkColors,
    typography: overrides.typography
      ? deepMerge(base.typography, overrides.typography as Record<string, unknown>) as unknown as SchoolTypography
      : base.typography,
    spacing: overrides.spacing
      ? deepMerge(base.spacing, overrides.spacing as Record<string, unknown>) as unknown as SchoolSpacing
      : base.spacing,
    header: overrides.header
      ? deepMerge(base.header, overrides.header as Record<string, unknown>) as unknown as SchoolHeaderConfig
      : base.header,
    footer: overrides.footer
      ? deepMerge(base.footer, overrides.footer as Record<string, unknown>) as unknown as SchoolFooterConfig
      : base.footer,
    hero: overrides.hero
      ? deepMerge(base.hero, overrides.hero as Record<string, unknown>) as unknown as SchoolHeroConfig
      : base.hero,
    sections: overrides.sections
      ? deepMerge(base.sections, overrides.sections as Record<string, unknown>) as unknown as SchoolSectionsConfig
      : base.sections,
    mobile: overrides.mobile
      ? deepMerge(base.mobile, overrides.mobile as Record<string, unknown>) as unknown as SchoolMobileConfig
      : base.mobile,
    customCss: overrides.customCss
      ? `${base.customCss || ""}\n${overrides.customCss}`
      : base.customCss,
  };
}

// ─── Re-exports ──────────────────────────────────────────

export type { SchoolThemeDefinition, SchoolThemeOverrides };
export { BUILTIN_THEMES, BUILTIN_MAP };
