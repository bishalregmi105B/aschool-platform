# ASchool Plugin, Theme & Template Architecture v2

Date: 2026-09-04 · Status: **SPEC** (nothing in this document is implemented yet)
Scope: `backend/app/plugins/**`, `backend/app/api/v1/{plugins,website,website_builder,design_studio}.py`, `backend/app/services/{website,designer}/**`, `frontend/{app,components,lib,themes}/**`, `aschool_shared/**` + the four Flutter apps.
Assumes (does not repeat) `audits/research/ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md`, `ASCHOOL_WEB_WIDGET_AUDIT.md`, `ASCHOOL_WEB_UI_INVENTORY.md`.

## Hard constraints

1. **The public school website's rendered design must not change.** Everything feeding it becomes data; the pixels stay identical. §4.4 defines the parity mechanism and the test that enforces it.
2. **No big-bang rewrite.** 39 module manifests (`backend/app/plugins/modules/*/manifest.yaml`) + 8 legacy flat manifests (`backend/app/plugins/manifests/*.yaml`) are live. Every step is additive, reversible, and guarded by a compat adapter.
3. **Filesystem remains the catalog source of truth** (`backend/app/plugins/loader.py:10-13`); the `plugins` table remains a mirror (`loader.py:337-420`). v2 adds files, never a seed.
4. **Gating semantics unchanged**: `@plugin_required` + `g.installed_plugins` + single-hop non-transitive aliases (`backend/app/plugins/decorators.py:56-117`).

## 0. Verified baseline — what v2 builds on

| Capability | Where it lives today | v2 verdict |
|---|---|---|
| Manifest discovery, 2 sources, module wins | `loader.py:43-78`, `:136-205` | keep, extend with `schema_version` |
| Code-pointer validation (`api_blueprint`, `models_module`, `services`, `tasks`) | `loader.py:82-134` | promote to a hard-failing CI validator |
| Blueprint mount, skip statically mounted | `loader.py:207-260`, `backend/app/api/v1/__init__.py:9-50` | keep; v2 modules self-mount from `routes.py` |
| Lifecycle hooks `activate/deactivate/uninstall` | `loader.py:315-333`, run at `api/v1/plugins.py:83-101,435,507,705,752` | keep; add `upgrade(db, from_version)` |
| Config schema → settings screen | `loader.py:293-313` → `api/v1/plugins.py:906-925` → `frontend/app/dashboard/plugins/[slug]/settings/page.tsx` | **replace dialect** (§3), keep endpoint shape |
| Per-school config storage + dot-path reads | `SchoolPlugin.config` JSONB (`backend/app/models/plugin.py:107`), `config_store.py:17-55` | keep; add typed coercion + secret vault |
| Event bus | `plugins/events.py:21-113`; **all** listeners in one 1023-line `plugins/listeners.py` | keep bus, move listeners into plugin folders (`listeners.py` per module) |
| Sidebar generation | `loader.py:524-684` + `frontend/components/layout/sidebar.tsx:193-228` | keep; nav moves under `manifest.ui.nav` |
| Entitlements / plan tiers | `entitlements.py:31-275` | untouched |
| Install/trial/subscribe/billing | `billing.py:22-173`, `api/v1/plugins.py:404-810` | untouched |
| Web theme (10 themes) | `backend/app/services/website/theme_engine.py:35-106` **and** `frontend/themes/registry.ts:34-125` (hand-duplicated) | unify behind one token document (§4) |
| Public-site theme delivery | `frontend/app/school/[slug]/layout.tsx:148-163,229-239` via `generateThemeCSS` + `sanitizeColorOverrides` | keep exact CSS-var contract |
| Website sections | `WebsitePage.sections` JSONB (`backend/app/models/website.py:18`); 17 hardcoded types in `frontend/components/website/SectionRenderer.tsx:973-1019`; editor controls in `frontend/lib/school-website/registry.ts` | make registry data-driven, keep components (§5.5) |
| Designer templates | folders `backend/app/templates/designer/<key>/{template.yaml,canvas.json,writer.json,assets/}` (40 packs) scanned by `services/designer/template_folders.py:96-120`, merged with a 2272-line in-code `TEMPLATES` dict (`template_engine.py:898+`), seeded to `designer_templates` (`template_engine.py:1183-1305`) | generalize to `TemplatePack` (§5) |
| PDF CSS / Devanagari | `services/designer/pdf_css.py:14-51` | becomes a token consumer (§4.3) |
| Mobile surface | server-driven `_visibility_for_role` (`backend/app/api/v1/mobile.py:159-468`) + `PluginState`/`PluginGate` (`aschool_shared/lib/services/plugin_provider.dart:11-68`, `widgets/plugin_gate.dart:15-36`) | extend to widgets (§2.6) |

**Three gaps that shape the design.** (a) Only **5** plugins ship a `config_schema.yaml` (attendance, fees, library_management, website_builder, whatsapp_bot) and its dialect has 4 field kinds. (b) **No plugin ships any UI**: 39 of 39 module folders contain only `manifest.yaml`/`__init__.py` (7 also carry `routes.py`+`hooks.py`); all React lives in `frontend/app/dashboard/**`. (c) `backend/tests/test_plugin_manifests.py:9` validates **only** the 8 legacy manifests — the 39 module manifests are untested, which is how ~20 broken code pointers survived (dup audit §4 #4).

---

# 1. PLUGIN PACKAGE v2

## 1.1 Folder layout — everything a plugin needs, inside its own folder

```
backend/app/plugins/modules/<slug>/
├── manifest.yaml            # identity, pricing, deps, capabilities, surfaces (§1.3)
├── config_schema.yaml       # settings dialect v2 (§3)
├── permissions.yaml         # permission keys this plugin defines + role defaults
├── events.yaml              # events emitted / consumed (contract + payload schema)
├── widgets.yaml             # UI widget declarations for web + mobile + website (§2)
├── mobile.yaml              # Flutter surfaces: modules, tabs, quick actions, cards
├── routes.py                # Flask Blueprint  (bp = Blueprint(<slug>, ...))
├── models.py                # SQLAlchemy models OWNED by this plugin
├── hooks.py                 # activate/deactivate/uninstall/upgrade(db, from_version)
├── listeners.py             # @on("...") handlers for events this plugin consumes
├── services/               ├─ __init__.py  + domain services (no Flask imports)
├── tasks/                  ├─ __init__.py  + Celery tasks (beat entries in manifest)
├── migrations/              # alembic revisions owned by the plugin (§1.5)
├── seeds/                   # idempotent seed data (categories, defaults, demo)
├── templates/               # TemplatePacks the plugin ships (§5.2)
│   └── <pack_key>/pack.yaml + layout files + assets/
├── themes/                  # theme token contributions/extensions (§4.1)
│   └── <theme_key>.yaml
├── i18n/{en.json,ne.json}   # translation bundles (widget labels, field labels, errors)
├── ui/                      # WEB widget descriptors + optional React entry map
│   ├── widgets/<widget_key>.yaml       # per-widget spec (data source, slots, config)
│   └── index.web.json                  # {widget_key: registry token} for code widgets
├── tests/                   # pytest module: routes, hooks, schema, widget contract
├── docs/                    # optional long-form docs, screenshots for marketplace
├── README.md                # what it does, config keys, events, widgets, ownership
└── __init__.py              # makes the folder a real Python package (REQUIRED)
```

Rules the loader enforces:

- `manifest.yaml` and `__init__.py` are **mandatory**. `ai_suite` currently violates the second (dup audit §4 #6) — the v2 validator fails on it.
- Everything else is optional; absence means "this plugin has no such surface".
- Naming is fixed (no `manifest:`-declared alternate filenames) so tooling can be file-pattern driven. `manifest.yaml` may still *point* at code outside the folder during migration (§1.4).
- A file present but unparseable is a **validator error**, not a silent skip — today `loader._load_manifest` (`loader.py:140-144`) logs and returns, which hides typos.

## 1.2 Per-file contract

| File | Purpose | Shape | Consumed by |
|---|---|---|---|
| `manifest.yaml` | single descriptor; the only file the loader reads eagerly | §1.3 | `PluginLoader._load_manifest`, `refresh_registry`, marketplace, sidebar |
| `config_schema.yaml` | settings form + validation + storage contract | `{schema_version, groups[], fields[]}` (§3.2) | `GET /plugins/<slug>/config-schema`, `PUT /config` validator, `FormRenderer` |
| `permissions.yaml` | declares permission keys, not roles | `permissions: [{key, label, label_ne, description, default_roles[], implies[]}]` | `@permission_required`, role editor UI, widget `requires_permissions` |
| `events.yaml` | event contract with payload schema so consumers can be validated | `emits: [{name, payload: {field: type}, scope: school\|platform, async: bool}]`, `consumes: [{name, handler, order}]` | `register_plugin_events`, `listeners.py` autoload, docs generator, contract test |
| `widgets.yaml` | index of widget keys + defaults; per-widget detail may live in `ui/widgets/*.yaml` | §2.2 | `GET /plugins/widgets`, `PluginWidgetHost`, dashboard composer |
| `mobile.yaml` | Flutter surfaces | §2.6 | `GET /mobile/bootstrap` merge |
| `routes.py` | Flask blueprint; every route `@plugin_required("<slug>")` | must expose `bp` or `<slug>_bp` | `loader._register_manifest_blueprints` (`loader.py:234-260`) |
| `models.py` | tables the plugin owns (one owner per table — enforced by validator) | SQLAlchemy models on `BaseModel`/`SchoolModel` | `hooks.activate` `create(checkfirst=True)`, alembic autogenerate |
| `hooks.py` | lifecycle. `activate(db)`, `deactivate(db)`, `uninstall(db)`, **new** `upgrade(db, from_version)` | module-level functions, never raise | `_run_plugin_hook` (`api/v1/plugins.py:83-101`) |
| `listeners.py` | consumers, imported once at startup when the module declares `consumes` | `@on("event")` functions | new `PluginLoader.load_listeners()` |
| `services/`, `tasks/` | domain logic and Celery jobs | packages | manifest `capabilities.services/tasks` + beat schedule |
| `migrations/` | plugin-owned alembic revisions | `versions/*.py` with `depends_on` set to the platform head at authoring time | `alembic -x plugins=all upgrade head` (§1.5) |
| `seeds/` | idempotent seeding invoked by `activate` | `seed(db, school_id)` in `seeds/__init__.py` | `hooks.activate` |
| `templates/` | TemplatePacks | `pack.yaml` + layout (§5.2) | `TemplateRegistry.scan()` |
| `themes/` | theme token contributions | `{theme_key, extends, tokens{}, applies_to[]}` (§4.1) | `ThemeRegistry.scan()` |
| `i18n/*.json` | flat dotted keys | `{"widget.today_attendance.title": "Today's attendance"}` | web `t()`, Flutter `S.of`, backend `gettext`-lite |
| `ui/widgets/*.yaml` | one file per widget when the declaration is long | §2.2 | same as `widgets.yaml` |
| `ui/index.web.json` | maps widget keys to **registry tokens** (not import paths) for code-backed widgets | `{"attendance_today": "attendance/TodayCard"}` | `frontend/lib/plugin-widgets/registry.generated.ts` check |
| `tests/` | plugin's own pytest package | `tests/test_<slug>_*.py` | `pytest backend/app/plugins/modules` |
| `README.md` | human contract | markdown | contributors, marketplace long description |

## 1.3 `manifest.yaml` v2 — full annotated reference

```yaml
# ── contract version ──────────────────────────────────────────────────────
schema_version: 2                  # REQUIRED for v2. Absent/1 → compat adapter (§1.4)

# ── identity ──────────────────────────────────────────────────────────────
slug: attendance                   # immutable primary key; must equal folder name
name: "Attendance Management"
name_nepali: "उपस्थिति व्यवस्थापन"
version: 2.0.0                     # semver; drives hooks.upgrade(from_version)
author: "ASchool Core"
homepage: "https://docs.aschool.np/plugins/attendance"
description: "Daily student & teacher attendance, bulk marking, QR check-in, reports"
description_nepali: "दैनिक उपस्थिति, सामूहिक अंकन, QR चेक-इन, रिपोर्ट"
emoji: "✅"
icon: "UserCheck"                  # must exist in frontend sidebar ICON_MAP
tags: [academics, daily, compliance]
docs: docs/README.md               # relative; served in marketplace detail

# ── catalog / commerce (mirrors the `plugins` table; loader.refresh_registry) ──
category: core                     # core|starter|growth|premium|add_on (Plugin.category enum)
price_monthly: 0
price_yearly: 0
is_free: true
trial_days: null                   # null = platform PLUGIN_TRIAL_DAYS wins (billing.py:35-47)
published: true
coming_soon: false
deprecated: false
supersedes: []                     # slugs whose sidebar entry this one replaces
                                   # (replaces loader.SIDEBAR_SUPERSEDED_BY, loader.py:519-521)
aliases: [attendance_basic]        # legacy slugs accepted for this plugin
                                   # (replaces the hand-kept PLUGIN_SLUG_ALIASES in
                                   #  decorators.py:13-53 AND frontend/lib/plugins.tsx:55-80)

# ── dependencies ──────────────────────────────────────────────────────────
depends_on: []                     # hard: install refused without these
soft_depends_on: [notices]         # optional: extra widgets/features light up if present
conflicts_with: []
min_platform_version: "1.8.0"

# ── code pointers (validated on load; hard-fail in CI — loader.py:104-134) ──
capabilities:
  api_blueprint: app.plugins.modules.attendance.routes   # or legacy app.api.v1.attendance
  models_module: app.plugins.modules.attendance.models
  services:
    - app.plugins.modules.attendance.services.marking
  tasks:
    - app.plugins.modules.attendance.tasks.absent_alerts
  beat_schedule:                   # celery beat entries owned by the plugin
    - task: app.plugins.modules.attendance.tasks.absent_alerts.run
      cron: "0 10 * * 0-4"         # NPT; only fires for schools with the plugin active
  socket_namespaces: []            # socket.io namespaces the plugin opens
  public_routes: false             # true when it serves unauthenticated (public-site) data

# ── permissions (detail in permissions.yaml) ──────────────────────────────
permissions_ref: permissions.yaml
roles_visible_to: [school_admin, teacher]     # coarse role gate for nav/widgets

# ── events (detail in events.yaml) ────────────────────────────────────────
events_ref: events.yaml
events:                            # summary kept inline for cheap introspection
  emits: [attendance.marked, attendance.student_absent]
  consumes: [biometric.punch_recorded]

# ── settings ──────────────────────────────────────────────────────────────
config_schema: config_schema.yaml  # path (true/absent also accepted — loader.py:169-184)
config_version: 3                  # bumped when a stored-config migration is needed (§3.6)

# ── UI: navigation (was `frontend:`; old key still read by the adapter) ────
ui:
  nav:
    route: /dashboard/attendance
    section: Academics             # matches sidebar PLUGIN_SECTION_ORDER
    label: Attendance
    label_nepali: उपस्थिति
    icon: UserCheck
    order: 50
    visible_to: [school_admin, teacher]
    requires_permissions: [attendance.view]
    subitems:
      - { label: "Mark / View", label_nepali: "अंकन", route: /dashboard/attendance, requires_permissions: [attendance.mark] }
      - { label: "Monthly Report", route: /dashboard/attendance/reports }
      - { label: "Holiday List", route: /dashboard/attendance/holidays }
  widgets_ref: widgets.yaml
  settings_sections: [alerts, marking]        # config_schema groups shown as own tabs

# ── mobile (detail in mobile.yaml) ────────────────────────────────────────
mobile_ref: mobile.yaml
mobile:
  admin:   { module: attendance, tabs: [Overview, Reports] }
  teacher: { module: attendance, tabs: [Mark, "My Classes", History] }
  parent:  { module: attendance, tabs: ["Child Attendance", History] }
  student: { module: attendance, tabs: ["My Attendance"] }

# ── content contributions ─────────────────────────────────────────────────
template_packs:
  - key: attendance_ledger
    path: templates/attendance_ledger
    kind: document                 # document|website_section|notification|report|calendar|question_paper
  - key: absent_sms
    path: templates/absent_sms
    kind: notification
theme_contributions:
  - key: attendance_status_colors
    path: themes/attendance_status_colors.yaml
    applies_to: [web_dashboard, mobile]        # never public_site unless declared

# ── data ownership (validator: exactly one owner per table) ────────────────
owns_tables: [attendance, attendance_summary, holidays]
reads_tables: [students, classes, users]

# ── operations ────────────────────────────────────────────────────────────
health_check: app.plugins.modules.attendance.services.health:check
                                   # () -> {"ok": bool, "detail": str, "checks": {...}}
                                   # surfaced at GET /plugins/<slug>/health (superadmin)
migrations: migrations             # folder; null when the plugin owns no tables
uninstall_policy: keep_data        # keep_data|purge_config|purge_all (default keep_data)
i18n: i18n                         # folder with en.json / ne.json
```

Fields removed vs v1: none. Fields *renamed* (with the old key still honoured by the adapter): `frontend:` → `ui.nav`, `flutter:` → `mobile`, top-level `api_blueprint/models_module/services/tasks` → `capabilities.*`.

## 1.4 Migration path — 47 metadata-only shells → v2, without a rewrite

The unlock is that **v2 is a superset**, so a v1 manifest is a valid v2 manifest once normalized. Three mechanisms:

**(a) Compat adapter in the loader** — one function, ~60 lines, applied to every scanned manifest:

```python
# backend/app/plugins/loader.py  (new)
def _normalize_manifest(m: dict, module_dir: Path | None) -> dict:
    """v1 manifest -> v2 in-memory shape. Never mutates files."""
    if int(m.get("schema_version") or 1) >= 2:
        return _fill_v2_defaults(m, module_dir)
    caps = m.setdefault("capabilities", {})
    for old, new in (("api_blueprint", "api_blueprint"), ("models_module", "models_module"),
                     ("services", "services"), ("tasks", "tasks")):
        if m.get(old) is not None:
            caps.setdefault(new, m[old])
    fe = m.get("frontend") or {}
    sb = fe.get("sidebar") or {}
    m.setdefault("ui", {})["nav"] = {
        "route": fe.get("route"), "section": sb.get("section"),
        "label": sb.get("label") or m.get("name"), "label_nepali": sb.get("label_nepali"),
        "icon": sb.get("icon") or m.get("icon"), "visible_to": sb.get("visible_to") or [],
        "subitems": sb.get("subitems") or [],
    }
    fl = m.get("flutter") or {}
    m["mobile"] = {role.replace("_app", ""): cfg for role, cfg in fl.items() if cfg}
    m["schema_version"] = 1           # remembered: reported as v1 in /plugins/registry
    return _fill_v2_defaults(m, module_dir)
```

`get_frontend_sidebar` / `get_bottom_nav_items` (`loader.py:524-684`) then read **only** `ui.nav`, so both manifest generations flow through one code path. `PLUGIN_SLUG_ALIASES` (`decorators.py:13-53`) becomes the *fallback* for manifests without `aliases:`; the loader builds the effective alias map as `manifest aliases ∪ hardcoded table`, and `_acceptable_plugin_slugs` reads that (still single-hop, so the "no transitive unlock" property in `decorators.py:56-78` is preserved verbatim).

**(b) Validator (`backend/app/plugins/validator.py` + `tests/test_plugin_contract.py`)** — runs over all 47 manifests. Two severities:

| Check | v1 manifests | v2 manifests |
|---|---|---|
| `manifest.yaml` parses, has `slug`, folder name == slug | error | error |
| `__init__.py` exists (real Python package) | error | error |
| `category` in `Plugin.category` enum (`models/plugin.py:35-38`) | error | error |
| `depends_on` / `conflicts_with` / `supersedes` / `aliases` resolve to known slugs | error | error |
| Every code pointer resolves on disk (`loader._module_path_exists`, `loader.py:85-101`) | **warn** (≈20 known-broken, dup audit §4 #4) | **error** |
| `icon` present in the sidebar `ICON_MAP` (`frontend/components/layout/sidebar.tsx:81-160`) | warn | error |
| Referenced files exist (`config_schema`, `widgets_ref`, `mobile_ref`, `events_ref`, `permissions_ref`, template/theme paths) | error when declared | error |
| `owns_tables` claimed by exactly one plugin | warn | error |
| `config_schema.yaml` validates against the dialect (§3) | error | error |
| Each `widgets.yaml` entry has a resolvable renderer (registry token or `spec:`) | n/a | error |
| Route prefix collision between plugin blueprints | error | error |
| Every `@plugin_required` slug in the plugin's own routes == its slug or an alias | warn | error |

CI wiring: `pytest backend/tests/test_plugin_contract.py` fails the build on any error; warnings print a table. This is the missing coverage — `test_plugin_manifests.py:9` only scans the legacy dir.

**(c) Per-plugin adoption order** — 6 waves, each independently shippable. "Move code" means relocate `app/api/v1/<x>.py` into the module folder and leave a 2-line re-export shim, exactly the pattern already proven for the seven module-resident plugins (`api/v1/__init__.py:39-49`).

| Wave | Plugins | Why first | Moves code? |
|---|---|---|---|
| 0 | *validator + adapter only* | zero plugin edits; makes the rest safe | no |
| 1 | `white_label`, `biometric`, `multi_branch`, `incident_management`, `disaster_management`, `ai_adaptive_learning` | already have `routes.py`+`hooks.py` in-folder; only manifest promotion + `widgets.yaml` | no |
| 2 | `attendance`, `fees`, `library_management`, `website_builder`, `whatsapp_bot` | already ship `config_schema.yaml` → become the config-v2 + widget reference implementations | no (pointers stay `app.api.v1.*`) |
| 3 | `notices`, `exams`, `assignments`, `timetable`, `academics` | highest-traffic dashboards; biggest widget payoff | optional |
| 4 | `design_studio`, `basic_website` | own the TemplatePack + section-registry migration (§5) | templates only |
| 5 | remaining ~25 (`alumni`, `inventory`, `hr_payroll`, `gamification`, …) | mechanical; scriptable | no |
| 6 | legacy flat manifests (`dashboard`, `students`, `teachers`, `users`, `hostel`, `marketplace_nav`, `plugins_nav`, `settings_core`) → `modules/` | retires the legacy dir (dup audit §4 #14) | no |

Backwards-compat guarantees held throughout: existing endpoint shapes unchanged; `SchoolPlugin.config` never rewritten except by an explicit versioned migration (§3.6); a v1 manifest never becomes uninstallable; a plugin with no `widgets.yaml` renders exactly as today.

## 1.5 Migrations, ownership and hooks

Today `hooks.activate` does `model.__table__.create(db.engine, checkfirst=True)` (`modules/biometric/hooks.py:24-28`) while schema evolution happens in the global alembic tree (`backend/migrations/versions/**`). v2 keeps both but assigns responsibility:

- **Global alembic stays the schema authority.** Plugin `migrations/versions/*.py` are ordinary revisions that live in the plugin folder and are picked up by adding the folder to `version_locations` in `backend/migrations/alembic.ini`. Each sets `depends_on = ("<platform head at authoring time>",)` so ordering is explicit and a plugin can be removed without orphaning the chain.
- **`hooks.activate` remains create-if-missing + seed** so a fresh install works on a DB that has not yet run the plugin's revision (the current fail-soft contract, `api/v1/plugins.py:88-101`, is unchanged: hook failures are logged, never fatal).
- **`hooks.upgrade(db, from_version)`** is new: called by `refresh_registry` when the manifest `version` is greater than the version recorded on the install row (new `SchoolPlugin.installed_version` column). This is how a plugin backfills its own data after an update.
- `owns_tables` + the one-owner rule is what finally makes "who may drop this table" answerable — the dup audit's duplicate-health-model finding (§ Cluster G) is a direct consequence of nobody owning `student_health_records`.

## 1.6 New/changed platform endpoints (all additive)

| Method + path | Purpose |
|---|---|
| `GET /plugins/registry` | full normalized manifests (superadmin) incl. `schema_version`, validator status |
| `GET /plugins/<slug>/health` | runs `health_check` (superadmin) |
| `GET /plugins/widgets?surface=dashboard&role=teacher` | all widget specs the caller may render (§2.3) |
| `GET /plugins/<slug>/config-schema` | **unchanged path**, now returns the v2 dialect + `schema_version` |
| `PUT /plugins/<slug>/config` | **unchanged path**, now schema-validated, secrets write-only (§3.5) |
| `GET /plugins/aliases` | serves the alias + display-label map so `frontend/lib/plugins.tsx` stops hand-copying it (dup audit §4 #2) |
| `GET /dashboards/layout?role=` / `PUT /dashboards/layout` | saved dashboard compositions (§2.7) |
| `GET /themes/tokens?scope=` | resolved theme document per school/surface (§4.2) |
| `GET /templates/packs?kind=` | unified template catalog (§5.3) |

---

# 2. WIDGET CONTRACT

Today a plugin can contribute exactly one thing to the UI: a sidebar entry (`loader.get_frontend_sidebar`). Every screen is a hand-written page under `frontend/app/dashboard/**` that the manifest merely links to. The widget contract makes a plugin able to *place* UI into host-owned slots.

## 2.1 Principles

1. **Declare, don't inject.** A widget is data (`widgets.yaml`) + a renderer identified by a token. Plugins never ship executable frontend code that the host `eval`s.
2. **Two renderer kinds.** `spec` widgets are pure JSON rendered by generic host components (no frontend deploy needed to add one). `component` widgets name a token in a compile-time registry (needed for canvas/map/editor-grade UI).
3. **Slots are host property.** A plugin asks to appear in `dashboard.main`; the host decides order, size and whether the school/role allows it.
4. **Same declaration, three consumers.** Next.js, the four Flutter apps, and the public website all read the same widget records; each renders the subset it understands (`surfaces:`).
5. **Gating is server-side.** `GET /plugins/widgets` returns only widgets whose plugin is installed+active for the school and whose permissions the caller holds. A hidden widget is *absent*, not `display:none`.

## 2.2 `widgets.yaml` — full schema

```yaml
schema_version: 1
widgets:
  - key: today_attendance            # unique within the plugin; global id = "<slug>.<key>"
    title: "Today's Attendance"
    title_i18n: widget.today_attendance.title      # i18n/en.json + ne.json
    description: "Present / absent / late counts for today"
    type: stat-group                 # see the type table below
    renderer: spec                   # spec | component
    surfaces: [web, mobile]          # web | mobile | public_site | pdf
    slots:                           # where it MAY be placed
      - id: dashboard.main
        default: true                # auto-placed on a fresh dashboard
        order: 10
      - id: student_profile.tab
        params_from: { student_id: "$route.student_id" }
    roles: [school_admin, teacher]
    requires_permissions: [attendance.view]
    requires_plugins: []             # extra soft-deps; widget hidden if absent
    size:                            # grid units in a 12-col dashboard grid
      default: { w: 6, h: 2 }
      min: { w: 3, h: 2 }
      breakpoints: { sm: { w: 12, h: 2 }, md: { w: 6, h: 2 }, xl: { w: 4, h: 2 } }
    data:
      source: api                    # api | socket | static | aggregate
      endpoint: /attendance/summary   # relative to /api/v1; MUST be a GET route of this plugin
      params: { date: "$today", class_id: "$context.class_id" }
      refresh:
        mode: poll                   # none | poll | socket | on_focus
        interval_s: 300
        socket_event: attendance.marked          # when mode: socket
      cache_ttl_s: 60
      select: data                   # dot-path into the ApiResponse envelope
    spec:                            # renderer: spec → declarative body (§2.5)
      items:
        - { label: Present, value: "$.present", tone: success, icon: UserCheck }
        - { label: Absent,  value: "$.absent",  tone: danger,  icon: UserX }
        - { label: Late,    value: "$.late",    tone: warning, icon: Clock }
        - { label: "%",     value: "$.percentage", format: percent, tone: primary }
      link: { label: "Open attendance", href: /dashboard/attendance }
    config_schema:                   # per-school widget customization (§3 dialect subset)
      fields:
        - { key: show_late, type: boolean, label: "Show late count", default: true }
        - { key: scope, type: enum, label: Scope, options: [{value: school, label: School}, {value: my_classes, label: "My classes"}], default: my_classes }
    states:
      empty:   { title: "No attendance yet", body: "Mark today's attendance to see counts.", action: { label: "Mark now", href: /dashboard/attendance } }
      error:   { title: "Couldn't load attendance", retry: true }
      loading: skeleton                       # skeleton | spinner | none
      locked:  { title: "Attendance not installed", cta: marketplace }
    telemetry: { impression: true, click: true }

  - key: attendance_register
    title: "Attendance Register"
    type: table-panel
    renderer: spec
    surfaces: [web]
    slots: [{ id: plugin_page.main, default: true, order: 10 }]
    requires_permissions: [attendance.view]
    data:
      source: api
      endpoint: /attendance/list
      pagination: { mode: server, page_param: page, size_param: per_page, default_size: 25 }
      sort: { mode: server, param: sort, default: "-date" }
      filters:
        - { key: class_id, type: entity-picker, entity: class, label: Class }
        - { key: date_range, type: date-range, label: Date, calendar: bs }
    spec:
      columns:
        - { key: student_name, label: Student, sortable: true, width: 220, link: "/dashboard/students/$.student_id" }
        - { key: date, label: Date, format: bs_date, sortable: true }
        - { key: status, label: Status, format: status_pill, map: { present: success, absent: danger, late: warning, leave: muted } }
        - { key: marked_by, label: "Marked by" }
      row_actions:
        - { key: edit, label: Edit, icon: Pencil, requires_permissions: [attendance.mark], action: { kind: form, widget: attendance.mark_form } }
      bulk_actions:
        - { key: notify, label: "Notify guardians", action: { kind: post, endpoint: /attendance/notify, confirm: true } }
      export: { csv: true, print: true }

  - key: attendance_heatmap
    title: "Attendance Heatmap"
    type: chart
    renderer: component               # needs a real component
    component: attendance/Heatmap      # token in ui/index.web.json → host registry
    surfaces: [web]
    slots: [{ id: student_profile.tab, default: true }, { id: dashboard.main }]
    data: { source: api, endpoint: /attendance/student/$context.student_id/summary }

  - key: mobile_attendance_card
    title: "Attendance"
    type: mobile-card
    renderer: spec
    surfaces: [mobile]
    slots: [{ id: mobile.home, default: true, order: 20 }]
    roles: [parent, student]
    data: { source: api, endpoint: /parent-app/attendance/summary }
    spec:
      layout: stat_row
      items:
        - { label: "This month", value: "$.percentage", format: percent }
        - { label: Absences, value: "$.absent_days" }
      tap: { route: /attendance }

  - key: website_attendance_notice
    title: "Attendance Notice"
    type: website-section
    renderer: spec
    surfaces: [public_site]
    section_type: attendance_notice    # registers a SectionRenderer type (§5.5)
    slots: [{ id: website.section }]
    data: { source: api, endpoint: /website/public/$school_slug/attendance-highlights, public: true }
```

**Widget types → renderer mapping**

| `type` | Generic renderer (spec mode) | Typical slots |
|---|---|---|
| `dashboard-card` / `stat-group` | `StatCard` / `StatGroup` | `dashboard.main`, `mobile.home` |
| `table-panel` | `DataTable` | `plugin_page.main`, `dashboard.wide` |
| `chart` | `ChartKit` (line/bar/pie/donut/heat) | `dashboard.main`, `plugin_page.main` |
| `list` | `ListView` | `dashboard.side`, `student_profile.tab` |
| `form` | `FormRenderer` | `dialog`, `drawer`, `plugin_page.main` |
| `detail-drawer` | `DetailPanel` (label/value + sections) | `drawer` |
| `settings-section` | `FormRenderer` over `config_schema` | `plugin_settings.section` |
| `quick-action` | `QuickActionTile` | `dashboard.actions`, `mobile.quick_actions` |
| `mobile-card` | Flutter `SpecCard` (§2.6) | `mobile.home`, `mobile.more` |
| `website-section` | `SectionRenderer` (§5.5) | `website.section` |

**Slot catalogue (host-owned).** `dashboard.main`, `dashboard.side`, `dashboard.wide`, `dashboard.actions`, `plugin_page.main`, `plugin_page.header`, `student_profile.tab`, `teacher_profile.tab`, `class_detail.tab`, `settings.section`, `plugin_settings.section`, `drawer`, `dialog`, `mobile.home`, `mobile.quick_actions`, `mobile.more`, `mobile.<module>.tab`, `website.section`, `pdf.block`. Adding a slot is a host change (deliberately) — plugins cannot invent render points.

**Data-source binding tokens.** `$today`, `$now`, `$school_id`, `$school_slug`, `$user_id`, `$role`, `$context.<key>` (host-provided, e.g. the profile page's `student_id`), `$route.<param>`, `$config.<key>` (this widget's per-school config), `$.field` (dot-path into the fetched payload, including `$.a.b[0].c`). Endpoints are validated against the plugin's own blueprint prefix at load time, so a widget cannot point at another plugin's API.

## 2.3 `GET /plugins/widgets` — the host payload

```jsonc
// GET /api/v1/plugins/widgets?surface=web&slot=dashboard.main
{ "success": true, "data": {
  "widgets": [
    { "id": "attendance.today_attendance", "plugin_slug": "attendance", "type": "stat-group",
      "renderer": "spec", "title": "Today's Attendance", "size": {...}, "data": {...},
      "spec": {...}, "states": {...}, "config": { "show_late": true, "scope": "my_classes" } }
  ],
  "layout": { "role": "teacher", "slots": { "dashboard.main": ["attendance.today_attendance", "fees.collections_today"] } },
  "registry_version": "2026-09-04T10:00:00Z"       // ETag/cache key
}}
```

Server-side filtering, in order: plugin installed+active for `g.school_id` (reuses `g.installed_plugins`, alias-aware) → `roles` ∩ caller role → `requires_permissions` ⊆ caller permissions → `surfaces` contains the requested surface → `requires_plugins` satisfied. Per-school widget config is merged from `SchoolPlugin.config["widgets"][<key>]`. Response is cacheable per (school, role, surface) with the same 300 s TTL already used for `school:{id}:plugins` (`backend/app/__init__.py`).

## 2.4 Host loading strategy — analysis and recommendation

| Option | How it works | Pros | Cons |
|---|---|---|---|
| **(a) Compile-time registry** | `frontend/lib/plugin-widgets/registry.ts` maps token → `React.lazy(() => import(...))`; keys are plugin-scoped | type-safe; tree-shaken; no runtime code loading (no CSP/XSS surface); works with SSR/ISR and the existing single Next build; debuggable | adding a *component* widget requires a frontend deploy; registry must be kept in sync with `ui/index.web.json` (validator does that) |
| **(b) Server-driven JSON specs** | backend returns a spec; generic renderers draw it | new widgets with **zero** frontend deploy — a school-visible change ships by editing YAML; one place to fix a11y/i18n/loading/empty states; naturally mirrors to Flutter and PDF; the only feasible route for the 4 mobile apps | expressiveness ceiling (no fabric canvas, no Leaflet map, no tiptap); needs a disciplined spec schema or it becomes a private templating language |
| **(c) Module federation / remote ESM** | plugins publish remote bundles loaded at runtime | true third-party extensibility without host deploys | Next 14 App Router + RSC support is poor; runtime remote JS in a multi-tenant SaaS is an XSS/supply-chain vector; version skew across React/Tailwind/query-client; SSR of remotes is painful; nobody outside this repo authors plugins today |

**Recommendation: (a) as the mechanism, (b) as the default authoring mode. Reject (c).**

Concretely: there is exactly one dynamic loader — the compile-time registry — and the generic spec renderers (`StatCard`, `DataTable`, `ChartKit`, `FormRenderer`, `ListView`, `DetailPanel`, `QuickActionTile`) are themselves entries in it. A `renderer: spec` widget resolves to the generic renderer for its `type`; a `renderer: component` widget resolves to a plugin-specific token. So ~90% of widgets are pure YAML (no deploy, and they mirror to Flutter for free), and the escape hatch for canvas/map/editor UI stays first-class and type-checked. This also matches the repo's own precedent: `frontend/lib/school-website/registry.ts` already declares website sections as data with fixed controls while `SectionRenderer` holds the components — the widget contract generalizes a pattern that already works here.

Rejecting (c) is a security call as much as an architectural one: plugins are first-party, the marketplace sells entitlements rather than third-party code, and runtime remote JS would let one tenant's misconfiguration execute in another's dashboard.

## 2.5 Implementation sketch (web)

**Registry** — `frontend/lib/plugin-widgets/registry.ts` (hand-maintained, validator-checked against every `ui/index.web.json`):

```tsx
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { WidgetSpec } from "./types";

export type WidgetProps = {
  widget: WidgetSpec;                       // full record from /plugins/widgets
  context: Record<string, unknown>;         // slot context (student_id, class_id…)
  data: unknown;                            // resolved payload (undefined while loading)
};

/** Generic, spec-driven renderers — one per widget `type`. */
export const SPEC_RENDERERS: Record<string, ComponentType<WidgetProps>> = {
  "stat-group":      require("./renderers/StatGroup").StatGroup,
  "dashboard-card":  require("./renderers/StatCard").StatCard,
  "table-panel":     require("./renderers/DataTablePanel").DataTablePanel,
  chart:             require("./renderers/ChartPanel").ChartPanel,
  list:              require("./renderers/ListPanel").ListPanel,
  form:              require("./renderers/FormPanel").FormPanel,
  "detail-drawer":   require("./renderers/DetailPanel").DetailPanel,
  "settings-section":require("./renderers/SettingsSection").SettingsSection,
  "quick-action":    require("./renderers/QuickActionTile").QuickActionTile,
};

/** Plugin-specific components, keyed "<plugin>/<Token>" — must match ui/index.web.json. */
export const COMPONENT_REGISTRY: Record<string, ComponentType<WidgetProps>> = {
  "attendance/Heatmap":      dynamic(() => import("@/components/plugin-ui/attendance/Heatmap")),
  "fees/CollectionSparkline":dynamic(() => import("@/components/plugin-ui/fees/CollectionSparkline")),
  "gps_tracking/LiveMap":    dynamic(() => import("@/components/transport/LiveBusMap"), { ssr: false }),
  "design_studio/TemplateGallery": dynamic(() => import("@/components/plugin-ui/design_studio/TemplateGallery")),
};

export function resolveRenderer(w: WidgetSpec): ComponentType<WidgetProps> | null {
  return w.renderer === "component"
    ? COMPONENT_REGISTRY[w.component ?? ""] ?? null
    : SPEC_RENDERERS[w.type] ?? null;
}
```

**Host** — `frontend/components/plugin-widgets/PluginWidgetHost.tsx`:

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { resolveRenderer } from "@/lib/plugin-widgets/registry";
import { resolveBindings, selectPath } from "@/lib/plugin-widgets/bindings";
import { WidgetFrame } from "./WidgetFrame";               // title, menu, size, error boundary
import { WidgetSkeleton } from "./WidgetSkeleton";
import type { WidgetSpec } from "@/lib/plugin-widgets/types";

export function PluginWidgetHost({ widget, context = {} }:
  { widget: WidgetSpec; context?: Record<string, unknown> }) {
  const Renderer = resolveRenderer(widget);
  const src = widget.data;
  const params = resolveBindings(src?.params, { context, config: widget.config });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plugin-widget", widget.id, params],
    enabled: !!Renderer && src?.source === "api",
    queryFn: async () => {
      const res = await api.get(resolveBindings(src!.endpoint, { context }), { params });
      return selectPath(res.data, src!.select ?? "data");
    },
    staleTime: (src?.cache_ttl_s ?? 60) * 1000,
    refetchInterval: src?.refresh?.mode === "poll" ? (src.refresh.interval_s ?? 300) * 1000 : false,
  });

  useWidgetSocket(widget, refetch);      // no-op unless refresh.mode === "socket"

  if (!Renderer) return null;                       // unknown token: render nothing, log once
  if (isLoading) return <WidgetSkeleton widget={widget} />;
  if (error)     return <WidgetFrame widget={widget}><WidgetError states={widget.states} onRetry={refetch} /></WidgetFrame>;
  if (isEmpty(data, widget)) return <WidgetFrame widget={widget}><WidgetEmpty states={widget.states} /></WidgetFrame>;

  return (
    <WidgetFrame widget={widget}>
      <Renderer widget={widget} context={context} data={data} />
    </WidgetFrame>
  );
}

/** Renders every widget the server placed in a slot. */
export function WidgetSlot({ id, context }: { id: string; context?: Record<string, unknown> }) {
  const { widgets, layout } = usePluginWidgets("web");           // one cached fetch per session
  const ids = layout.slots[id] ?? [];
  return <>{ids.map((wid) => {
    const w = widgets[wid];
    return w ? <PluginWidgetHost key={wid} widget={w} context={context} /> : null;
  })}</>;
}
```

`WidgetFrame` owns the React error boundary, the title/i18n, the per-widget overflow menu (configure / hide / refresh) and the grid sizing — so a broken plugin widget degrades to a card with an error, never a blank dashboard.

**How a spec becomes pixels** — `StatGroup` (representative of all spec renderers):

```tsx
export function StatGroup({ widget, data }: WidgetProps) {
  const items = (widget.spec?.items ?? []).filter((i) => visible(i, widget.config));
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0,1fr))` }}>
      {items.map((item) => (
        <StatCard key={item.label}
          label={t(item.label_i18n) ?? item.label}
          value={formatValue(selectPath(data, item.value), item.format)}   // percent | npr | int | bs_date
          tone={item.tone} icon={item.icon} />
      ))}
      {widget.spec?.link && <WidgetLink {...widget.spec.link} />}
    </div>
  );
}
```

`DataTablePanel` maps `spec.columns` onto the shared `DataTable` the widget audit already puts at the top of its Tier-1 backlog — `columns[].format` selects a cell renderer (`status_pill`, `bs_date`, `npr`, `link`, `avatar`), `data.pagination`/`sort`/`filters` drive server-side paging, and `bulk_actions`/`row_actions` become the bulk bar and row menu. `ChartPanel` maps `spec.chart` onto recharts wrappers reading theme tokens (§4). `FormPanel` reuses the §3 `FormRenderer` verbatim — a widget-scoped form and a plugin settings screen are the same code. Building `DataTable`/`ChartKit`/`StatCard`/`FormRenderer` is not extra cost: those components are already the highest-priority items in `ASCHOOL_WEB_WIDGET_AUDIT.md` §5; the widget contract just gives them a declarative front door.

## 2.6 Flutter side

Mobile already consumes a server-driven navigation document: `_visibility_for_role` (`backend/app/api/v1/mobile.py:159-468`) returns `modules`, `quick_actions`, `more_actions`, `drawer_sections`, `bottom_tabs`, and `PluginState.canAccess` (`aschool_shared/lib/services/plugin_provider.dart:38-41`) gates screens. v2 extends the same document rather than inventing a second channel — that is why the recommended web approach is server-driven-by-default: one YAML feeds both.

`mobile.yaml`:

```yaml
schema_version: 1
modules:
  - key: attendance
    label: Attendance
    label_ne: उपस्थिति
    icon: check_circle                 # Material icon name (registry-checked)
    roles: [admin, teacher, parent, student]
    route: /attendance
    screen: registry                   # registry | spec
    screen_token: attendance/AttendanceScreen     # native screen in the app
    tabs:
      admin:   [Overview, Reports]
      teacher: [Mark, "My Classes", History]
      parent:  ["Child Attendance", History]
    surfaces:
      bottom_tab: { roles: [teacher], order: 20 }
      quick_action: { roles: [parent, student], order: 10 }
      drawer_section: academics
cards:                                  # spec-rendered home cards (no app release needed)
  - widget: attendance.mobile_attendance_card       # points at widgets.yaml
    roles: [parent, student]
    slot: mobile.home
    order: 20
```

`GET /mobile/bootstrap` gains a `widgets: [...]` array (same records as the web endpoint, filtered to `surfaces: [mobile]`) plus `modules`/`surfaces` merged from every installed plugin's `mobile.yaml`, replacing the hardcoded per-role rule lists in `mobile.py`. Client side, in `aschool_shared`:

- `PluginState` gains `widgets` (parsed + cached in secure storage alongside the existing plugin cache, so offline start still renders).
- **`SpecWidget`** — the Flutter twin of `PluginWidgetHost`: fetch → bind → render via a `Map<String, SpecRenderer>` (`stat_row`, `list`, `table`, `chart`, `kpi`, `progress`), reusing existing shared widgets (`stat_card.dart`, `paginated_list.dart`, `no_data_container.dart`, `error_container.dart`, `loading_shimmer.dart`, `shimmer_loading_list.dart`).
- **`MOBILE_SCREEN_REGISTRY`** — `Map<String, WidgetBuilder>` per app for `screen: registry` modules; the compile-time analogue of the web registry. Unknown tokens fall back to `module_screen_template.dart`, so an app binary older than the manifest degrades gracefully instead of crashing.
- Nav is generated from the bootstrap document: `dynamic_bottom_nav.dart` and `app_drawer.dart` already consume plugin state, so they only need to read the new `surfaces` block.

Net effect: a new mobile *card* ships by editing YAML; a new mobile *screen* requires an app release, which is unavoidable and now explicit.

## 2.7 Dashboard composition

**Storage** — new table `dashboard_layouts`:

| column | type | notes |
|---|---|---|
| `id` | uuid | |
| `school_id` | uuid FK nullable | NULL = platform default layout |
| `role` | varchar(50) | `school_admin`/`teacher`/`parent`/`student`/`accountant` |
| `user_id` | uuid FK nullable | non-NULL = personal override |
| `surface` | varchar(50) | `web_dashboard`, `mobile_home` |
| `slots` | JSONB | `{"dashboard.main": [{"id":"attendance.today_attendance","w":6,"h":2,"x":0,"y":0}], ...}` |
| `is_default` | bool | |
| unique | (`school_id`,`role`,`user_id`,`surface`) | |

**Resolution order** (first hit wins per slot, then merge): user override → school+role layout → platform+role default → widget declarations' `slots[].default` + `order`. So a school that never touches the dashboard sees a sane auto-composed layout, and installing a plugin makes its `default: true` widgets appear at the end of the target slot without editing any layout row.

**Editing** — `/dashboard` gains an "Edit layout" mode: dnd-kit drag/resize within a 12-column grid, add-widget palette listing available-but-unplaced widgets (grouped by plugin), per-widget config popover rendered by `FormRenderer` from `widgets.yaml → config_schema`, and Reset-to-default. `PUT /dashboards/layout` persists; `role`-scoped saves require `dashboard.manage_layout` permission, personal saves need none.

**Uninstall behaviour** — layouts keep unknown widget ids (the plugin may come back); `WidgetSlot` skips ids missing from the payload. This mirrors the platform's soft-uninstall convention (`uninstall_plugin` preserves data).

---

# 3. SETTINGS / CONFIG v2

## 3.1 Where v1 stops

`config_schema.yaml` today is a flat `fields: [{key, label, type, default, help, min}]` list with four types (`string`, `number`, `boolean`, `json` — see `modules/whatsapp_bot/config_schema.yaml:6-41`). The loader just returns the list (`loader.py:293-313`); the API does **no** schema validation on write — `PUT /plugins/<slug>/config` only checks "is a JSON object", ≤16 KB, and the reserved `last_payment` key (`api/v1/plugins.py:829-885`). The form maps values to text/number/switch/JSON-textarea (`frontend/app/dashboard/plugins/[slug]/settings/page.tsx:47-100`). Consequences: no enums, no groups, no conditional fields, no secret handling (an API key would be echoed by `GET /config`), no server-side type enforcement, and defaults duplicated between YAML and consumer code (`library_management/config_schema.yaml:1-6` documents that duplication as a maintenance rule).

## 3.2 Dialect v2

```yaml
schema_version: 2
config_version: 3               # bump to trigger a stored-config migration (§3.6)
title: "Attendance settings"
description: "Who gets alerted, and how marking behaves."

groups:                         # ordered; render as tabs (>2) or fieldsets
  - key: alerts
    label: "Alerts"
    label_ne: "सूचनाहरू"
    description: "Absence notifications to guardians"
    icon: Bell
    collapsed: false
    roles: [school_admin]       # group hidden entirely for other roles
  - key: marking
    label: "Marking"
  - key: integrations
    label: "Integrations"
    roles: [school_admin]

fields:
  - key: alerts.enabled                 # dot path into SchoolPlugin.config
    group: alerts
    type: boolean
    label: "Daily absent alerts"
    label_ne: "दैनिक अनुपस्थिति सूचना"
    help: "Notify guardians when a student is marked absent."
    default: true

  - key: alerts.channels
    group: alerts
    type: multi-enum
    label: "Channels"
    options:
      - { value: sms,      label: SMS,      requires_plugins: [sms_notifications] }
      - { value: whatsapp, label: WhatsApp, requires_plugins: [whatsapp_bot] }
      - { value: push,     label: "Push notification" }
    default: [push]
    visible_when: { field: alerts.enabled, eq: true }
    validate: { min_items: 1 }

  - key: alerts.send_at
    group: alerts
    type: cron
    label: "Send at"
    default: "0 10 * * 0-4"
    help: "Nepal time. Default: 10:00, Sunday-Thursday."
    visible_when: { field: alerts.enabled, eq: true }

  - key: alerts.template_pack
    group: alerts
    type: entity-picker
    entity: template_pack                 # resolved server-side (§5)
    entity_filter: { kind: notification, tags: [attendance] }
    label: "Message template"
    default: "absent_sms"

  - key: marking.default_status
    group: marking
    type: enum
    label: "Default status on a new sheet"
    options:
      - { value: present, label: Present, label_ne: "उपस्थित" }
      - { value: unmarked, label: "Unmarked", help: "Forces an explicit choice per student" }
    default: unmarked

  - key: marking.lock_after_hours
    group: marking
    type: int
    label: "Lock editing after (hours)"
    default: 48
    validate: { min: 0, max: 720 }
    unit: hours

  - key: marking.status_colors
    group: marking
    type: color-map                       # {status: color}; feeds theme tokens (§4.1)
    label: "Status colours"
    keys: [present, absent, late, leave]
    default: { present: "#16a34a", absent: "#dc2626", late: "#f59e0b", leave: "#64748b" }

  - key: integrations.device_api_key
    group: integrations
    type: secret                          # never returned by GET (§3.5)
    label: "Device API key"
    help: "Used by the on-premise attendance device."
    write_only: true
    validate: { min_length: 16, max_length: 128 }
    roles: [school_admin]

  - key: integrations.holiday_calendar
    group: integrations
    type: file
    label: "Holiday calendar (CSV)"
    accept: [".csv"]
    max_size_mb: 2
    storage: plugin_files                 # stored via the files service; config holds the id+url

  - key: integrations.webhook_headers
    group: integrations
    type: json
    label: "Extra webhook headers"
    default: {}
    advanced: true                        # hidden behind "Show advanced"
```

**Field types**

| type | Stored as | Control | Server validation |
|---|---|---|---|
| `string` | str | Input (`multiline: true` → Textarea) | length, `pattern` regex, `format` (email/phone/url/slug) |
| `text` | str | Textarea | length |
| `int` / `number` | int / float | number Input + `unit` suffix | min/max, `step` |
| `boolean` | bool | Switch | strict bool |
| `enum` | str | Select (>8 options → searchable) | value ∈ options, `requires_plugins` honoured |
| `multi-enum` | list[str] | checkbox group / TagPicker | subset of options, min/max items |
| `color` | str | color picker + hex input | hex/color-word allowlist (reuses `_is_safe_color`, `theme_engine.py:17-25`) |
| `color-map` | dict[str,str] | per-key colour row | keys ⊆ `keys`, each value colour-validated |
| `file` | `{id, url, name, size}` | FilePicker/dropzone | mime ∈ `accept`, size ≤ `max_size_mb`, tenant-scoped id |
| `secret` | encrypted str (§3.5) | password Input with "Replace" affordance | length/pattern; never echoed |
| `cron` | str | cron builder + raw field, with human preview | 5-field cron parse |
| `time` / `date` / `bs_date` | "HH:MM" / ISO / BS str | time input / `BSDateInput` | format parse |
| `json` | any | JSON textarea with parse feedback | valid JSON, optional `json_schema` |
| `entity-picker` | id str (or list when `multiple`) | searchable async Select | id exists **and is tenant-scoped** |
| `list` | list[dict] | repeatable subform (`item_fields`) | per-item recursion, min/max items |
| `markdown` | str | small rich editor | length; sanitized on read for display |

**Field attributes**: `key` (dot path), `group`, `type`, `label`, `label_ne`, `help`, `help_ne`, `placeholder`, `default`, `unit`, `validate{}`, `visible_when{}`, `enabled_when{}`, `roles[]`, `requires_plugins[]`, `advanced`, `readonly`, `deprecated`, `order`, `i18n_key`, plus type-specific keys (`options`, `entity`, `accept`, `keys`, `item_fields`, `multiple`, `multiline`, `pattern`, `format`).

**Conditional visibility**: `visible_when: { field: <key>, eq|ne|in|gt|lt|truthy: <value> }`, or `all_of: [...]` / `any_of: [...]` for composites. Evaluated on both sides: the client hides the control, and the validator **drops** hidden fields' values instead of validating them (so a disabled-alerts config never fails on an empty channel list).

**Per-role visibility**: `roles[]` on a field or group. `GET /config-schema` filters by caller role and `GET /config` filters returned keys, so a teacher-scoped settings view cannot even see admin-only fields. Writes to fields the caller cannot see are rejected 403.

## 3.3 Example A — simple (`modules/notices/config_schema.yaml`)

```yaml
schema_version: 2
config_version: 1
title: "Notice board settings"
fields:
  - key: auto_push
    type: boolean
    label: "Push notice to apps"
    label_ne: "एपमा सूचना पठाउने"
    help: "Send a push notification when a notice is published."
    default: true
  - key: default_audience
    type: multi-enum
    label: "Default audience"
    options:
      - { value: parent, label: Parents }
      - { value: student, label: Students }
      - { value: teacher, label: Teachers }
    default: [parent, student]
    validate: { min_items: 1 }
  - key: pin_days
    type: int
    label: "Keep pinned for (days)"
    default: 7
    unit: days
    validate: { min: 0, max: 90 }
```

## 3.4 Example B — complex (`modules/fees/config_schema.yaml`)

```yaml
schema_version: 2
config_version: 4
title: "Fee settings"
description: "Reminders, receipts, late fees and payment gateways."
groups:
  - { key: reminders, label: "Reminders", icon: Bell }
  - { key: receipts,  label: "Receipts",  icon: Receipt }
  - { key: late_fees, label: "Late fees", icon: AlertTriangle }
  - { key: gateways,  label: "Payment gateways", icon: CreditCard, roles: [school_admin] }
fields:
  # ── reminders ────────────────────────────────────────────────────────────
  - { key: reminders.enabled, group: reminders, type: boolean, label: "Fee reminders", default: true,
      help: "SMS/push reminders to guardians for overdue fees." }
  - key: reminders.overdue_days
    group: reminders
    type: int
    label: "Remind after (days overdue)"
    default: 30
    unit: days
    validate: { min: 1, max: 365 }
    visible_when: { field: reminders.enabled, eq: true }
  - key: reminders.channels
    group: reminders
    type: multi-enum
    label: Channels
    options:
      - { value: sms, label: SMS, requires_plugins: [sms_notifications] }
      - { value: whatsapp, label: WhatsApp, requires_plugins: [whatsapp_bot] }
      - { value: push, label: Push }
    default: [sms, push]
    visible_when: { field: reminders.enabled, eq: true }
    validate: { min_items: 1 }
  - key: reminders.schedule
    group: reminders
    type: cron
    label: "Reminder run time"
    default: "0 9 * * 0-4"
    visible_when: { field: reminders.enabled, eq: true }
  - key: reminders.escalations
    group: reminders
    type: list
    label: "Escalation steps"
    help: "Each step fires N days after the previous one."
    item_fields:
      - { key: after_days, type: int, label: "After (days)", validate: { min: 1, max: 180 } }
      - { key: audience, type: enum, label: Audience,
          options: [{value: guardian, label: Guardian}, {value: guardian_and_admin, label: "Guardian + admin"}] }
      - { key: template_pack, type: entity-picker, entity: template_pack,
          entity_filter: { kind: notification, tags: [fees] }, label: Template }
    default: [{ after_days: 7, audience: guardian, template_pack: fee_reminder_1 }]
    validate: { max_items: 5 }
    visible_when: { field: reminders.enabled, eq: true }
  # ── receipts ─────────────────────────────────────────────────────────────
  - { key: receipts.template_pack, group: receipts, type: entity-picker, entity: template_pack,
      entity_filter: { kind: document, category: bills }, label: "Receipt template", default: fee_bill }
  - { key: receipts.prefix, group: receipts, type: string, label: "Receipt prefix", default: "RC",
      validate: { pattern: "^[A-Z]{1,5}$" }, help: "Uppercase letters only; used in receipt numbers." }
  - { key: receipts.print_size, group: receipts, type: enum, label: "Print size", default: a4,
      options: [{value: a4, label: "A4"}, {value: thermal_80, label: "Thermal 80mm"}] }
  - { key: receipts.footer_note, group: receipts, type: markdown, label: "Receipt footer note", default: "" }
  # ── late fees ────────────────────────────────────────────────────────────
  - { key: late_fees.enabled, group: late_fees, type: boolean, label: "Charge late fees", default: false }
  - key: late_fees.mode
    group: late_fees
    type: enum
    label: "Late fee type"
    options: [{ value: flat, label: "Flat amount" }, { value: percent, label: "Percentage of due" }, { value: per_day, label: "Per day" }]
    default: flat
    visible_when: { field: late_fees.enabled, eq: true }
  - { key: late_fees.amount, group: late_fees, type: number, label: "Amount (NPR)", default: 100, unit: NPR,
      validate: { min: 0, max: 100000 }, visible_when: { all_of: [{field: late_fees.enabled, eq: true}, {field: late_fees.mode, in: [flat, per_day]}] } }
  - { key: late_fees.percent, group: late_fees, type: number, label: "Percent of due", default: 2, unit: "%",
      validate: { min: 0, max: 100 }, visible_when: { all_of: [{field: late_fees.enabled, eq: true}, {field: late_fees.mode, eq: percent}] } }
  - { key: late_fees.cap, group: late_fees, type: number, label: "Maximum late fee (NPR)", default: 1000, unit: NPR,
      validate: { min: 0 }, visible_when: { field: late_fees.enabled, eq: true } }
  - { key: late_fees.grace_days, group: late_fees, type: int, label: "Grace period (days)", default: 5, unit: days,
      validate: { min: 0, max: 60 }, visible_when: { field: late_fees.enabled, eq: true } }
  # ── gateways ─────────────────────────────────────────────────────────────
  - { key: gateways.enabled, group: gateways, type: multi-enum, label: "Enabled gateways",
      options: [{value: esewa, label: eSewa}, {value: khalti, label: Khalti}, {value: fonepay, label: FonePay}, {value: cash, label: "Cash / bank"}],
      default: [cash] }
  - { key: gateways.esewa_merchant_id, group: gateways, type: string, label: "eSewa merchant ID",
      visible_when: { field: gateways.enabled, in: [esewa] } }
  - { key: gateways.esewa_secret, group: gateways, type: secret, label: "eSewa secret", write_only: true,
      visible_when: { field: gateways.enabled, in: [esewa] }, validate: { min_length: 8 } }
  - { key: gateways.khalti_secret, group: gateways, type: secret, label: "Khalti secret key", write_only: true,
      visible_when: { field: gateways.enabled, in: [khalti] }, validate: { min_length: 8 } }
  - { key: gateways.qr_image, group: gateways, type: file, label: "Bank/QR image", accept: [".png", ".jpg", ".jpeg"],
      max_size_mb: 2, storage: plugin_files }
```

Note how this replaces scattered ad-hoc storage: `fees` currently reads two keys from `SchoolPlugin.config` while payment credentials live elsewhere (`_get_configured_payment_methods`, used at `api/v1/plugins.py:596-609`). Moving them into a schema with `secret` typing is what makes gateway keys safe to expose in a settings UI at all.

## 3.5 Secret handling

- Storage: `SchoolPlugin.config[<path>] = {"__secret__": true, "cipher": "<fernet>", "last4": "abcd", "updated_at": "..."}`, encrypted with a platform key (`SECRET_CONFIG_KEY`, env; rotate via `key_id` field). Plaintext never lands in JSONB.
- `GET /plugins/<slug>/config` returns `{"__secret__": true, "set": true, "last4": "abcd"}` — never the value. The existing GET (`api/v1/plugins.py:812-826`) is patched to redact before serialization, so even legacy plaintext values written before v2 stop leaking.
- `PUT` semantics: absent key = unchanged; `null` = clear; a string = re-encrypt. The form shows "Set ••••abcd — Replace".
- Read path for consumers: `config_store.plugin_secret(school_id, slug, path)` decrypts on demand and never logs. `plugin_config_value` (`config_store.py:49-55`) returns the redaction marker for secret paths so an accidental log line cannot print a key.
- Audit: every secret write appends `{path, actor_id, at}` to an append-only `plugin_config_audit` table (secrets excluded from the payload).

## 3.6 Stored-config migration

Adding fields is safe by construction (defaults are resolved at read time — see `resolve_config` below), so migrations are only needed for renames/reshapes.

`config_version` in the schema + `SchoolPlugin.config["__config_version__"]` on the row. Plugins ship transforms:

```python
# backend/app/plugins/modules/fees/config_migrations.py
MIGRATIONS = {
    2: lambda cfg: {**cfg, "reminders": {"enabled": cfg.pop("reminder_enabled", True),
                                         "overdue_days": cfg.pop("reminder_overdue_days", 30)}},
    3: lambda cfg: {**cfg, "reminders": {**cfg.get("reminders", {}),
                                         "channels": cfg.get("reminders", {}).get("channels") or ["sms", "push"]}},
    4: lambda cfg: {**cfg, "late_fees": cfg.get("late_fees") or {"enabled": False}},
}
```

Runner: lazy on first read/write per school (`ensure_config_version(school_id, slug)`), plus a superadmin bulk pass `POST /plugins/<slug>/migrate-config`. Each step is idempotent and the pre-migration config is snapshotted into `plugin_config_audit` so a bad transform is recoverable. Missing transform for a version gap = validator error at load time, not a runtime surprise.

## 3.7 Backend validation sketch

```python
# backend/app/plugins/config_schema.py   (new)
"""Config-schema v2: load, validate, coerce, redact.

Contract: `validate_config` NEVER partially applies. Either the whole payload
is accepted (returning the merged, coerced config) or a field-keyed error dict
is returned for the form to render inline.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field as dc_field

SUPPORTED_TYPES = {
    "string", "text", "int", "number", "boolean", "enum", "multi-enum", "color",
    "color-map", "file", "secret", "cron", "time", "date", "bs_date", "json",
    "entity-picker", "list", "markdown",
}

@dataclass
class FieldError(Exception):
    key: str
    message: str

@dataclass
class Schema:
    version: int
    config_version: int
    groups: list[dict] = dc_field(default_factory=list)
    fields: list[dict] = dc_field(default_factory=list)

    def by_key(self) -> dict[str, dict]:
        return {f["key"]: f for f in self.fields}


def load_schema(slug: str) -> Schema | None:
    """Parse + structurally validate a plugin's config_schema.yaml (cached)."""
    raw = PluginLoader.get_config_schema_raw(slug)           # {} when absent
    if not raw:
        return None
    if int(raw.get("schema_version") or 1) < 2:
        raw = _upgrade_v1_schema(raw)                        # wrap flat fields, map number->number
    fields = raw.get("fields") or []
    seen: set[str] = set()
    for f in fields:
        key, ftype = f.get("key"), f.get("type", "string")
        if not key or ftype not in SUPPORTED_TYPES:
            raise ValueError(f"{slug}: bad field {key!r} type {ftype!r}")
        if key in seen:
            raise ValueError(f"{slug}: duplicate field key {key!r}")
        seen.add(key)
        if ftype in ("enum", "multi-enum") and not f.get("options"):
            raise ValueError(f"{slug}: {key} needs options")
        if ftype == "entity-picker" and not f.get("entity"):
            raise ValueError(f"{slug}: {key} needs entity")
        if ftype == "list" and not f.get("item_fields"):
            raise ValueError(f"{slug}: {key} needs item_fields")
    return Schema(version=2, config_version=int(raw.get("config_version") or 1),
                  groups=raw.get("groups") or [], fields=fields)


# ── visibility ────────────────────────────────────────────────────────────
def _cond_met(cond: dict, values: dict) -> bool:
    if "all_of" in cond:
        return all(_cond_met(c, values) for c in cond["all_of"])
    if "any_of" in cond:
        return any(_cond_met(c, values) for c in cond["any_of"])
    actual = get_dotted(values, cond["field"])                # config_store.get_dotted
    if "eq" in cond:      return actual == cond["eq"]
    if "ne" in cond:      return actual != cond["ne"]
    if "truthy" in cond:  return bool(actual) is bool(cond["truthy"])
    if "gt" in cond:      return _num(actual) > _num(cond["gt"])
    if "lt" in cond:      return _num(actual) < _num(cond["lt"])
    if "in" in cond:                                          # membership either way
        wanted = cond["in"]
        return (actual in wanted) if not isinstance(actual, list) else bool(set(actual) & set(wanted))
    return True


def visible_fields(schema: Schema, values: dict, role: str, installed: set[str]) -> list[dict]:
    out = []
    groups = {g["key"]: g for g in schema.groups}
    for f in schema.fields:
        grp = groups.get(f.get("group") or "", {})
        if f.get("roles") and role not in f["roles"]:                      continue
        if grp.get("roles") and role not in grp["roles"]:                  continue
        if any(p not in installed for p in (f.get("requires_plugins") or [])): continue
        if f.get("visible_when") and not _cond_met(f["visible_when"], values): continue
        out.append(f)
    return out


# ── coercion + validation ─────────────────────────────────────────────────
_HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_CRON = re.compile(r"^(\S+\s+){4}\S+$")

def _coerce(f: dict, value):
    t, key = f.get("type", "string"), f["key"]
    v = f.get("validate") or {}
    if t == "boolean":
        if not isinstance(value, bool): raise FieldError(key, "must be true or false")
        return value
    if t in ("int", "number"):
        try: num = int(value) if t == "int" else float(value)
        except (TypeError, ValueError): raise FieldError(key, "must be a number")
        if "min" in v and num < v["min"]: raise FieldError(key, f"must be ≥ {v['min']}")
        if "max" in v and num > v["max"]: raise FieldError(key, f"must be ≤ {v['max']}")
        return num
    if t in ("string", "text", "markdown"):
        s = "" if value is None else str(value)
        if "min_length" in v and len(s) < v["min_length"]: raise FieldError(key, "too short")
        if "max_length" in v and len(s) > v["max_length"]: raise FieldError(key, "too long")
        if v.get("pattern") and not re.match(v["pattern"], s): raise FieldError(key, "invalid format")
        if f.get("format"): _check_format(key, f["format"], s)     # email/phone/url/slug
        return s
    if t == "enum":
        allowed = {o["value"] for o in f["options"]}
        if value not in allowed: raise FieldError(key, "not an allowed option")
        return value
    if t == "multi-enum":
        allowed = {o["value"] for o in f["options"]}
        if not isinstance(value, list) or not set(value) <= allowed:
            raise FieldError(key, "contains an unknown option")
        if len(value) < (v.get("min_items") or 0): raise FieldError(key, "select at least one")
        if "max_items" in v and len(value) > v["max_items"]: raise FieldError(key, "too many selected")
        return value
    if t == "color":
        if not _HEX.match(str(value or "")) and str(value).lower() not in SAFE_COLOR_WORDS:
            raise FieldError(key, "must be a hex colour like #2563EB")
        return value
    if t == "color-map":
        if not isinstance(value, dict) or not set(value) <= set(f.get("keys") or []):
            raise FieldError(key, "unexpected colour keys")
        for k, c in value.items():
            if not _HEX.match(str(c or "")): raise FieldError(f"{key}.{k}", "must be a hex colour")
        return value
    if t == "cron":
        if not _CRON.match(str(value or "")): raise FieldError(key, "must be a 5-field cron expression")
        return value
    if t == "entity-picker":
        if not entity_exists_for_school(f["entity"], value, g.school_id, f.get("entity_filter")):
            raise FieldError(key, "unknown selection")                 # blocks cross-tenant ids
        return value
    if t == "file":
        return _validate_file_ref(key, f, value)
    if t == "list":
        if not isinstance(value, list): raise FieldError(key, "must be a list")
        if "max_items" in v and len(value) > v["max_items"]: raise FieldError(key, "too many items")
        sub = Schema(2, 1, [], f["item_fields"])
        return [validate_config(sub, item, role="__item__", partial=False)[1] for item in value]
    if t == "json":
        if f.get("json_schema"): _validate_json_schema(key, value, f["json_schema"])
        return value
    if t == "secret":
        return encrypt_secret(str(value))            # {"__secret__": True, "cipher": ..., "last4": ...}
    return value


def validate_config(schema: Schema, payload: dict, role: str,
                    installed: set[str] | None = None,
                    stored: dict | None = None) -> tuple[dict, dict]:
    """Return (errors_by_key, merged_config). Errors non-empty ⇒ nothing applied."""
    merged = deep_copy(stored or {})
    deep_merge_into(merged, payload)                       # so visible_when sees new values
    allowed = {f["key"]: f for f in visible_fields(schema, merged, role, installed or set())}
    errors: dict[str, str] = {}
    result = deep_copy(stored or {})

    for key, value in flatten_dotted(payload).items():
        f = allowed.get(key)
        if f is None:
            errors[key] = ("unknown or not editable in this context"
                           if key in schema.by_key() else "unknown setting")
            continue
        if f.get("readonly"):
            errors[key] = "read-only"; continue
        if f["type"] == "secret" and value is None:
            set_dotted(result, key, None); continue        # explicit clear
        try:
            set_dotted(result, key, _coerce(f, value))
        except FieldError as exc:
            errors[exc.key] = exc.message

    # hidden fields are pruned, not validated — an off feature never blocks a save
    for key in list(flatten_dotted(result)):
        if key in schema.by_key() and key not in allowed:
            unset_dotted(result, key)

    result["__config_version__"] = schema.config_version
    return errors, result


def resolve_config(slug: str, school_id: str, role: str = "school_admin") -> dict:
    """Effective config = schema defaults ← stored values (what consumers read)."""
    schema = load_schema(slug)
    stored = get_plugin_config(school_id, slug)                # config_store.py:33
    if not schema:
        return stored
    stored = ensure_config_version(slug, school_id, stored)    # §3.6
    out: dict = {}
    for f in visible_fields(schema, stored, role, installed_slugs(school_id)):
        val = get_dotted(stored, f["key"], _MISSING)
        set_dotted(out, f["key"], f.get("default") if val is _MISSING else val)
    return deep_merge(stored, out)                             # unknown keys preserved
```

Route changes stay minimal: `PUT /plugins/<slug>/config` (`api/v1/plugins.py:829-885`) keeps its size cap, reserved-key check and `?replace=1` semantics, and inserts `errors, merged = validate_config(...)` before assignment, returning `422 {"errors": {...}}` on failure. Plugins without a schema keep today's pass-through behaviour, so nothing regresses on day one. `resolve_config` also kills the documented defaults-duplication rule in `library_management/config_schema.yaml:1-6` — consumers call `resolve_config` (or `plugin_config_value`, which now delegates to it) instead of hardcoding fallbacks.

## 3.8 Generic form renderer (web)

`frontend/components/plugin-widgets/FormRenderer.tsx` replaces the bespoke logic in `app/dashboard/plugins/[slug]/settings/page.tsx`:

- Input: `{schema, values, onChange, role, errors}`; output: dot-path patch + client-side validation mirroring the server rules (`visible_when` evaluated in the browser so controls appear/disappear live).
- One control component per type, all built on existing primitives: `Input`, `Textarea`, `Switch`, `Select`, `Checkbox` group, `BSDateInput`, `FilePicker`, plus three new ones (`ColorField`, `CronField`, `EntityPicker`).
- Groups render as `Tabs` when >2, otherwise fieldsets; `advanced: true` fields sit behind a "Show advanced" disclosure; save is a single `PUT ...?replace=1` with server errors mapped onto fields by key.
- Unknown/extra config keys still get today's generic key-value editor at the bottom, so a partially-migrated plugin remains fully editable.
- The same component renders `settings-section` widgets and widget-level `config_schema` popovers (§2.7) — one form engine, three entry points.

---

# 4. THEME ARCHITECTURE

## 4.1 One token document, four consumers

Today there are four unrelated theme systems: the public-site palette duplicated in `backend/app/services/website/theme_engine.py:35-106` **and** `frontend/themes/registry.ts:34-125` (10 themes, 5 colours + 2 fonts each); the dashboard's HSL CSS variables in `frontend/app/globals.css:5-84` + `tailwind.config.js`; admin-app branding in `School.settings["white_label"]["theme"]` with its own 7 keys (`services/website/white_label.py:33-62`); and Flutter's hardcoded `ASchoolTheme` (`aschool_shared/lib/theme/app_theme.dart:17-31`). Nothing is shared, and the dashboard's dark tokens are dead code (no toggle — UI inventory §4).

v2 introduces a **theme document**: a validated JSON object with a fixed token taxonomy, resolved per (school, surface, mode) and emitted in whatever form each consumer needs.

**Token taxonomy** (`aschool.theme/1`):

```yaml
theme_key: global-elearning          # id (existing theme ids preserved verbatim)
name: "Global eLearning"
extends: null                        # inheritance: base theme key
tier: pro                            # free|pro (marketplace gating, as today)
applies_to: [public_site, web_dashboard, mobile, pdf, designer]
tokens:
  color:                             # ROLES, not raw names
    primary: "#027abb"
    primary_dark: "#1e7ba6"
    primary_fg: "#ffffff"
    secondary: "#269bd1"
    secondary_fg: "#ffffff"
    accent: "#1e7ba6"
    accent_fg: "#ffffff"
    bg: "#fafafa"
    surface: "#ffffff"
    surface_alt: "#f3f4f6"
    text: "#16181a"
    text_muted: "#6b7280"
    border: "#e5e7eb"
    success: "#16a34a"
    warning: "#f59e0b"
    danger: "#dc2626"
    info: "#0ea5e9"
    focus_ring: "#027abb"
    overlay: "#0000008c"
  typography:
    font_heading: "DM Sans"
    font_body: "Inter"
    font_devanagari: "Noto Sans Devanagari"   # web + Flutter + WeasyPrint (pdf_css.py)
    font_mono: "JetBrains Mono"
    scale: { xs: 12, sm: 13, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30, "4xl": 38 }
    weight: { normal: 400, medium: 500, semibold: 600, bold: 700 }
    line_height: { tight: 1.2, normal: 1.5, relaxed: 1.7 }
    devanagari_line_height: 1.75      # Devanagari needs more leading than Latin
  spacing: { unit: 4, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 }
  radius: { none: 0, sm: 6, md: 10, lg: 14, xl: 20, full: 9999 }
  elevation:
    sm: "0 1px 2px rgba(0,0,0,0.05)"
    md: "0 4px 10px rgba(0,0,0,0.06)"
    lg: "0 10px 24px rgba(0,0,0,0.08)"
  motion: { fast: 120, normal: 200, slow: 320, easing: "cubic-bezier(.4,0,.2,1)" }
  layout: { container_max: 1280, sidebar_w: 228, sidebar_collapsed_w: 56, header_h: 56 }
modes:
  dark:                              # sparse override map; absent = derive
    color: { bg: "#0f1114", surface: "#161a1e", text: "#f2f4f6", border: "#2e343a" }
surface_overrides:                   # per-surface deltas
  web_dashboard: { color: { primary: "hsl(163 62% 14%)" } }   # keeps today's forest green
  pdf: { typography: { font_body: "Noto Sans Devanagari" } }
```

**Layering (lowest → highest precedence):**

1. **Platform base** — `backend/app/themes/base.yaml` (the token vocabulary + platform defaults).
2. **Theme pack** — one of the 10 existing website themes, or a plugin-contributed theme (`modules/<slug>/themes/*.yaml`). `extends:` allows a theme to be a delta over another.
3. **Surface override** — `surface_overrides.<surface>` inside the pack.
4. **Plugin contributions** — additive, namespaced tokens only: a plugin may add `color.plugin.attendance.present` but **cannot** overwrite a core role token. Validator enforces the namespace; `applies_to` must list the surface, and `public_site` contributions additionally require the plugin to declare `capabilities.public_routes` — so no plugin can quietly restyle the public website.
5. **School white-label** — brand colours/fonts from `School.settings["white_label"]` and `SchoolWebsite.customizations` (existing storage, unchanged).
6. **Mode** — light/dark selection.
7. **Per-school explicit token overrides** — new `school_theme_tokens` table for anything the theming UI edits beyond brand colours.

**Storage** — new table `theme_documents` (platform-owned packs, mirrored from files exactly like plugins: filesystem is truth, DB is a mirror) + `school_theme_tokens`:

| table | columns |
|---|---|
| `theme_documents` | `id, theme_key (unique), name, tier, extends, applies_to text[], tokens JSONB, modes JSONB, surface_overrides JSONB, version, source ('file'\|'db'), is_published` |
| `school_theme_tokens` | `id, school_id, surface, mode, tokens JSONB (sparse override), updated_by, is_published, draft JSONB` |

Existing columns keep working: `SchoolWebsite.theme_slug` still selects the pack; `SchoolWebsite.customizations["colors"]` still holds the five core colours the public layout reads. The resolver reads them as layer 5 rather than as the whole story.

## 4.2 Resolution and delivery

`backend/app/services/theme/resolver.py`:

```python
def resolve_theme(school_id: str | None, surface: str, mode: str = "light") -> dict:
    """Fully-merged theme document. Cached per (school, surface, mode), 300s,
    invalidated on any white-label/website-config/theme write."""
```

`GET /themes/tokens?surface=web_dashboard&mode=light` returns `{tokens, css_vars, theme_key, version, etag}`.

| Consumer | Delivery |
|---|---|
| **Public site** (`frontend/app/school/[slug]/layout.tsx`) | unchanged path: `getThemeById(themeSlug)` + `generateThemeCSS(theme, sanitizeColorOverrides(...))` into the nested `<style>`. In phase 2 `frontend/themes/registry.ts` stops hardcoding the 10 palettes and is generated from the resolved document, so the emitted CSS text is byte-identical (§4.4). |
| **Web dashboard** | server component reads `resolve_theme(school, "web_dashboard", mode)` and emits `:root{--primary:…}` in `app/dashboard/layout.tsx`. Tailwind keeps consuming `hsl(var(--primary))` — no class churn. Dark mode finally works: `<html class="dark">` toggled by the (already existing but unused) `useAppStore.theme`. |
| **Flutter** | `GET /themes/tokens?surface=mobile` on bootstrap, cached in secure storage. New `ASchoolTheme.fromTokens(json)` builds `ThemeData` (ColorScheme, TextTheme with Devanagari fallback, radii, elevations); the current hardcoded constants become the offline/first-run default. `themeModeProvider` already handles light/dark/system. |
| **PDF (WeasyPrint)** | `services/designer/pdf_css.py` gains `pdf_theme_css(school_id)` emitting the same variables plus the existing `@font-face` Devanagari block; `wrap_pdf_html` prepends it. Documents can then use `var(--color-primary)` instead of the hardcoded `#1e40af` literals in `template_engine.py`. |
| **Designer canvas** | `GET /themes/tokens?surface=designer` feeds a palette swatch row + token-aware defaults so new elements pick up school colours; existing saved canvases keep their literal colours (no retro-theming of saved documents — that would change printed output). |

## 4.3 Devanagari and typography

- `font_devanagari` is a first-class token, resolved on all four surfaces. Web: font stack ends with it and `.font-nepali` maps to it (fixing the declared-but-never-loaded `--font-mukta` noted in UI inventory §4). PDF: already installed system-wide in the Docker image and embedded via `@font-face` (`pdf_css.py:14-29`). Flutter: `TextTheme` fontFamilyFallback.
- `devanagari_line_height` exists because Devanagari clips at Latin leading; renderers apply it when the string contains Devanagari codepoints or the active locale is `ne`.
- Type scale is token-driven so density presets (`comfortable|compact|spacious`, already in the white-label theme keys) become a scale multiplier rather than per-component classes.

## 4.4 CRITICAL: the public site must look identical

**Mechanism — baseline capture + byte-equality test.**

1. **Capture.** A one-off script `backend/scripts/capture_theme_baseline.py` reads today's truth — `ThemeEngineService.THEMES` (`theme_engine.py:35-106`) and `frontend/themes/registry.ts` (asserting they agree; any divergence is reported and resolved before proceeding) — and writes 10 files `backend/app/themes/packs/<theme_key>.yaml` whose `tokens.color.{primary,secondary,accent,bg,text}` and `tokens.typography.{font_heading,font_body}` are the **exact current values**. Additional token roles are filled from `base.yaml` and are *not referenced by any public-site CSS* in phase 1.
2. **Same emitter.** `generateThemeCSS` (`frontend/themes/registry.ts:138-149`) continues to emit exactly seven declarations in the same order. The resolver is only allowed to change *where the seven values come from*, never the emitted text shape. `DEFAULT_THEME_ID = "global-elearning"` is preserved on both sides (`theme_engine.py:33`, `registry.ts:131`).
3. **Equality tests (both directions).**
   - Backend `tests/test_theme_baseline.py`: for each of the 10 theme ids, `resolve_theme(None, "public_site")["css_vars"]` == `ThemeEngineService.generate_css(theme_id)` variable block, string-compared.
   - Frontend `__tests__/theme-parity.test.ts`: `generateThemeCSS(getThemeById(id))` for all 10 ids matches a committed snapshot captured **before** any change.
   - Playwright visual diff on `/school/<slug>` for 3 schools × 3 viewports, threshold 0 — run before/after the theme refactor lands.
4. **No new tokens reach the public site in phase 1.** `surface_overrides.public_site` starts empty; the public `<style>` block keeps exactly `themeCss + surfaceOverride + customCss + 2 resets` (`layout.tsx:229-239`). Extra tokens ship only when a section component is explicitly changed to consume them — a separate, visible decision.
5. **Section defaults frozen.** The section registry migration (§5.5) copies `defaultContent` verbatim from `frontend/lib/school-website/registry.ts`, and the fallback hardcoded homepage layout (`app/school/[slug]/page.tsx:106+`) stays as the no-sections path until a school opts into a section-based page.

**Divergence path for a school (safe by construction).** A school changes brand colours through white-label or the theming UI. Every value passes three gates already present or specified: hex/colour-word allowlist server-side (`_is_safe_color`, `theme_engine.py:17-25`; `_HEX_COLOR_RE` in `white_label.py:32`), the same allowlist client-side (`sanitizeColorOverrides`, `frontend/lib/sanitize.ts:134-147`), and `sanitizeCss` for custom CSS (`sanitize.ts:101-119`). v2 adds:

- **Contrast validation** — WCAG AA (4.5:1 body, 3:1 large text/UI) computed for each fg/bg pair; failures are a blocking error in the theming UI with a "nearest passing shade" suggestion. Prevents the "white text on yellow primary" class of self-inflicted damage.
- **Derived-token generation** — `primary_dark`, `primary_fg`, hover/active states are derived from the chosen primary so a school changing one colour cannot leave the palette internally inconsistent.
- **Token allowlist per role** — a school may override colour/typography/radius/density; it may not override layout or motion tokens or inject arbitrary keys.
- **Draft + publish** — `school_theme_tokens.draft` holds unpublished edits; the public site reads only published tokens (matching the existing `SchoolWebsite.draft_config`/`is_published` pattern).

## 4.5 Admin theming UI

`/dashboard/settings/theme` (extends today's white-label branding + website-design screens):

- **Preset gallery** — the 10 packs with live thumbnails, free/pro badges honouring the existing tier gating.
- **Token editor** — grouped colour/typography/shape/density controls rendered by the §3.8 `FormRenderer` over a platform-owned theme schema (so the theming UI is not a bespoke form).
- **Live preview** — split view with a dashboard mock and a public-site mock inside an iframe fed by draft tokens; a "Public site" tab makes the *no visual change by default* promise verifiable by the school.
- **Contrast panel** — per-pair AA/AAA badges, with the failing pairs listed.
- **Scope switch** — Public site / Dashboard / Mobile, so a school can restyle its dashboard without touching its website.
- **Reset** — per-token, per-group, or whole-surface reset to the pack default (one `DELETE /themes/tokens?surface=` call).
- **Export/import** — token JSON download/upload for multi-branch chains to copy branding between schools (validated through the same gates).

---

# 5. TEMPLATE ARCHITECTURE

## 5.1 Six template systems today

| System | Storage | Catalog source | Renderer |
|---|---|---|---|
| Designer documents (ID cards, certificates, marksheets…) | `designer_templates` (`backend/app/models/designer_template.py:12-33`) + `designer_documents` | 40 folders `backend/app/templates/designer/<key>/` scanned by `template_folders.py:96-120`, **merged with** a 2272-line in-code `TEMPLATES` dict (`template_engine.py:898+`), seeded to DB (`template_engine.py:1183-1305`) | fabric canvas (web) / `document_renderer.py` → WeasyPrint |
| Website sections | `WebsitePage.sections` JSONB (`models/website.py:18`) | `frontend/lib/school-website/registry.ts` (17 types, `defaultContent` + `controls`) | `SectionRenderer.tsx:973-1019` switch |
| Website page presets | none (applied into sections) | `frontend/lib/school-website/templates.ts` (3 presets) | same |
| Website themes | `SchoolWebsite.theme_slug` / unused `website_themes` table (`models/website.py:30-42`) | duplicated registries (§4.1) | CSS vars |
| Notification templates | `notification_templates` (`models/notification.py:79-87`: `channel, template_en, template_ne, variables`) | none — schools create their own | string interpolation in sms/communications |
| Calendars / question papers | folders + generator scripts (`tools_gen_calendar_templates.py`, `tools_gen_nepal_school_templates.py`, `tools_redesign_nepal_templates.py`) | ad hoc | designer/writer |

Shared shape is obvious: an identity + metadata + variables + a layout body + optional assets + ownership (platform vs school). What differs is only the layout format and the renderer. `template_folders.py:1-22` already documents the right philosophy ("the FILESYSTEM is the source of truth… the DB only stores per-school user edits") — v2 generalizes exactly that to all six.

## 5.2 `TemplatePack`

```
<owner>/templates/<pack_key>/
├── pack.yaml
├── layout.<ext>          # canvas.json | writer.json | section.json | body.md | body.html
├── layout.ne.<ext>       # optional locale variant
├── print.json            # optional print-specific variant (screen vs print)
├── preview.png           # thumbnail (generated if absent — thumbnails.py)
└── assets/               # images referenced by relative path
```

`owner` is one of: `backend/app/templates/<kind>/` (platform), `backend/app/plugins/modules/<slug>/templates/` (plugin-shipped), or a DB row (school-authored/overridden).

```yaml
# pack.yaml
schema_version: 1
pack_key: fee_bill                    # unique within (kind); global id = "<kind>:<pack_key>"
kind: document                        # document|website_section|notification|report|calendar|question_paper|email
name: "Fee Bill / Receipt"
name_nepali: "शुल्क बिल"
description: "Itemised fee bill with receipt number, paid/due split and IRD PAN line"
category: bills                       # normalized via TemplateEngineService._CATEGORY_ALIASES
tags: [fees, receipt, ird]
version: 2.1.0
owner: platform                       # platform | plugin:<slug> | school
provided_by: fees                     # plugin slug when owner=plugin:*
requires_plugins: [fees]              # pack hidden unless installed
locales: [en, ne]
default_locale: en

engine: writer                        # writer | canvas | sections | text | html | markdown
page:
  size: A4                            # A4|A3|A5|ID Card|Thermal80|"794 1123"
  orientation: portrait
  margins: { top: 10, right: 10, bottom: 10, left: 10 }
  page_count: 1
variants:
  screen: layout.json
  print: print.json                   # optional; falls back to screen
  ne: layout.ne.json

variables:                            # replaces the untyped `fields: []` list
  - { key: school_name, type: string, source: school.name, required: true }
  - { key: school_logo, type: image,  source: school.logo_url }
  - { key: student_name, type: string, source: student.full_name, required: true }
  - { key: receipt_no,  type: string, source: payment.receipt_number, required: true }
  - { key: items,       type: table,  source: payment.items,
      columns: [{ key: label, label: Particulars }, { key: amount, label: Amount, format: npr }] }
  - { key: total, type: number, format: npr, source: payment.total }
  - { key: qr_code, type: qr, source: payment.verify_url }
data_sources: [school, student, payment]    # validated against design_studio /data-sources
theme:
  tokens: [color.primary, color.text, typography.font_body, typography.font_devanagari]
  respect_school_theme: true          # false = fixed brand (e.g. government forms)

preview: preview.png
is_default: true
published: true
editable: true                        # false = platform-locked (statutory formats)
```

**Resolution order** (highest first), implemented once in `TemplateRegistry.resolve(kind, pack_key, school_id)`:

1. **School override** — `template_packs` DB row with `school_id = <school>` (created the moment a school edits a pack; deep-merged over the parent so new upstream fields still arrive — the `deep_merge` in `template_folders.py:127-138` is already exactly this).
2. **Plugin-provided** — `modules/<slug>/templates/<pack_key>/` for installed+active plugins.
3. **Platform default** — `backend/app/templates/<kind>/<pack_key>/`.
4. **Legacy in-code registry** — `template_engine.TEMPLATES` (kept during migration; folders already win over it today).

This preserves current merge semantics (`file default ← DB overlay`) while adding the plugin layer.

## 5.3 Registry, storage and API

`backend/app/services/templates/registry.py` — one scanner for all kinds, replacing `template_folders.scan_template_folders` (which it absorbs):

```python
class TemplateRegistry:
    @classmethod
    def scan(cls, force=False) -> dict[tuple[str, str], dict]: ...      # (kind, pack_key) -> pack
    @classmethod
    def list_packs(cls, kind=None, school_id=None, installed=None) -> list[dict]: ...
    @classmethod
    def resolve(cls, kind, pack_key, school_id=None, locale="en", variant="screen") -> dict: ...
    @classmethod
    def render(cls, kind, pack_key, values, school_id=None, **opts): ...  # dispatch by engine
```

New table `template_packs` replaces/absorbs `designer_templates` (migrated, not dropped):

| column | notes |
|---|---|
| `id`, `school_id` (NULL = platform mirror) | |
| `kind`, `pack_key` | unique together with `school_id` |
| `name`, `name_nepali`, `category`, `tags text[]`, `description` | |
| `engine`, `page JSONB`, `variables JSONB`, `data_sources text[]` | |
| `layout JSONB` (screen), `layout_print JSONB`, `layouts_i18n JSONB` | |
| `theme JSONB`, `preview_url`, `version`, `owner`, `provided_by` | |
| `is_default`, `published`, `editable`, `source ('file'\|'plugin'\|'db')` | |

Migration from `designer_templates` is a straight column map (`template_key→pack_key`, `canvas_json`/`writer_json`→`layout` + `engine`, `fields`→`variables` with `type: string` inferred, `extra_config`→`page`), so 40 folder packs + every school override survive. `designer_templates` is kept as a **view** for one release so `bulk_generator.py`, `document_renderer.py` and `api/v1/design_studio.py` keep reading while they are migrated.

API: `GET /templates/packs?kind=&category=&q=`, `GET /templates/packs/<kind>/<key>`, `PUT` (school override), `DELETE` (revert to parent), `POST /templates/packs/<kind>/<key>/render`, `GET .../preview.png`. The existing `design_studio` template endpoints (`api/v1/design_studio.py:370-415`, `:1233-1273`) become thin proxies so the designer UI needs no change on day one.

Installation/seeding: `hooks.activate` calls `TemplateRegistry.install_plugin_packs(slug, school_id)` which only ensures **mirror rows** exist (files stay the truth) — no content copying, so a plugin update ships improved templates automatically unless the school has overridden them. Uninstall keeps school overrides (`uninstall_policy: keep_data`).

## 5.4 Rendering engines

| `engine` | Layout format | Renderer | Existing code reused |
|---|---|---|---|
| `canvas` | fabric JSON (single or `{version: "multi-page", pages: []}`) | web fabric editor; PDF via `document_renderer.py` | as-is |
| `writer` | block list (`header_band`/`columns`/`table`/`paragraph`/`signature`/`spacer`/`footer_band`) | tiptap writer; PDF via writer→HTML | `template_engine._writer*` helpers |
| `sections` | `[{type, title, content, sort_order}]` | `SectionRenderer` (web + public site) | §5.5 |
| `text` | `{body_en, body_ne, max_length, channel}` | SMS/WhatsApp/push interpolation | §5.6 |
| `html` / `markdown` | body with `{{var}}` tokens | email (MJML-free HTML) / notice bodies; sanitized via `sanitizeHtml` | `lib/sanitize.ts` |

Token syntax is unified on the existing `{var}` / `{{var}}` pattern (`template_engine._TOKEN_PATTERN`, `document_renderer._TOKEN_RE`) with typed variables now declaring format (`npr`, `bs_date`, `percent`, `nepali_digits`), so number/date localization stops being per-renderer guesswork.

## 5.5 Website sections as templates (design-preserving)

Three moves, none of which changes rendered output:

**(a) Section-type registry becomes data.** `frontend/lib/school-website/registry.ts` (474 lines of `SchoolWidgetDef`) is replaced by `GET /website/section-types`, served from `backend/app/templates/website_section/<type>/pack.yaml` — one pack per existing type (`hero`, `slideshow`, `stats`, `about`, `principal`, `programs`, `facilities`, `notices`, `teachers`, `gallery`, `testimonials`, `results`, `cta`, `contact`, `spacer`, `divider`, `map`). Each pack carries `name`, `icon`, `category`, `preview_gradient`, `default_content` (copied verbatim), `controls` (copied verbatim), and `renderer_token` (the component name). The `SectionRenderer` switch (`SectionRenderer.tsx:973-1019`) becomes a `SECTION_COMPONENTS` map keyed by the same strings — same components, same props, resolved by lookup instead of `switch`. Unknown types keep today's honest placeholder branch (`SectionRenderer.tsx:1013-1018`), which is what makes plugin-added types safe.

**(b) Plugins can add section types.** A plugin ships `templates/<type>/pack.yaml` with `kind: website_section`, and a widget with `type: website-section` (§2.2). If it needs bespoke markup it also registers a component token; otherwise it uses the generic `spec` section renderer (heading + body + list/grid + CTA), which covers most school-site content. Public-site data comes from a `public: true` endpoint on the plugin's own blueprint, and `/website/public/<slug>` gains a `plugin_sections` block so SSR still does one fetch.

**(c) Menus and page layouts become data.** Today the navbar has a hardcoded `NAV_ITEMS` fallback and derives items from published pages (`components/website/SchoolNavbar.tsx:26-44`), the layout hardcodes an 8-item `navLinks` array for the footer (`app/school/[slug]/layout.tsx:165-174`), and the footer's Programs/Contact columns are hardcoded JSX (`layout.tsx:300-335`). v2 adds a `website_menus` table (`school_id, location ('header'|'footer_quick'|'footer_programs'|'mobile'), items JSONB [{label,label_ne,href,page_id,children[],visible}], sort_order`) **seeded from exactly those hardcoded arrays** on first read, so the rendered menu is identical until an admin edits it. Page layouts (which sections, in what order, per page type) become `sections` on `WebsitePage` for every page rather than only `home` — the pages `about/academics/teachers/notices/gallery/results/contact` keep their current hand-written components as the default until a school applies a section-based layout, matching how the homepage already falls back (`app/school/[slug]/page.tsx:106+`).

Page presets (`lib/school-website/templates.ts`, 3 presets) become `kind: website_page_preset` packs — one-click "apply layout" writes sections, exactly as now.

## 5.6 Notification / SMS / email / WhatsApp packs

`kind: notification`, `engine: text` (or `html` for email):

```yaml
pack_key: absent_sms
kind: notification
name: "Absence alert (SMS)"
provided_by: attendance
channels: [sms, whatsapp, push]
locales: [en, ne]
default_locale: ne
body:
  en: "Dear parent, {student_name} was marked absent on {date}. Please contact {school_name} if this is unexpected."
  ne: "प्रिय अभिभावक, {student_name} {date} मा अनुपस्थित देखिएका छन्। कुनै त्रुटि भएको लागे {school_name} मा सम्पर्क गर्नुहोस्।"
variables:
  - { key: student_name, type: string, source: student.full_name, required: true }
  - { key: date, type: date, format: bs_date, required: true }
  - { key: school_name, type: string, source: school.name }
limits: { sms_segments: 2, max_length: 320 }      # validator warns when a locale overflows
push: { title_en: "Absence Alert", title_ne: "अनुपस्थिति सूचना" }
```

- Existing `notification_templates` rows (`models/notification.py:79-87`) migrate 1:1 (`template_en`/`template_ne` → `body.en`/`body.ne`, `variables` → typed variables) and become school overrides of platform/plugin packs. Schools keep editing them at the same screens.
- Senders (`app/tasks/sms_sender.py`, `services/communications/*`, `tasks/push_notifications.py`) call `TemplateRegistry.render("notification", key, values, school_id, locale=school.default_language)`. This replaces the ~15 inline f-strings currently embedded in `plugins/listeners.py` (e.g. the absent-alert SMS at `listeners.py:152-157`, fee-paid push at `:258-260`, emergency SMS at `:1018-1020`) — the reason schools cannot currently reword their own alerts.
- Nepali variants are first-class: `default_locale` follows `School.default_language` (defaults to `ne`, `models/school.py:149`), with per-guardian language preference overriding when known.
- SMS cost safety: the validator computes segment counts per locale (Devanagari is UCS-2, 70 chars/segment) and warns when a rendered message exceeds `limits.sms_segments` — today nothing checks this, and Nepali messages silently cost 3-4× more.

## 5.7 Generator scripts

`tools_gen_nepal_school_templates.py`, `tools_redesign_nepal_templates.py`, `tools_gen_calendar_templates.py`, `tools_gen_thumbnails.py` currently write `template.yaml` + `canvas.json`/`writer.json` straight into `backend/app/templates/designer/<key>/`. They keep working unchanged (the compat scanner accepts `template.yaml` and normalizes it into a pack), and are updated in phase 4 to emit `pack.yaml` with typed variables. `tools_gen_thumbnails.py` folds into `services/designer/thumbnails.py` so preview generation is one code path for every kind.

---

# 6. IMPLEMENTATION PLAN

Effort key: **S** ≤ 2 days · **M** 3-7 days · **L** > 7 days (one engineer).
Every phase is independently shippable and reversible. No phase changes public-site pixels except where explicitly tested for equality.

## Phase 0 — Contract + adapter + validator (S/M)

**Create**
- `backend/app/plugins/validator.py` — checks of §1.4(b), returns `[(severity, slug, file, message)]`.
- `backend/tests/test_plugin_contract.py` — parametrized over **all 47** manifests (modules + legacy); errors fail CI.
- `backend/app/plugins/schema/manifest_v2.yaml` — the manifest schema itself (self-validating).
- `backend/scripts/plugin_doctor.py` — CLI: `python -m scripts.plugin_doctor [--fix-safe]` prints the validator table; `--fix-safe` writes `schema_version: 2` + moves `frontend:`→`ui.nav`, `flutter:`→`mobile`, pointers→`capabilities` for manifests that already pass.

**Modify**
- `backend/app/plugins/loader.py` — add `_normalize_manifest` (§1.4a); `get_frontend_sidebar`/`get_bottom_nav_items` read `ui.nav`; build the effective alias map from `manifest.aliases ∪ PLUGIN_SLUG_ALIASES`; add `load_listeners()`, `get_module_file(slug, name)`.
- `backend/app/plugins/decorators.py` — `_acceptable_plugin_slugs` consults the loader's alias map (single-hop preserved).
- `backend/app/api/v1/plugins.py` — add `GET /plugins/registry`, `GET /plugins/aliases`, `GET /plugins/<slug>/health`.
- `frontend/lib/plugins.tsx` — fetch aliases/labels from `GET /plugins/aliases`, keep the hardcoded table as offline fallback (kills the drift risk in dup audit §4 #2).

**Migrations** none.
**Compat** v1 manifests untouched on disk; every existing endpoint identical.
**Tests** contract test (47 manifests); `test_plugin_aliases.py` extended to assert manifest-declared aliases resolve both directions; snapshot test that `/plugins/sidebar` output is byte-identical before/after the `ui.nav` switch.

## Phase 1 — Config schema v2 (M)

**Create**
- `backend/app/plugins/config_schema.py` (§3.7), `backend/app/plugins/secrets.py` (Fernet encrypt/decrypt + rotation), `backend/app/plugins/config_migrations.py` (runner).
- `frontend/components/plugin-widgets/FormRenderer.tsx` + `fields/{ColorField,CronField,EntityPicker,MultiEnumField,ListField,SecretField,FileField}.tsx`.
- `backend/tests/test_config_schema.py`, `frontend/__tests__/form-renderer.test.tsx`.

**Modify**
- `backend/app/api/v1/plugins.py:812-885` — `GET /config` redacts secrets + role-filters; `PUT /config` validates → `422 {errors}`; `GET /config-schema` returns v2 + role filtering.
- `backend/app/plugins/config_store.py` — `resolve_config`, `plugin_secret`; `plugin_config_value` delegates to `resolve_config` so consumers stop hardcoding defaults.
- Rewrite the 5 existing `config_schema.yaml` files to v2 (adding `config_version` + a `config_migrations.py` where keys move) and add v2 schemas for `notices`, `exams`, `assignments`, `sms_notifications`, `timetable`.
- `frontend/app/dashboard/plugins/[slug]/settings/page.tsx` — delegate to `FormRenderer`, keep the generic key/value editor for unschema'd keys.

**Migrations** `plugin_config_audit` table; `SchoolPlugin.installed_version` column (nullable).
**Compat** plugins without a schema keep pass-through writes; existing configs read unchanged (defaults resolved, never written); `?replace=1` semantics preserved.
**Tests** unit: every field type coerce/reject, `visible_when` truth table, hidden-field pruning, secret never in GET, `entity-picker` cross-tenant rejection; migration idempotency (apply twice = same result); e2e: edit fees settings → reload → values persist; teacher cannot see gateway group (403 on write).

## Phase 2 — Theme tokens + parity lock (M/L)

**Create**
- `backend/app/themes/base.yaml` + `backend/app/themes/packs/<10 theme_key>.yaml` (generated by `backend/scripts/capture_theme_baseline.py`).
- `backend/app/services/theme/{resolver.py,validator.py,contrast.py}`, `backend/app/api/v1/themes.py` extensions (`GET/PUT/DELETE /themes/tokens`).
- `frontend/lib/theme/tokens.ts` (typed token document + `cssVars()`), `frontend/app/dashboard/settings/theme/page.tsx`.
- `aschool_shared/lib/theme/theme_from_tokens.dart`.
- `backend/tests/test_theme_baseline.py`, `frontend/__tests__/theme-parity.test.ts`, `tests/e2e/public-site-visual.spec.ts`.

**Modify**
- `frontend/themes/registry.ts` — palettes generated from the packs; `generateThemeCSS` untouched.
- `backend/app/services/website/theme_engine.py` — `THEMES` becomes a resolver read-through (keeps `list_themes`/`get_theme`/`generate_css`/`synced_colors`/`apply_theme` signatures so `website_builder.py`, `api/v1/themes.py` and the marketplace description hack at `plugins.py:294-304` keep working).
- `frontend/app/dashboard/layout.tsx` — emit dashboard CSS vars; wire `useAppStore.theme` → `<html class="dark">`.
- `backend/app/services/designer/pdf_css.py` — `pdf_theme_css(school_id)`.
- `aschool_shared/lib/theme/app_theme.dart` — accept tokens, keep constants as fallback.
- `frontend/tailwind.config.js` — add missing token-backed utilities (`font-nepali` → `font_devanagari`).

**Migrations** `theme_documents`, `school_theme_tokens`.
**Compat guarantee** public-site CSS byte-identical for all 10 themes (two unit tests + zero-threshold visual diff); `SchoolWebsite.theme_slug`/`customizations.colors` remain the write path; white-label precedence (`brand_colors`, `white_label.py:270-289`) unchanged.
**Tests** parity tests above; contrast validator unit tests; resolver layering test (plugin token cannot overwrite a core role; `public_site` contribution refused without `public_routes`); Flutter golden tests for light/dark from tokens; PDF snapshot (marksheet renders identical bytes modulo the new var block).

## Phase 3 — Widget contract, host + dashboard composition (L)

**Create**
- `backend/app/plugins/widgets.py` (load/validate/filter), `GET /plugins/widgets`, `backend/app/api/v1/dashboards.py` (`GET/PUT /dashboards/layout`).
- `frontend/lib/plugin-widgets/{registry.ts,types.ts,bindings.ts,usePluginWidgets.ts}`.
- `frontend/components/plugin-widgets/{PluginWidgetHost,WidgetSlot,WidgetFrame,WidgetSkeleton,WidgetError,WidgetEmpty}.tsx`.
- Generic renderers: `renderers/{StatCard,StatGroup,DataTablePanel,ChartPanel,ListPanel,FormPanel,DetailPanel,SettingsSection,QuickActionTile}.tsx`.
- Shared primitives the renderers need (also the widget audit's Tier-1 list): `components/ui/{data-table,skeleton,empty-state,error-state,confirm-dialog,pagination,status-pill,sheet}.tsx`, `components/charts/ChartKit.tsx`.
- `widgets.yaml` for the wave-1/2 plugins: `attendance`, `fees`, `notices`, `exams`, `assignments`, `library_management`, `white_label`, `biometric`.
- Tests: `backend/tests/test_plugin_widgets.py`, `frontend/__tests__/plugin-widget-host.test.tsx`, `tests/e2e/dashboard-widgets.spec.ts`.

**Modify**
- `frontend/app/dashboard/page.tsx` — replace the static KPI grid with `<WidgetSlot id="dashboard.main" />` + edit-layout mode (dnd-kit).
- `frontend/app/dashboard/students/[id]/page.tsx` — `<WidgetSlot id="student_profile.tab" context={{student_id}} />`.
- `frontend/app/dashboard/plugins/[slug]/page.tsx` — render the plugin's `plugin_page.main` widgets above the existing page content.
- `backend/app/api/v1/plugins.py` — widget payload cache invalidation on install/uninstall/config write.

**Migrations** `dashboard_layouts`.
**Compat** a plugin without `widgets.yaml` behaves exactly as today; the pre-existing dashboard cards ship as platform-default widgets so a school that never edits the layout sees the same content; unknown widget ids in a saved layout are skipped.
**Tests** unit: binding resolution (`$today`, `$context.*`, `$.a.b[0]`), unknown token renders nothing, error boundary contains a failing widget; API: widget filtered out when plugin inactive / permission missing / role mismatch, endpoint must belong to the declaring plugin; e2e: install a plugin → its widget appears; drag to reorder → persists across reload; uninstall → widget vanishes, layout intact.

## Phase 4 — TemplatePack unification (L)

**Create**
- `backend/app/services/templates/{registry.py,packs.py,render.py,variables.py}`.
- `backend/app/api/v1/templates.py` (pack CRUD/render/preview).
- `backend/app/templates/website_section/<17 types>/pack.yaml` (verbatim copies of `defaultContent` + `controls`).
- `backend/app/templates/notification/<N>/pack.yaml` for the ~15 messages currently inlined in `plugins/listeners.py`.
- `backend/scripts/migrate_templates.py` (designer_templates → template_packs; notification_templates → packs).
- Tests: `backend/tests/test_template_packs.py`, `frontend/__tests__/section-registry.test.ts`, `tests/e2e/website-sections.spec.ts`.

**Modify**
- `backend/app/services/designer/template_folders.py` → thin wrapper over `TemplateRegistry`.
- `backend/app/services/designer/template_engine.py` — `_ensure_seeded`/`list_templates_for_school`/`get_template` read the registry; the in-code `TEMPLATES` dict stays as the legacy layer (candidate for extraction to folders in phase 5).
- `backend/app/api/v1/design_studio.py:370-415,1233-1273` — proxy to the new endpoints.
- `frontend/lib/school-website/registry.ts` → fetch `GET /website/section-types` with the current static array as build-time fallback; `frontend/components/website/SectionRenderer.tsx:973-1019` → `SECTION_COMPONENTS` map.
- `backend/app/api/v1/website.py:254-306` — add `plugin_sections` to the public payload; seed `website_menus` from the hardcoded nav arrays.
- `backend/app/plugins/listeners.py` + `app/tasks/{sms_sender,push_notifications,fee_reminders,attendance_alerts}.py` — render through packs.
- `frontend/components/website/SchoolNavbar.tsx`, `frontend/app/school/[slug]/layout.tsx:165-174,300-335` — read menus from the API with the current arrays as fallback.

**Migrations** `template_packs` (+ `designer_templates` compatibility view), `website_menus`.
**Compat** rendered public site identical (section defaults and menus seeded from the current hardcoded values; zero-threshold visual diff again); designer UI unchanged; school template overrides preserved by the migration script (dry-run mode + row counts before/after).
**Tests** every one of the 40 designer packs renders to a PDF byte-comparable with pre-migration output; section-type list matches the old registry exactly (keys, defaults, controls); notification pack rendering matches the previous f-string output for each event; SMS segment-limit warnings fire for Devanagari overflow; e2e: edit a template → school override created → revert → platform default returns.

## Phase 5 — Mobile widgets + wave 3-6 plugin adoption (M/L, parallelizable)

**Create** `mobile.yaml` per plugin; `aschool_shared/lib/widgets/spec_widget.dart` + `spec_renderers/`; `MOBILE_SCREEN_REGISTRY` per app; `aschool_shared/test/spec_widget_test.dart`.
**Modify** `backend/app/api/v1/mobile.py:159-468` — build `visibility` from installed plugins' `mobile.yaml` instead of the hardcoded per-role rule lists, and add `widgets`; `aschool_shared/lib/services/plugin_provider.dart` — parse/cache widgets; `dynamic_bottom_nav.dart`, `app_drawer.dart` — read `surfaces`.
**Compat** bootstrap payload is a superset; a stale app binary ignores unknown fields and falls back to `module_screen_template.dart`. Golden test: bootstrap visibility for each of the 5 roles is identical to the current hardcoded output for a fully-provisioned school (this is the safety net for deleting ~300 lines of rules).
**Then** run waves 3-6 (§1.4c) — each plugin is a small PR: promote manifest, add `widgets.yaml`/`config_schema.yaml`/`i18n`, move routes into the folder with a re-export shim, add `tests/`.

## Cut lines

**Day 1** — `plugin_doctor.py` + `validator.py` + `test_plugin_contract.py` run over all 47 manifests and produce the error/warning table (this alone surfaces the ~20 broken pointers, the missing `ai_suite/__init__.py`, and every icon/section mismatch). Land `_normalize_manifest` behind the existing tests. Run `capture_theme_baseline.py` and commit the 10 theme packs plus the two parity tests **before** touching any theme code — the parity lock exists before anything can break it.

**Week 1** — Phase 0 merged (adapter, validator in CI, `/plugins/registry`, `/plugins/aliases`, frontend alias fetch). Phase 1 backend merged (`config_schema.py`, validating `PUT /config`, secret redaction) with `fees` + `attendance` rewritten to v2 as reference schemas. `FormRenderer` skeleton rendering those two schemas behind the existing settings route.

**Month 1** — Phases 0-2 complete and Phase 3 shipped for `dashboard.main` with 6-8 widgets across attendance/fees/notices/exams, editable layouts, and the shared `DataTable`/`ChartKit`/`StatCard`/`EmptyState`/`Skeleton` primitives in place. Theme tokens live on the dashboard (dark mode working) and in Flutter, with the public site provably unchanged. Phase 4 started with the website-section registry converted (design frozen by test) and notification packs replacing the inline strings in `listeners.py`.

## Risk register

| Risk | Mitigation |
|---|---|
| Public-site visual regression | baseline capture + 2 unit parity tests + zero-threshold visual diff, all landed before refactor; `surface_overrides.public_site` empty in phase 1 |
| Config migration corrupts a school's settings | pre-migration snapshot in `plugin_config_audit`; idempotent transforms; lazy per-school application; dry-run bulk endpoint |
| Widget payload becomes a performance drag | one cached fetch per (school, role, surface) with ETag; per-widget `cache_ttl_s`; server-side pagination mandatory for `table-panel` |
| Spec dialect grows into a private language | fixed type list, no expressions beyond binding tokens, `renderer: component` as the documented escape hatch; validator rejects unknown spec keys |
| Template migration loses school overrides | migration script with dry-run + row-count assertions; `designer_templates` kept as a view for one release; per-pack PDF byte comparison |
| Mobile clients break on the extended bootstrap | additive fields only; unknown tokens → template screen; golden test pinning current visibility output per role |
| Plugin restyles the public site | theme contributions namespaced, `applies_to` required, `public_site` needs `capabilities.public_routes`; validator enforces |






