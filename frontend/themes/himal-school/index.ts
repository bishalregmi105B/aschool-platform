/**
 * Himal School — Modern Minimal School Theme
 *
 * Clean, modern design for progressive private schools.
 * Inspired by Himalayan aesthetics with warm earthy tones.
 */
import type { SchoolThemeDefinition } from "../types";

const himalSchool: SchoolThemeDefinition = {
  id: "himal-school",
  slug: "himal-school",
  name: "Himal School",
  description: "Modern, minimal school theme with warm Himalayan aesthetics. Ideal for progressive private schools and academies.",
  category: "modern-minimal",
  tags: ["modern", "minimal", "private", "academy", "premium"],
  isPremium: false,
  price: 0,

  colors: {
    primary: "#7c3aed",
    secondary: "#0891b2",
    accent: "#f59e0b",
    background: "#fafaf9",
    foreground: "#1c1917",
    muted: "#f5f5f4",
    card: "#ffffff",
    border: "#e7e5e4",
    success: "#22c55e",
    warning: "#eab308",
    error: "#ef4444",
  },

  darkColors: {
    primary: "#a78bfa",
    secondary: "#22d3ee",
    accent: "#fbbf24",
    background: "#1c1917",
    foreground: "#fafaf9",
    muted: "#292524",
    card: "#292524",
    border: "#44403c",
  },

  typography: {
    headingFont: "Outfit",
    bodyFont: "Inter",
    fontUrls: [
      "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap",
    ],
    sizes: { h1: "3rem", h2: "2.25rem", h3: "1.75rem", h4: "1.375rem", body: "1rem", small: "0.875rem" },
    weights: { heading: 600, body: 400 },
    lineHeights: { heading: 1.15, body: 1.65 },
  },

  spacing: {
    sectionPadding: "5rem 2rem",
    cardPadding: "1.5rem",
    gap: "2rem",
    containerMaxWidth: "1280px",
    borderRadius: { none: "0", sm: "0.375rem", md: "0.75rem", lg: "1rem", full: "9999px" },
  },

  header: {
    style: "sticky",
    layout: "centered-logo",
    height: "64px",
    bgColor: "#ffffff",
    textColor: "#1c1917",
    logo: { position: "center", maxHeight: "44px" },
    navigation: {
      style: "horizontal",
      items: [
        { label: "About", href: "/about" },
        { label: "Academics", href: "/academics" },
        { label: "Admission", href: "/admission" },
        { label: "Faculty", href: "/teachers" },
        { label: "Life@School", href: "/gallery" },
        { label: "Results", href: "/results" },
        { label: "News", href: "/news" },
        { label: "Contact", href: "/contact" },
      ],
    },
    cta: { text: "Enroll Now", href: "/admission", style: "button" },
    mobileMenu: "fullscreen",
  },

  footer: {
    style: "columns",
    columns: [
      { title: "School", links: [{ label: "About", href: "/about" }, { label: "History", href: "/about#history" }, { label: "Team", href: "/about#team" }] },
      { title: "Academic", links: [{ label: "Programs", href: "/academics" }, { label: "Calendar", href: "/events" }, { label: "Results", href: "/results" }] },
      { title: "Admissions", links: [{ label: "Apply", href: "/admission" }, { label: "Requirements", href: "/admission#requirements" }, { label: "Tour", href: "/contact" }] },
      { title: "Community", links: [{ label: "Alumni", href: "/alumni" }, { label: "News", href: "/news" }, { label: "Gallery", href: "/gallery" }] },
    ],
    socialLinks: [
      { platform: "facebook", url: "#", icon: "Facebook" },
      { platform: "instagram", url: "#", icon: "Instagram" },
      { platform: "youtube", url: "#", icon: "Youtube" },
      { platform: "tiktok", url: "#", icon: "Music" },
    ],
    copyright: "© {year} {schoolName}",
    bgColor: "#1c1917",
    textColor: "#a8a29e",
    showMap: false,
  },

  hero: {
    style: "fullscreen",
    height: "100vh",
    overlay: true,
    overlayOpacity: 0.4,
    contentPosition: "left",
    animation: "slide",
    textAlignment: "left",
  },

  sections: {
    animations: true,
    animationStyle: "slide-up",
    sectionDivider: "wave",
    sectionSpacing: "spacious",
  },

  mobile: {
    heroHeight: "60vh",
    fontSize: "1rem",
    hideSections: [],
    mobileMenu: "fullscreen",
    stickyNav: true,
  },

  defaultPages: {
    home: {
      sections: [
        { id: "hero", type: "hero-fullscreen", props: { video: true } },
        { id: "intro", type: "split-content", props: { layout: "image-text" } },
        { id: "numbers", type: "school-stats", props: { style: "animated-counter" } },
        { id: "programs", type: "program-cards", props: { columns: 4, style: "modern" } },
        { id: "campus", type: "campus-tour", props: { style: "immersive" } },
        { id: "news", type: "latest-news", props: { count: 3, style: "cards" } },
        { id: "testimonials", type: "testimonials", props: { style: "carousel" } },
        { id: "cta", type: "admission-cta", props: { style: "gradient" } },
      ],
    },
    about: {
      sections: [
        { id: "hero", type: "page-hero", props: { title: "Our Story", style: "parallax" } },
        { id: "vision", type: "mission-vision", props: { style: "cards" } },
        { id: "timeline", type: "school-timeline", props: {} },
        { id: "values", type: "core-values", props: { columns: 4 } },
        { id: "leadership", type: "leadership-team", props: {} },
      ],
    },
  },

  customCss: "",
  requiredWidgets: ["hero-fullscreen", "school-stats"],
  supportedWidgets: [
    "hero-fullscreen", "split-content", "school-stats", "program-cards",
    "campus-tour", "latest-news", "testimonials", "admission-cta",
    "page-hero", "mission-vision", "school-timeline", "core-values",
    "leadership-team", "result-checker", "photo-gallery", "contact-form",
  ],
};

export default himalSchool;
