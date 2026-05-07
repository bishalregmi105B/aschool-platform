"""AI Website Designer — generates school websites from prompts using Claude."""
import json
import os

import anthropic

CLAUDE_MODEL = os.getenv("CLAUDE_QUALITY_MODEL", "claude-sonnet-4-20250514")


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
    ) -> dict:
        """Generate 3 website design variations for a school.

        Returns:
            {
                "variations": [
                    {
                        "theme_slug": "modern-minimal",
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

Available themes: government, private-classic, modern-minimal, montessori, tech-school,
international, boarding, nepal-heritage, community, college, primary-colorful,
secondary-professional, sports-school, arts-school, religious, girls-school,
science-school, language-school, dark-premium, festival-auto

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

        try:
            client = anthropic.Anthropic()
            response = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text)
        except Exception as e:
            return {
                "variations": [
                    _default_variation("modern-minimal", "Clean & Modern", school_name),
                    _default_variation("nepal-heritage", "Nepal Heritage", school_name),
                    _default_variation("private-classic", "Classic Elegance", school_name),
                ],
                "error": str(e),
            }

    @staticmethod
    def generate_school_copy(
        school_name: str,
        school_type: str = "private",
        level: str = "secondary",
        existing_data: dict | None = None,
    ) -> dict:
        """Generate full website copy for all pages."""
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

        try:
            client = anthropic.Anthropic()
            response = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=3000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
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
        "modern-minimal": {"primary": "#2563EB", "secondary": "#F8FAFC", "accent": "#F59E0B", "background": "#FFFFFF", "text": "#1E293B"},
        "nepal-heritage": {"primary": "#B91C1C", "secondary": "#FEF3C7", "accent": "#D97706", "background": "#FFFBEB", "text": "#451A03"},
        "private-classic": {"primary": "#1E3A5F", "secondary": "#F5F0EB", "accent": "#C9A94E", "background": "#FFFFFF", "text": "#1A1A2E"},
    }
    return {
        "theme_slug": theme_slug,
        "style_label": label,
        "why_this_fits": f"A {label.lower()} design that works well for {school_name}.",
        "color_palette": palettes.get(theme_slug, palettes["modern-minimal"]),
        "fonts": {"heading": "Inter", "body": "Inter"},
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
