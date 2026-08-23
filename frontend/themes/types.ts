/**
 * School Website Theme Type System — WordPress-like theme architecture.
 *
 * Each theme is a self-contained package with:
 *   - Colors (light/dark palettes)
 *   - Typography (fonts, sizes, weights)
 *   - Spacing & Layout
 *   - Header configuration (style, layout, behavior)
 *   - Footer configuration
 *   - Hero section defaults
 *   - Section defaults (grid, animations, dividers)
 *   - Mobile overrides
 *   - Default page layouts (home, about, academics, etc.)
 *   - Custom CSS
 */

// ─── Color System ────────────────────────────────────────

export interface SchoolColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  card: string;
  border: string;
  success?: string;
  warning?: string;
  error?: string;
}

export interface SchoolColorPreset {
  name: string;
  description?: string;
  colors: SchoolColorPalette;
}

// ─── Typography ──────────────────────────────────────────

export interface SchoolTypography {
  headingFont: string;
  bodyFont: string;
  fontUrls: string[];
  sizes: {
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    body: string;
    small: string;
  };
  weights: {
    heading: number;
    body: number;
  };
  lineHeights: {
    heading: number;
    body: number;
  };
}

// ─── Spacing & Layout ────────────────────────────────────

export interface SchoolSpacing {
  sectionPadding: string;
  cardPadding: string;
  gap: string;
  containerMaxWidth: string;
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

// ─── Header ──────────────────────────────────────────────

export type HeaderStyle = "sticky" | "fixed" | "static" | "transparent";
export type HeaderLayout = "logo-nav-actions" | "centered-logo" | "split-nav" | "minimal";

export interface SchoolHeaderConfig {
  style: HeaderStyle;
  layout: HeaderLayout;
  height: string;
  bgColor?: string;
  textColor?: string;
  logo: {
    position: "left" | "center";
    maxHeight: string;
  };
  navigation: {
    style: "horizontal" | "dropdown" | "mega" | "sidebar";
    items: SchoolNavItem[];
  };
  topBar?: {
    enabled: boolean;
    text: string;
    bgColor: string;
    textColor: string;
  };
  cta?: {
    text: string;
    href: string;
    style: "button" | "link";
  };
  mobileMenu: "slide" | "fullscreen" | "dropdown";
}

export interface SchoolNavItem {
  label: string;
  href: string;
  children?: SchoolNavItem[];
}

// ─── Footer ──────────────────────────────────────────────

export type FooterStyle = "minimal" | "full" | "columns" | "centered";

export interface SchoolFooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface SchoolFooterConfig {
  style: FooterStyle;
  columns: SchoolFooterColumn[];
  socialLinks: { platform: string; url: string; icon: string }[];
  copyright: string;
  bgColor?: string;
  textColor?: string;
  showMap?: boolean;
  contactInfo?: {
    address: string;
    phone: string;
    email: string;
  };
}

// ─── Hero Section ────────────────────────────────────────

export type HeroStyle = "parallax" | "slideshow" | "video" | "static" | "split" | "gradient" | "fullscreen";

export interface SchoolHeroConfig {
  style: HeroStyle;
  height: string;
  overlay: boolean;
  overlayOpacity: number;
  contentPosition: "left" | "center" | "right";
  animation: "fade" | "slide" | "zoom" | "none";
  textAlignment: "left" | "center" | "right";
}

// ─── Section Defaults ────────────────────────────────────

export type SectionDivider = "none" | "wave" | "diagonal" | "curve";

export interface SchoolSectionsConfig {
  animations: boolean;
  animationStyle: "fade" | "slide-up" | "scale" | "stagger";
  sectionDivider: SectionDivider;
  sectionSpacing: "compact" | "normal" | "spacious";
}

// ─── Mobile Overrides ────────────────────────────────────

export interface SchoolMobileConfig {
  heroHeight: string;
  fontSize: string;
  hideSections: string[];
  mobileMenu: "slide" | "fullscreen" | "dropdown";
  stickyNav?: boolean;
}

// ─── Default Page Sections ───────────────────────────────

export interface SchoolPageSection {
  id: string;
  type: string;
  props: Record<string, unknown>;
  settings?: {
    bg?: string;
    padding?: string;
    margin?: string;
    maxWidth?: string;
    animation?: string;
  };
}

export interface SchoolPageLayout {
  sections: SchoolPageSection[];
  headerOverride?: Partial<SchoolHeaderConfig>;
  footerOverride?: Partial<SchoolFooterConfig>;
}

export interface SchoolDefaultPages {
  home: SchoolPageLayout;
  about?: SchoolPageLayout;
  academics?: SchoolPageLayout;
  admission?: SchoolPageLayout;
  teachers?: SchoolPageLayout;
  gallery?: SchoolPageLayout;
  contact?: SchoolPageLayout;
  results?: SchoolPageLayout;
  events?: SchoolPageLayout;
  notices?: SchoolPageLayout;
  alumni?: SchoolPageLayout;
}

// ─── Complete School Theme Definition ────────────────────

export interface SchoolThemeDefinition {
  // Identity
  id: string;
  slug: string;
  name: string;
  description: string;
  thumbnail?: string;
  previewImages?: string[];

  // Classification
  category: "nepal-traditional" | "modern-minimal" | "colorful-vibrant" | "professional" | "boarding-school";
  tags: string[];
  isPremium: boolean;
  price: number;

  // Design System
  colors: SchoolColorPalette;
  darkColors?: SchoolColorPalette;
  colorPresets?: SchoolColorPreset[];
  typography: SchoolTypography;
  spacing: SchoolSpacing;

  // Layout Components
  header: SchoolHeaderConfig;
  footer: SchoolFooterConfig;
  hero: SchoolHeroConfig;
  sections: SchoolSectionsConfig;
  mobile: SchoolMobileConfig;

  // Default Pages
  defaultPages: SchoolDefaultPages;

  // Custom Code
  customCss?: string;

  // Widget compatibility
  requiredWidgets: string[];
  supportedWidgets: string[];
}

// ─── Theme Installation (per-school overrides) ───────────

export interface SchoolThemeOverrides {
  colors?: Partial<SchoolColorPalette>;
  darkColors?: Partial<SchoolColorPalette>;
  typography?: Partial<SchoolTypography>;
  spacing?: Partial<SchoolSpacing>;
  header?: Partial<SchoolHeaderConfig>;
  footer?: Partial<SchoolFooterConfig>;
  hero?: Partial<SchoolHeroConfig>;
  sections?: Partial<SchoolSectionsConfig>;
  mobile?: Partial<SchoolMobileConfig>;
  customCss?: string;
}
