"""Theme Engine — Manage and apply 10 school website themes.

All themes are token-level ports of real, openly-licensed school/education
website designs (GPL WordPress education themes). Sources and licenses are
recorded in frontend/themes/THEMES_CREDITS.md.
"""


class ThemeEngineService:
    """Manage theme selection and CSS generation for school websites."""

    # Default theme when a website has none configured (and the fallback for
    # unknown ids). Mirrors frontend/themes/registry.ts DEFAULT_THEME_ID.
    DEFAULT_THEME_ID = "global-elearning"

    THEMES = {
        "collegiate-heritage": {
            "name": "Collegiate Heritage",
            "description": "Classic academic look from the GPL 'Education Hub' design — deep navy, amber accents, formal Merriweather Sans",
            "tier": "free",
            "colors": {"primary": "#294a70", "secondary": "#ffab1f", "accent": "#15305b", "bg": "#ffffff", "text": "#333333"},
            "fonts": {"heading": "Merriweather Sans", "body": "Open Sans"},
        },
        "university-azure": {
            "name": "University Azure",
            "description": "College & university design from the GPL 'University Hub' theme — indigo blue, sky links, orange call-to-action",
            "tier": "pro",
            "colors": {"primary": "#505ba0", "secondary": "#179bd7", "accent": "#ff6000", "bg": "#ffffff", "text": "#222222"},
            "fonts": {"heading": "Roboto", "body": "Roboto"},
        },
        "educenter-bright": {
            "name": "Educenter Bright",
            "description": "Modern K-12 look from the GPL 'Educenter' theme — deep institutional blue with energetic red highlights",
            "tier": "free",
            "colors": {"primary": "#004a8d", "secondary": "#e74c3c", "accent": "#014b8d", "bg": "#f9f9f9", "text": "#222222"},
            "fonts": {"heading": "Roboto Condensed", "body": "Roboto"},
        },
        "kids-campus-playful": {
            "name": "Kids Campus Playful",
            "description": "Playful kindergarten design from the GPL 'Kids Campus' theme — aqua cyan, sunny yellow, handwritten Amatic SC headings",
            "tier": "pro",
            "colors": {"primary": "#0f9fbc", "secondary": "#efc62c", "accent": "#f380b2", "bg": "#fefefe", "text": "#1e1e1e"},
            "fonts": {"heading": "Amatic SC", "body": "Open Sans"},
        },
        "blossom-montessori": {
            "name": "Blossom Montessori",
            "description": "Gentle montessori style from the GPL 'Preschool and Kindergarten' theme — pastel blue, blossom pink, teal accents, friendly Lato",
            "tier": "free",
            "colors": {"primary": "#41aad4", "secondary": "#f380b2", "accent": "#4fbba9", "bg": "#f9f9f9", "text": "#313131"},
            "fonts": {"heading": "Lato", "body": "Lato"},
        },
        "community-skyline": {
            "name": "Community Skyline",
            "description": "Accessible community-school design from the GPL 'Education Zone' theme — friendly sky blue, deep steel, high-contrast Roboto",
            "tier": "free",
            "colors": {"primary": "#4aa0d7", "secondary": "#21577a", "accent": "#474b4e", "bg": "#f9fcff", "text": "#393939"},
            "fonts": {"heading": "Roboto", "body": "Roboto"},
        },
        "global-elearning": {
            "name": "Global eLearning",
            "description": "International LMS look from the GPL 'eLearning' theme — confident course blue, airy grays, modern DM Sans + Inter",
            "tier": "pro",
            "colors": {"primary": "#027abb", "secondary": "#269bd1", "accent": "#1e7ba6", "bg": "#fafafa", "text": "#16181a"},
            "fonts": {"heading": "DM Sans", "body": "Inter"},
        },
        "boarding-crimson": {
            "name": "Boarding Crimson",
            "description": "Residential boarding-school design from the GPL 'VW School Education' theme — heritage navy, crest crimson, scholarly PT Serif",
            "tier": "pro",
            "colors": {"primary": "#002b46", "secondary": "#c2272d", "accent": "#0d2b46", "bg": "#f8f8f8", "text": "#1a1a1a"},
            "fonts": {"heading": "PT Serif", "body": "PT Sans"},
        },
        "institute-industrial": {
            "name": "Institute Industrial",
            "description": "Technical-institute style from the GPL 'Education Insight' theme — charcoal panels, lab green accents, sturdy Roboto Slab",
            "tier": "pro",
            "colors": {"primary": "#2c2c2c", "secondary": "#8fb90e", "accent": "#db6159", "bg": "#f5f5f5", "text": "#222222"},
            "fonts": {"heading": "Roboto Slab", "body": "Roboto"},
        },
        "campus-warm": {
            "name": "Campus Warm",
            "description": "Warm campus-day design from the GPL 'Campus Education' theme — sunrise orange, amber highlights, classic Merriweather headings",
            "tier": "pro",
            "colors": {"primary": "#ff8634", "secondary": "#ffcc73", "accent": "#15305b", "bg": "#ffffff", "text": "#333333"},
            "fonts": {"heading": "Merriweather", "body": "Roboto"},
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
        theme = cls.THEMES.get(theme_id) or cls.THEMES[cls.DEFAULT_THEME_ID]
        colors = {**theme["colors"], **(overrides or {})}
        fonts = theme["fonts"]

        return f""":root {{
  --color-primary: {colors['primary']};
  --color-secondary: {colors['secondary']};
  --color-accent: {colors['accent']};
  --color-bg: {colors['bg']};
  --color-text: {colors['text']};
  --font-heading: '{fonts['heading']}', sans-serif;
  --font-body: '{fonts['body']}', sans-serif;
}}

body {{
  font-family: var(--font-body);
  background-color: var(--color-bg);
  color: var(--color-text);
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

    # Core palette tokens the public layout overrides per theme.
    CORE_COLOR_KEYS = ("primary", "secondary", "accent", "bg", "text")

    @classmethod
    def synced_colors(
        cls,
        existing_colors: dict | None,
        theme_id: str,
        school_id: str | None = None,
        color_overrides: dict | None = None,
    ) -> dict | None:
        """Core palette for ``theme_id`` merged over auxiliary color overrides.

        - The five core tokens come from the theme; white-label brand colors
          (and explicit per-call ``color_overrides``) take precedence.
        - Auxiliary keys stored by other flows (e.g. "surface" from page
          templates) are preserved.
        Returns None when the theme id is unknown.
        """
        theme = cls.get_theme(theme_id)
        if not theme:
            return None
        overrides: dict = {}
        if school_id:
            overrides.update(cls._white_label_brand_colors(school_id))
        overrides.update(color_overrides or {})
        theme_colors = theme["colors"]
        colors = {
            k: v for k, v in dict(existing_colors or {}).items()
            if k not in cls.CORE_COLOR_KEYS
        }
        for key in cls.CORE_COLOR_KEYS:
            colors[key] = overrides.get(key, theme_colors[key])
        return colors

    @classmethod
    def apply_theme(cls, school_id: str, theme_id: str, color_overrides: dict | None = None) -> dict:
        """Apply a theme to a school's website config."""
        from app.services.website.website_builder import WebsiteBuilderService

        if not cls.get_theme(theme_id):
            return {"error": "Theme not found"}

        # The public site layout applies customizations["colors"] over the
        # theme palette (generateThemeCSS overrides). A stale palette left by
        # an earlier page-template apply would hide the newly chosen theme, so
        # the five core tokens are rewritten here (auxiliary keys such as
        # "surface" survive; white-label brand colors keep precedence).
        effective = cls.synced_colors(None, theme_id, school_id=school_id, color_overrides=color_overrides)

        update_data = {
            "theme": theme_id,
            "primary_color": effective["primary"],
            "secondary_color": effective["secondary"],
            "colors": effective,
        }

        return WebsiteBuilderService.update_config(school_id, update_data)

    @staticmethod
    def _white_label_brand_colors(school_id: str) -> dict:
        try:
            from app.services.website.white_label import WhiteLabelService

            return WhiteLabelService.brand_colors(school_id)
        except Exception:  # pragma: no cover — branding must never break themes
            return {}
