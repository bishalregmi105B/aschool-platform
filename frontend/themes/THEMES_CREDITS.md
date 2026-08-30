# Theme Credits — Real School Website Designs

All themes in `registry.ts` are rebuilt (tokens-only ports: palette, Google-Fonts pairing,
hero/section accents) from real, openly-licensed school/education website designs.
No CSS/JS or images were copied wholesale; every design is re-expressed with the
platform's `--color-*` / `--font-*` token system and the shared section renderer.
Placeholder photography comes from the platform's existing stock/placeholder mechanism.

| # | Theme id | Ported from (source) | Author | License | Source URL |
|---|----------|----------------------|--------|---------|------------|
| 1 | `collegiate-heritage` | Education Hub WP theme | WEN Themes | GPLv3 | https://wordpress.org/themes/education-hub/ |
| 2 | `university-azure` | University Hub WP theme | WEN Themes | GPLv3 | https://wordpress.org/themes/university-hub/ |
| 3 | `educenter-bright` | Educenter WP theme | Sparkle Themes (sparklewpthemes) | GPLv2 or later | https://wordpress.org/themes/educenter/ |
| 4 | `kids-campus-playful` | Kids Campus WP theme | Grace Themes | GPLv2 or later | https://wordpress.org/themes/kids-campus/ |
| 5 | `blossom-montessori` | Preschool and Kindergarten WP theme | Rara Theme | GPLv2 or later | https://wordpress.org/themes/preschool-and-kindergarten/ |
| 6 | `community-skyline` | Education Zone WP theme | Rara Theme | GPLv2 or later | https://wordpress.org/themes/education-zone/ |
| 7 | `global-elearning` | eLearning WP theme | Masteriyo / ThemeGrill | GPLv3 or later | https://wordpress.org/themes/elearning/ |
| 8 | `boarding-crimson` | VW School Education WP theme | VW Themes | GPLv3 or later | https://wordpress.org/themes/vw-school-education/ |
| 9 | `institute-industrial` | Education Insight WP theme | Ovation Themes (pewilliams) | GPLv3 or later | https://wordpress.org/themes/education-insight/ |
| 10 | `campus-warm` | Campus Education WP theme | Themesglance | GPLv3 | https://wordpress.org/themes/campus-education/ |

## Derivation notes

- Palettes were extracted from each source theme's published `style.css`
  (GPL permits derivation and redistribution with attribution, given above).
- Font pairings mirror the fonts each source theme actually loads
  (all hosted on Google Fonts, which serves Nepal):
  Education Hub → Merriweather Sans / Open Sans · University Hub → Roboto ·
  Educenter → Roboto Condensed / Roboto · Kids Campus → Amatic SC / Open Sans ·
  Preschool and Kindergarten → Lato (Pacifico accent) · Education Zone → Roboto ·
  eLearning → DM Sans / Inter · VW School Education → PT Serif / PT Sans ·
  Education Insight → Roboto Slab / Roboto · Campus Education → Merriweather / Roboto.
- Each design's hero treatment (full-bleed vs. centered vs. split) and section
  accent style follow the source demo's layout language, rebuilt with the
  ASchool theme tokens defined in `frontend/themes/types.ts`.
- The ten previous invented themes (`government`, `private-classic`,
  `modern-minimal`, `montessori`, `nepal-heritage`, `tech-school`,
  `international`, `boarding`, `community`, `college`, `primary-colorful`,
  `secondary-professional`, `sports-school`, `arts-school`, `religious`,
  `girls-school`, `science-school`, `language-school`, `dark-premium`,
  `festival-auto`) were removed; existing DB rows are migrated to the closest
  new theme by `backend/scripts/migrate_theme_slugs.py` (idempotent).

Removed-source themes retain their original author credits here only where a new
theme derives from them — none of the removed themes were third-party derived.
