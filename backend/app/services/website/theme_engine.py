"""Theme Engine — Manage and apply 20 school website themes."""


class ThemeEngineService:
    """Manage theme selection and CSS generation for school websites."""

    THEMES = {
        "government": {
            "name": "Government School",
            "description": "NEB color scheme — maroon & gold, formal serif, government stamp look",
            "tier": "free",
            "colors": {"primary": "#800020", "secondary": "#DAA520", "accent": "#4B0082", "bg": "#FFF8F0", "text": "#1A0A00"},
            "fonts": {"heading": "Merriweather", "body": "Noto Serif"},
        },
        "private-classic": {
            "name": "Private Classic",
            "description": "Navy & gold, elegant Playfair Display, trust-building",
            "tier": "free",
            "colors": {"primary": "#1E3A5F", "secondary": "#C9A94E", "accent": "#8B0000", "bg": "#FFFFFF", "text": "#1A1A2E"},
            "fonts": {"heading": "Playfair Display", "body": "Lora"},
        },
        "modern-minimal": {
            "name": "Modern Minimal",
            "description": "White + single accent, Inter font, generous whitespace",
            "tier": "free",
            "colors": {"primary": "#2563EB", "secondary": "#F8FAFC", "accent": "#F59E0B", "bg": "#FFFFFF", "text": "#1E293B"},
            "fonts": {"heading": "Inter", "body": "Inter"},
        },
        "montessori": {
            "name": "Montessori",
            "description": "Bright pastels, rounded corners, playful Nunito, child-friendly",
            "tier": "free",
            "colors": {"primary": "#E76F51", "secondary": "#2A9D8F", "accent": "#E9C46A", "bg": "#FFF5F0", "text": "#264653"},
            "fonts": {"heading": "Nunito", "body": "Nunito"},
        },
        "nepal-heritage": {
            "name": "Nepal Heritage",
            "description": "Terracotta & gold, traditional patterns, culturally rooted",
            "tier": "free",
            "colors": {"primary": "#B91C1C", "secondary": "#003893", "accent": "#D97706", "bg": "#FFFBEB", "text": "#451A03"},
            "fonts": {"heading": "Mukta", "body": "Mukta"},
        },
        "tech-school": {
            "name": "Tech School",
            "description": "Gray & orange, industrial feel, skill-focused",
            "tier": "pro",
            "colors": {"primary": "#374151", "secondary": "#F97316", "accent": "#06B6D4", "bg": "#F9FAFB", "text": "#111827"},
            "fonts": {"heading": "JetBrains Mono", "body": "Inter"},
        },
        "international": {
            "name": "International School",
            "description": "Clean white & blue, Cambridge/IB inspired, global feel",
            "tier": "pro",
            "colors": {"primary": "#1D4ED8", "secondary": "#EFF6FF", "accent": "#10B981", "bg": "#FFFFFF", "text": "#1E3A5F"},
            "fonts": {"heading": "Poppins", "body": "Open Sans"},
        },
        "boarding": {
            "name": "Boarding School",
            "description": "Warm wood tones & deep green, residential feel, safety emphasis",
            "tier": "pro",
            "colors": {"primary": "#14532D", "secondary": "#A16207", "accent": "#92400E", "bg": "#F0FDF4", "text": "#052E16"},
            "fonts": {"heading": "Crimson Text", "body": "Source Sans 3"},
        },
        "community": {
            "name": "Community School",
            "description": "Simple, accessible, high contrast, works on slow connections",
            "tier": "pro",
            "colors": {"primary": "#1F2937", "secondary": "#3B82F6", "accent": "#EF4444", "bg": "#FFFFFF", "text": "#111827"},
            "fonts": {"heading": "Roboto", "body": "Roboto"},
        },
        "college": {
            "name": "College / +2",
            "description": "Young, energetic, purple & blue gradient, social media integrated",
            "tier": "pro",
            "colors": {"primary": "#7C3AED", "secondary": "#2563EB", "accent": "#EC4899", "bg": "#F5F3FF", "text": "#1E1B4B"},
            "fonts": {"heading": "Space Grotesk", "body": "DM Sans"},
        },
        "primary-colorful": {
            "name": "Primary Colorful",
            "description": "Rainbow palette, large text, cartoon-style, fun",
            "tier": "pro",
            "colors": {"primary": "#DC2626", "secondary": "#2563EB", "accent": "#16A34A", "bg": "#FFFBEB", "text": "#1C1917"},
            "fonts": {"heading": "Fredoka One", "body": "Nunito"},
        },
        "secondary-professional": {
            "name": "Secondary Professional",
            "description": "Professional gray & blue, grade-8-to-12 appropriate",
            "tier": "pro",
            "colors": {"primary": "#1E40AF", "secondary": "#6B7280", "accent": "#F59E0B", "bg": "#F8FAFC", "text": "#1E293B"},
            "fonts": {"heading": "IBM Plex Sans", "body": "IBM Plex Sans"},
        },
        "sports-school": {
            "name": "Sports School",
            "description": "Dynamic angles, red & black, sports photography heavy",
            "tier": "pro",
            "colors": {"primary": "#DC2626", "secondary": "#18181B", "accent": "#FBBF24", "bg": "#FFFFFF", "text": "#18181B"},
            "fonts": {"heading": "Oswald", "body": "Roboto Condensed"},
        },
        "arts-school": {
            "name": "Arts School",
            "description": "Free-form layout, colorful, portfolio showcase, expressive",
            "tier": "pro",
            "colors": {"primary": "#9333EA", "secondary": "#EC4899", "accent": "#06B6D4", "bg": "#FAF5FF", "text": "#1E1B4B"},
            "fonts": {"heading": "Caveat", "body": "Quicksand"},
        },
        "religious": {
            "name": "Religious School",
            "description": "Calm neutrals, symbol integration, community-focused",
            "tier": "pro",
            "colors": {"primary": "#78350F", "secondary": "#B45309", "accent": "#D97706", "bg": "#FFFBEB", "text": "#422006"},
            "fonts": {"heading": "Cormorant Garamond", "body": "EB Garamond"},
        },
        "girls-school": {
            "name": "Girls' School",
            "description": "Elegant rose & purple, empowerment messaging, graceful",
            "tier": "pro",
            "colors": {"primary": "#9D174D", "secondary": "#7E22CE", "accent": "#F472B6", "bg": "#FDF2F8", "text": "#500724"},
            "fonts": {"heading": "Libre Baskerville", "body": "Lato"},
        },
        "science-school": {
            "name": "Science School",
            "description": "Dark theme with neon accents, STEM-focused, modern lab feel",
            "tier": "pro",
            "colors": {"primary": "#0F172A", "secondary": "#22D3EE", "accent": "#A3E635", "bg": "#0F172A", "text": "#E2E8F0"},
            "fonts": {"heading": "Space Mono", "body": "Inter"},
        },
        "language-school": {
            "name": "Language School",
            "description": "Multi-script display, flags, linguistics-inspired",
            "tier": "pro",
            "colors": {"primary": "#0369A1", "secondary": "#0891B2", "accent": "#F97316", "bg": "#F0F9FF", "text": "#0C4A6E"},
            "fonts": {"heading": "Noto Sans", "body": "Noto Sans"},
        },
        "dark-premium": {
            "name": "Dark Premium",
            "description": "Near-black & gold, ultra-premium feel, exclusive positioning",
            "tier": "pro",
            "colors": {"primary": "#111827", "secondary": "#D4AF37", "accent": "#F5F5DC", "bg": "#0A0A0A", "text": "#F5F5F5"},
            "fonts": {"heading": "Playfair Display", "body": "Inter"},
        },
        "festival-auto": {
            "name": "Festival Auto",
            "description": "Any base theme + seasonal overlays: Dashain, Tihar, Saraswati Puja, Republic Day",
            "tier": "pro",
            "colors": {"primary": "#B91C1C", "secondary": "#F59E0B", "accent": "#16A34A", "bg": "#FFFFFF", "text": "#1A1A2E"},
            "fonts": {"heading": "Mukta", "body": "Inter"},
            "festival_overlays": {
                "dashain": {"accent_color": "#DC2626", "border_pattern": "marigold", "months": [9, 10]},
                "tihar": {"accent_color": "#F59E0B", "border_pattern": "diyo_lights", "months": [10, 11]},
                "saraswati_puja": {"accent_color": "#FBBF24", "border_pattern": "white_yellow", "months": [1, 2]},
                "republic_day": {"accent_color": "#003893", "border_pattern": "flag", "months": [5]},
            },
        },
    }

    @classmethod
    def list_themes(cls) -> list[dict]:
        """Return all available themes."""
        return [{"id": k, **v} for k, v in cls.THEMES.items()]

    @classmethod
    def get_theme(cls, theme_id: str) -> dict | None:
        """Get a specific theme's configuration."""
        theme = cls.THEMES.get(theme_id)
        if theme:
            return {"id": theme_id, **theme}
        return None

    @classmethod
    def generate_css(cls, theme_id: str, overrides: dict | None = None) -> str:
        """Generate CSS variables for a theme."""
        theme = cls.THEMES.get(theme_id) or cls.THEMES["modern-minimal"]
        colors = {**theme["colors"], **(overrides or {})}
        fonts = theme["fonts"]

        return f""":root {{
  --color-primary: {colors['primary']};
  --color-secondary: {colors['secondary']};
  --color-accent: {colors['accent']};
  --color-bg: {colors['bg']};
  --font-heading: '{fonts['heading']}', sans-serif;
  --font-body: '{fonts['body']}', sans-serif;
}}

body {{
  font-family: var(--font-body);
  background-color: var(--color-bg);
  color: #1a1a2e;
}}

h1, h2, h3, h4, h5, h6 {{
  font-family: var(--font-heading);
  color: var(--color-primary);
}}

a {{ color: var(--color-secondary); }}
a:hover {{ color: var(--color-primary); }}

.btn-primary {{
  background-color: var(--color-primary);
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}}

.btn-secondary {{
  background-color: var(--color-secondary);
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}}

.navbar {{
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: white;
  padding: 1rem 2rem;
}}

.footer {{
  background-color: var(--color-primary);
  color: white;
  padding: 2rem;
}}"""

    @classmethod
    def apply_theme(cls, school_id: str, theme_id: str, color_overrides: dict | None = None) -> dict:
        """Apply a theme to a school's website config."""
        from app.services.website.website_builder import WebsiteBuilderService

        theme = cls.get_theme(theme_id)
        if not theme:
            return {"error": "Theme not found"}

        update_data = {
            "theme": theme_id,
            "primary_color": (color_overrides or {}).get("primary", theme["colors"]["primary"]),
            "secondary_color": (color_overrides or {}).get("secondary", theme["colors"]["secondary"]),
        }

        return WebsiteBuilderService.update_config(school_id, update_data)
