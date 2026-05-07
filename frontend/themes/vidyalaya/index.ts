/**
 * Vidyalaya — Nepal Traditional School Theme
 *
 * Classic Nepali school design with blue-gold color scheme,
 * inspired by government and community school aesthetics.
 */
import type { SchoolThemeDefinition } from "../types";

const vidyalaya: SchoolThemeDefinition = {
  id: "vidyalaya",
  slug: "vidyalaya",
  name: "Vidyalaya",
  description: "Classic Nepal school theme with traditional blue-gold aesthetics. Perfect for community and government schools.",
  category: "nepal-traditional",
  tags: ["nepal", "traditional", "community", "government", "formal"],
  isPremium: false,
  price: 0,

  colors: {
    primary: "#1e40af",
    secondary: "#b45309",
    accent: "#d97706",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
    card: "#ffffff",
    border: "#e2e8f0",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
  },

  darkColors: {
    primary: "#3b82f6",
    secondary: "#f59e0b",
    accent: "#fbbf24",
    background: "#0f172a",
    foreground: "#f8fafc",
    muted: "#1e293b",
    card: "#1e293b",
    border: "#334155",
  },

  colorPresets: [
    {
      name: "Royal Blue",
      colors: { primary: "#1e40af", secondary: "#b45309", accent: "#d97706", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9", card: "#ffffff", border: "#e2e8f0" },
    },
    {
      name: "Emerald Green",
      colors: { primary: "#047857", secondary: "#92400e", accent: "#d97706", background: "#ffffff", foreground: "#0f172a", muted: "#f0fdf4", card: "#ffffff", border: "#d1fae5" },
    },
    {
      name: "Crimson Red",
      colors: { primary: "#b91c1c", secondary: "#1e40af", accent: "#f59e0b", background: "#ffffff", foreground: "#0f172a", muted: "#fef2f2", card: "#ffffff", border: "#fecaca" },
    },
  ],

  typography: {
    headingFont: "Poppins",
    bodyFont: "Inter",
    fontUrls: [
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Inter:wght@400;500;600&display=swap",
    ],
    sizes: { h1: "2.75rem", h2: "2rem", h3: "1.5rem", h4: "1.25rem", body: "1rem", small: "0.875rem" },
    weights: { heading: 700, body: 400 },
    lineHeights: { heading: 1.2, body: 1.6 },
  },

  spacing: {
    sectionPadding: "4rem 2rem",
    cardPadding: "1.5rem",
    gap: "1.5rem",
    containerMaxWidth: "1200px",
    borderRadius: { none: "0", sm: "0.25rem", md: "0.5rem", lg: "0.75rem", full: "9999px" },
  },

  header: {
    style: "sticky",
    layout: "logo-nav-actions",
    height: "72px",
    bgColor: "#1e40af",
    textColor: "#ffffff",
    logo: { position: "left", maxHeight: "48px" },
    navigation: {
      style: "horizontal",
      items: [
        { label: "Home", href: "/" },
        { label: "About", href: "/about" },
        { label: "Academics", href: "/academics" },
        { label: "Admission", href: "/admission" },
        { label: "Teachers", href: "/teachers" },
        { label: "Gallery", href: "/gallery" },
        { label: "Results", href: "/results" },
        { label: "Contact", href: "/contact" },
      ],
    },
    topBar: { enabled: true, text: "📍 School Address | 📞 +977-0XX-XXXXXX", bgColor: "#0f172a", textColor: "#94a3b8" },
    cta: { text: "Apply Now", href: "/admission", style: "button" },
    mobileMenu: "slide",
  },

  footer: {
    style: "full",
    columns: [
      { title: "Quick Links", links: [{ label: "About Us", href: "/about" }, { label: "Teachers", href: "/teachers" }, { label: "Results", href: "/results" }] },
      { title: "Academics", links: [{ label: "Curriculum", href: "/academics" }, { label: "E-Library", href: "/elibrary" }, { label: "Calendar", href: "/events" }] },
      { title: "Connect", links: [{ label: "Admission", href: "/admission" }, { label: "Contact", href: "/contact" }, { label: "Alumni", href: "/alumni" }] },
    ],
    socialLinks: [
      { platform: "facebook", url: "#", icon: "Facebook" },
      { platform: "youtube", url: "#", icon: "Youtube" },
    ],
    copyright: "© {year} {schoolName}. All rights reserved.",
    bgColor: "#0f172a",
    textColor: "#94a3b8",
    showMap: true,
    contactInfo: { address: "School Address, Nepal", phone: "+977-0XX-XXXXXX", email: "info@school.edu.np" },
  },

  hero: {
    style: "slideshow",
    height: "70vh",
    overlay: true,
    overlayOpacity: 0.5,
    contentPosition: "center",
    animation: "fade",
    textAlignment: "center",
  },

  sections: {
    animations: true,
    animationStyle: "fade",
    sectionDivider: "none",
    sectionSpacing: "normal",
  },

  mobile: {
    heroHeight: "50vh",
    fontSize: "0.9375rem",
    hideSections: [],
    mobileMenu: "slide",
    stickyNav: true,
  },

  defaultPages: {
    home: {
      sections: [
        { id: "hero", type: "hero-slideshow", props: { slides: 3 } },
        { id: "welcome", type: "welcome-message", props: {} },
        { id: "stats", type: "school-stats", props: { items: ["students", "teachers", "years", "pass_rate"] } },
        { id: "programs", type: "program-cards", props: { columns: 3 } },
        { id: "notices", type: "latest-notices", props: { count: 5 } },
        { id: "events", type: "upcoming-events", props: { count: 3 } },
        { id: "testimonials", type: "testimonials", props: { count: 4 } },
        { id: "gallery", type: "photo-gallery", props: { count: 8 } },
        { id: "cta", type: "admission-cta", props: {} },
      ],
    },
    about: {
      sections: [
        { id: "hero", type: "page-hero", props: { title: "About Us" } },
        { id: "mission", type: "mission-vision", props: {} },
        { id: "history", type: "school-history", props: {} },
        { id: "principal", type: "principal-message", props: {} },
        { id: "team", type: "management-team", props: {} },
      ],
    },
    academics: {
      sections: [
        { id: "hero", type: "page-hero", props: { title: "Academics" } },
        { id: "curriculum", type: "curriculum-overview", props: {} },
        { id: "subjects", type: "subject-grid", props: {} },
        { id: "faculty", type: "faculty-highlights", props: {} },
      ],
    },
  },

  customCss: "",
  requiredWidgets: ["hero-slideshow", "school-stats", "latest-notices"],
  supportedWidgets: [
    "hero-slideshow", "welcome-message", "school-stats", "program-cards",
    "latest-notices", "upcoming-events", "testimonials", "photo-gallery",
    "admission-cta", "page-hero", "mission-vision", "school-history",
    "principal-message", "management-team", "curriculum-overview",
    "subject-grid", "faculty-highlights", "result-checker", "contact-form",
  ],
};

export default vidyalaya;
