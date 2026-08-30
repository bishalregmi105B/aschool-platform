"""AI Website Designer — generates school websites from prompts using AI.

All LLM calls route through AITokenHub — per-school quota enforcement and
usage logging happen there (E7: no direct Anthropic calls).
"""
import json

from app.services.ai.token_hub import AITokenHub


class SchoolWebsiteDesigner:
    """Generates 3 design variations from a school description prompt."""

    @staticmethod
    def generate_from_prompt(
        school_name: str,
        school_type: str = "private",
        level: str = "secondary",
        style_preference: str = "modern",
        language: str = "en",
        key_strengths: list | None = None,
        logo_description: str | None = None,
        school_id=None,
        user_id=None,
    ) -> dict:
        """Generate 3 website design variations for a school.

        school_id/user_id are optional — resolved from the request context
        (``g``) when omitted, so existing callers work unchanged.

        Returns:
            {
                "variations": [
                    {
                        "theme_slug": "global-elearning",
                        "style_label": "Clean & Modern",
                        "why_this_fits": "...",
                        "color_palette": {"primary": "#...", "secondary": "#...", ...},
                        "fonts": {"heading": "Inter", "body": "Inter"},
                        "hero_style": "image_right",
                        "ai_generated_copy": {"headline_en": "...", "headline_ne": "...", ...}
                    },
                    ...
                ]
            }
        """
        strengths_text = ", ".join(key_strengths or ["quality education"])
        logo_context = f"\nLogo description: {logo_description}" if logo_description else ""

        prompt = f"""You are a school website design expert for Nepal.
Generate exactly 3 distinct website design variations for this school:

School: {school_name}
Type: {school_type} (government/private/boarding/international/montessori)
Level: {level} (primary/secondary/higher-secondary/college)
Style preference: {style_preference} (traditional/modern/vibrant/minimal)
Key strengths: {strengths_text}
Language: {language}{logo_context}

Available themes: collegiate-heritage, university-azure, educenter-bright,
kids-campus-playful, blossom-montessori, community-skyline, global-elearning,
boarding-crimson, institute-industrial, campus-warm

For each variation, return a JSON object with:
- theme_slug: best matching theme from the list above
- style_label: 2-3 word label (e.g. "Traditional Elegance")
- why_this_fits: 1 sentence explanation
- color_palette: {{primary, secondary, accent, background, text}} as hex colors
- fonts: {{heading, body}} using Google Fonts names
- hero_style: one of "image_right", "full_bg", "centered", "slider"
- ai_generated_copy: {{
    headline_en, headline_ne, tagline_en, tagline_ne, cta_text_en, cta_text_ne
  }}

Respond ONLY with a JSON object: {{"variations": [...]}}"""

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        try:
            text = AITokenHub.request(
                school_id=school_id,
                user_id=user_id,
                feature="website-designer:generate-design",
                messages=[{"role": "user", "content": prompt}],
                model="smart",  # quality tier (sonnet-class model via hub routing)
                max_tokens=2000,
                temperature=1.0,  # matches the previous direct Anthropic default
                metadata={"school_name": school_name, "style_preference": style_preference},
            )["text"]
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text)
        except Exception as e:
            return {
                "variations": [
                    _default_variation("global-elearning", "Clean & Modern", school_name),
                    _default_variation("collegiate-heritage", "Traditional Elegance", school_name),
                    _default_variation("educenter-bright", "Classic Elegance", school_name),
                ],
                "error": str(e),
            }

    @staticmethod
    def generate_school_copy(
        school_name: str,
        school_type: str = "private",
        level: str = "secondary",
        existing_data: dict | None = None,
        school_id=None,
        user_id=None,
    ) -> dict:
        """Generate full website copy for all pages.

        school_id/user_id are optional — resolved from the request context
        (``g``) when omitted, so existing callers work unchanged.
        """
        data_context = ""
        if existing_data:
            data_context = f"\nExisting school data: {json.dumps(existing_data, default=str)[:2000]}"

        prompt = f"""Generate complete bilingual (English + Nepali) website copy for:
School: {school_name} ({school_type}, {level}){data_context}

Generate copy for these pages:
1. About Us (history, mission, vision, values)
2. Academics (curriculum overview, subjects, methodology)
3. Facilities (list of facilities with descriptions)
4. Contact (office hours, address placeholder, map description)

Return ONLY a JSON: {{
  "about": {{"en": "...", "ne": "..."}},
  "mission": {{"en": "...", "ne": "..."}},
  "vision": {{"en": "...", "ne": "..."}},
  "academics": {{"en": "...", "ne": "..."}},
  "facilities": [{{"name_en": "...", "name_ne": "...", "description_en": "...", "description_ne": "..."}}],
  "contact_intro": {{"en": "...", "ne": "..."}}
}}"""

        school_id, user_id = AITokenHub.resolve_context(school_id, user_id)
        try:
            text = AITokenHub.request(
                school_id=school_id,
                user_id=user_id,
                feature="website-designer:generate-copy",
                messages=[{"role": "user", "content": prompt}],
                model="smart",  # quality tier (sonnet-class model via hub routing)
                max_tokens=3000,
                temperature=1.0,  # matches the previous direct Anthropic default
                metadata={"school_name": school_name},
            )["text"]
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text)
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def suggest_sections(school_type: str, level: str) -> list[dict]:
        """Return recommended page sections based on school type."""
        base = [
            {"slug": "header", "category": "headers", "label": "School Header"},
            {"slug": "hero_slider", "category": "heroes", "label": "Photo Slider Hero"},
            {"slug": "principal_message", "category": "about", "label": "Principal's Message"},
            {"slug": "mission_vision", "category": "about", "label": "Mission & Vision"},
            {"slug": "curriculum", "category": "academic", "label": "Curriculum Overview"},
            {"slug": "teacher_gallery", "category": "staff", "label": "Our Teachers"},
            {"slug": "notices_widget", "category": "dynamic", "label": "Latest Notices"},
            {"slug": "events_widget", "category": "dynamic", "label": "Upcoming Events"},
            {"slug": "admission_form", "category": "admission", "label": "Admission Enquiry"},
            {"slug": "facilities_grid", "category": "facilities", "label": "Facilities"},
            {"slug": "testimonials", "category": "social_proof", "label": "Testimonials"},
            {"slug": "contact_map", "category": "contact", "label": "Contact & Map"},
            {"slug": "footer", "category": "headers", "label": "Footer"},
        ]

        extra = {
            "government": [
                {"slug": "gov_header", "category": "headers", "label": "Government Style Header"},
                {"slug": "results_banner", "category": "academic", "label": "Exam Results Banner"},
            ],
            "boarding": [
                {"slug": "hostel_tour", "category": "facilities", "label": "Hostel Virtual Tour"},
                {"slug": "daily_schedule", "category": "academic", "label": "Daily Schedule"},
            ],
            "montessori": [
                {"slug": "learning_areas", "category": "academic", "label": "Learning Areas"},
                {"slug": "gallery", "category": "facilities", "label": "Photo Gallery"},
            ],
            "international": [
                {"slug": "ib_curriculum", "category": "academic", "label": "IB/Cambridge Curriculum"},
                {"slug": "alumni_stories", "category": "social_proof", "label": "Alumni Success Stories"},
            ],
        }

        return base + extra.get(school_type, [])


def _default_variation(theme_slug: str, label: str, school_name: str) -> dict:
    palettes = {
        "global-elearning": {"primary": "#027abb", "secondary": "#269bd1", "accent": "#1e7ba6", "background": "#fafafa", "text": "#16181a"},
        "collegiate-heritage": {"primary": "#294a70", "secondary": "#ffab1f", "accent": "#15305b", "background": "#ffffff", "text": "#333333"},
        "educenter-bright": {"primary": "#004a8d", "secondary": "#e74c3c", "accent": "#014b8d", "background": "#f9f9f9", "text": "#222222"},
    }
    return {
        "theme_slug": theme_slug,
        "style_label": label,
        "why_this_fits": f"A {label.lower()} design that works well for {school_name}.",
        "color_palette": palettes.get(theme_slug, palettes["global-elearning"]),
        "fonts": {"heading": "DM Sans", "body": "Inter"},
        "hero_style": "image_right",
        "ai_generated_copy": {
            "headline_en": f"Welcome to {school_name}",
            "headline_ne": f"{school_name}मा स्वागत छ",
            "tagline_en": "Empowering the future through quality education",
            "tagline_ne": "गुणस्तरीय शिक्षाबाट भविष्य निर्माण",
            "cta_text_en": "Apply Now",
            "cta_text_ne": "आवेदन दिनुहोस्",
        },
    }
