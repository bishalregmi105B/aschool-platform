# D2 — Architecture & Engine Digest (implementation reference)
Date: 2026-09-05 · Status: digest of SPEC documents (nothing herein is implemented)

**Sources & citation shorthand** (all §-refs point back into these files):
- `PTTA` = `audits/research/PLUGIN_THEME_TEMPLATE_ARCHITECTURE.md` (1648 lines, §0–§6)
- `ATIB` = `audits/research/ATEACHER_INTEGRATION_BLUEPRINT.md` (1540 lines, §1–§11)
- `PUSA` = `audits/research/PLUGIN_UI_SPEC_ALL.md` (35 lines) — **UNFINISHED**, ends at `<!--APPEND-->` after §0 Conventions only; contains no per-plugin specs yet. Its §0 is nevertheless normative for screen archetypes, the 7-part screen contract, widget-record notation (`key · type · slot · endpoint · roles · size`), mobile app codes (A/T/St/P/U), endpoint marks (✔/⚠/✖) and priorities (P0–P3), and it declares that every widget record it will contain must be a legal `widgets.yaml` entry under PTTA §2.2 (`PUSA §0`).

Hard constraints inherited by any implementation (`PTTA §Hard constraints` 1–4): (1) public school website rendered design **must not change** — everything feeding it becomes data, pixels stay identical (mechanism + test in `PTTA §4.4`); (2) no big-bang rewrite — 39 module manifests + 8 legacy flat manifests are live, every step additive, reversible, compat-adapter-guarded; (3) filesystem stays the catalog source of truth (`loader.py:10-13`), `plugins` table stays a mirror (`loader.py:337-420`), v2 adds files never a seed; (4) gating semantics unchanged — `@plugin_required` + `g.installed_plugins` + single-hop non-transitive aliases (`decorators.py:56-117`).

Baseline gaps that shape everything (`PTTA §0`): only **5** plugins ship `config_schema.yaml` (attendance, fees, library_management, website_builder, whatsapp_bot) with a 4-kind dialect; **no plugin ships any UI** (39/39 module folders hold only `manifest.yaml`/`__init__.py`, 7 also `routes.py`+`hooks.py`); `backend/tests/test_plugin_manifests.py:9` validates only the 8 legacy manifests, which is how ~20 broken code pointers survived.

---

# A. PLUGIN PACKAGE v2 CONTRACT
## A.1 Folder layout (`PTTA §1.1`)
Root: `backend/app/plugins/modules/<slug>/`

| File / dir | Mandatory | Contract (`PTTA §1.2`) | Consumed by |
|---|---|---|---|
| `manifest.yaml` | **yes** | identity, pricing, deps, capabilities, surfaces (`PTTA §1.3`); the only file the loader reads eagerly | `PluginLoader._load_manifest`, `refresh_registry`, marketplace, sidebar |
| `__init__.py` | **yes** | makes the folder a real Python package (`ai_suite` violates this today; v2 validator fails on it) | Python import machinery |
| `config_schema.yaml` | no | `{schema_version, groups[], fields[]}` (`PTTA §3.2`) | `GET /plugins/<slug>/config-schema`, `PUT /config` validator, `FormRenderer` |
| `permissions.yaml` | no | `permissions: [{key, label, label_ne, description, default_roles[], implies[]}]` — declares keys, not roles | `@permission_required`, role editor UI, widget `requires_permissions` |
| `events.yaml` | no | `emits: [{name, payload:{field:type}, scope: school\|platform, async: bool}]`, `consumes: [{name, handler, order}]` | `register_plugin_events`, `listeners.py` autoload, docs generator, contract test |
| `widgets.yaml` | no | widget index + defaults (`PTTA §2.2`); long entries may live in `ui/widgets/*.yaml` | `GET /plugins/widgets`, `PluginWidgetHost`, dashboard composer |
| `mobile.yaml` | no | Flutter surfaces: modules, tabs, quick actions, cards (`PTTA §2.6`) | `GET /mobile/bootstrap` merge |
| `routes.py` | no | must expose `bp` or `<slug>_bp`; every route `@plugin_required("<slug>")` | `loader._register_manifest_blueprints` (`loader.py:234-260`) |
| `models.py` | no | SQLAlchemy models on `BaseModel`/`SchoolModel`; one owner per table (validator-enforced) | `hooks.activate` `create(checkfirst=True)`, alembic autogenerate |
| `hooks.py` | no | module-level `activate(db)`, `deactivate(db)`, `uninstall(db)`, **new** `upgrade(db, from_version)`; never raise | `_run_plugin_hook` (`api/v1/plugins.py:83-101`) |
| `listeners.py` | no | `@on("event")` handlers; imported once at startup when the module declares `consumes` | new `PluginLoader.load_listeners()` |
| `services/`, `tasks/` | no | packages, `__init__.py` + domain services (no Flask imports) / Celery tasks | manifest `capabilities.services`/`tasks` + beat schedule |
| `migrations/` | no | plugin-owned alembic `versions/*.py` with `depends_on` = platform head at authoring time | `alembic -x plugins=all upgrade head` (`PTTA §1.5`) |
| `seeds/` | no | idempotent `seed(db, school_id)` in `seeds/__init__.py` | `hooks.activate` |
| `templates/<pack_key>/` | no | `pack.yaml` + layout files + `assets/` (`PTTA §5.2`) | `TemplateRegistry.scan()` |
| `themes/<theme_key>.yaml` | no | `{theme_key, extends, tokens{}, applies_to[]}` (`PTTA §4.1`) | `ThemeRegistry.scan()` |
| `i18n/{en.json,ne.json}` | no | flat dotted keys, e.g. `{"widget.today_attendance.title": "…"}` | web `t()`, Flutter `S.of`, backend `gettext`-lite |
| `ui/widgets/<key>.yaml` | no | per-widget spec when the declaration is long | same as `widgets.yaml` |
| `ui/index.web.json` | no | `{widget_key: registry token}` — **tokens, not import paths**, e.g. `{"attendance_today": "attendance/TodayCard"}` | checked against `frontend/lib/plugin-widgets/registry.generated.ts` |
| `tests/` | no | plugin's own pytest package `tests/test_<slug>_*.py` | `pytest backend/app/plugins/modules` |
| `docs/`, `README.md` | no | long-form docs/screenshots; README = human contract (config keys, events, widgets, ownership) | contributors, marketplace long description |

Loader rules (`PTTA §1.1`): filenames are **fixed** (no manifest-declared alternates) so tooling stays file-pattern driven; absence of an optional file means "no such surface"; a file present but unparseable is a **validator error**, not a silent skip (today `loader._load_manifest`, `loader.py:140-144`, logs and returns, hiding typos); `manifest.yaml` may still point at code outside the folder during migration.

## A.2 `manifest.yaml` v2 — every key (`PTTA §1.3`)
| Key | Type | Req? | Consumer / note |
|---|---|---|---|
| `schema_version` | int | **required for v2** | absent or `1` → compat adapter (`PTTA §1.4a`); reported in `/plugins/registry` |
| `slug` | str | **required** | immutable PK; must equal folder name; loader discovery + validator |
| `name` / `name_nepali` | str | name required | registry mirror, marketplace, sidebar label fallback |
| `version` | semver str | required | drives `hooks.upgrade(db, from_version)` vs `SchoolPlugin.installed_version` |
| `author`, `homepage`, `description`, `description_nepali`, `emoji`, `tags[]`, `docs` | str / list | no | marketplace detail; `docs` is a relative path |
| `icon` | str | no | must exist in `frontend/components/layout/sidebar.tsx` `ICON_MAP` (warn on v1, error on v2) |
| `category` | enum `core\|starter\|growth\|premium\|add_on` | required | must match `Plugin.category` enum (`models/plugin.py:35-38`); `loader.refresh_registry` |
| `price_monthly`, `price_yearly`, `is_free`, `published`, `coming_soon`, `deprecated` | num / bool | no | `plugins` table mirror, billing, marketplace visibility |
| `trial_days` | int \| null | no | `null` = platform `PLUGIN_TRIAL_DAYS` wins (`billing.py:35-47`) |
| `supersedes[]` | list[slug] | no | replaces hardcoded `loader.SIDEBAR_SUPERSEDED_BY` (`loader.py:519-521`) |
| `aliases[]` | list[slug] | no | replaces hand-kept `PLUGIN_SLUG_ALIASES` (`decorators.py:13-53`) **and** `frontend/lib/plugins.tsx:55-80`; effective map = `manifest aliases ∪ hardcoded table`, still single-hop |
| `depends_on[]` | list[slug] | no | hard: install refused without these |
| `soft_depends_on[]`, `conflicts_with[]`, `min_platform_version` | list / str | no | optional feature lighting-up; install guard |
| `capabilities.api_blueprint`, `.models_module` | dotted module | no | blueprint mount (`loader.py:207-260`) / table create + alembic autogenerate; both validated by `loader._module_path_exists` (`loader.py:85-101`) |
| `capabilities.services[]`, `.tasks[]` | list[dotted] | no | code-pointer validation (`loader.py:104-134`) |
| `capabilities.beat_schedule[]` | `[{task, cron}]` | no | Celery beat entries owned by the plugin; fire only for schools with it active |
| `capabilities.socket_namespaces[]` | list[str] | no | socket.io namespaces the plugin opens |
| `capabilities.public_routes` | bool | no | true when it serves unauthenticated (public-site) data; **prerequisite for any `public_site` theme contribution** (`PTTA §4.1` layer 4) |
| `permissions_ref`, `events_ref`, `mobile_ref`, `ui.widgets_ref` | path | no | point at `permissions.yaml` / `events.yaml` / `mobile.yaml` / `widgets.yaml` |
| `roles_visible_to[]` | list[role] | no | coarse role gate for nav/widgets |
| `events.emits[]`, `events.consumes[]` | list[str] | no | inline summary kept for cheap introspection |
| `config_schema` | path (or `true`/absent) | no | `loader.py:169-184` accepts all three forms |
| `config_version` | int | no | bump triggers a stored-config migration (`PTTA §3.6`) |
| `ui.nav` | `{route, section, label, label_nepali, icon, order, visible_to[], requires_permissions[], subitems[{label,label_nepali,route,requires_permissions[]}]}` | no | **the only** nav source in v2: `get_frontend_sidebar` / `get_bottom_nav_items` (`loader.py:524-684`) read `ui.nav` for both manifest generations; `section` matches sidebar `PLUGIN_SECTION_ORDER` |
| `ui.settings_sections[]` | list[group key] | no | `config_schema` groups shown as own tabs |
| `mobile.{admin,teacher,parent,student}` | `{module, tabs[]}` | no | `GET /mobile/bootstrap` merge |
| `template_packs[]` | `[{key, path, kind}]`, kind ∈ `document\|website_section\|notification\|report\|calendar\|question_paper` | no | `TemplateRegistry.scan()` |
| `theme_contributions[]` | `[{key, path, applies_to[]}]` | no | `ThemeRegistry.scan()`; `applies_to` never includes `public_site` unless declared |
| `owns_tables[]` / `reads_tables[]` | list[table] | no | validator: exactly one owner per table (answers "who may drop this table"); reads are documentation |
| `health_check` | `module:callable` → `{"ok": bool, "detail": str, "checks": {}}` | no | `GET /plugins/<slug>/health` (superadmin) |
| `migrations` | folder \| null | no | null when the plugin owns no tables |
| `uninstall_policy` | `keep_data\|purge_config\|purge_all` (default `keep_data`) | no | uninstall hook behaviour |
| `i18n` | folder | no | `en.json` / `ne.json` |

Renames honoured by the adapter (old key still read): `frontend:` → `ui.nav`, `flutter:` → `mobile`, top-level `api_blueprint`/`models_module`/`services`/`tasks` → `capabilities.*`. **No v1 field is removed** (`PTTA §1.3`).

## A.3 Migration path for the 47 metadata-only shells (`PTTA §1.4`)
Unlock: **v2 is a superset**, so a v1 manifest is a valid v2 manifest once normalized. Three mechanisms, no plugin rewrite:

**(a) Compat adapter** — one ~60-line `_normalize_manifest(m, module_dir)` in `backend/app/plugins/loader.py`, applied to every scanned manifest, never mutating files: if `schema_version >= 2` → `_fill_v2_defaults`; else copy the four top-level code pointers into `capabilities`, fold `frontend.route`/`frontend.sidebar.*` into `ui.nav`, fold `flutter.<role>_app` into `mobile.<role>`, then set `schema_version = 1` (remembered, reported as v1 in `/plugins/registry`) and fill v2 defaults. Consequence: sidebar/bottom-nav read **only** `ui.nav`, so both manifest generations flow through one code path. `PLUGIN_SLUG_ALIASES` becomes the fallback for manifests without `aliases:`; `_acceptable_plugin_slugs` reads the merged map and stays single-hop, preserving the "no transitive unlock" property verbatim (`decorators.py:56-78`).

**(b) Validator** — `backend/app/plugins/validator.py` + `backend/tests/test_plugin_contract.py`, over all 47 manifests, returning `[(severity, slug, file, message)]`.

**(c) Six adoption waves**, each independently shippable (`PTTA §1.4c`). "Move code" = relocate `app/api/v1/<x>.py` into the module folder leaving a 2-line re-export shim — the pattern already proven for the seven module-resident plugins (`api/v1/__init__.py:39-49`).

| Wave | Plugins | Why first | Moves code? |
|---|---|---|---|
| 0 | validator + adapter only | zero plugin edits; makes the rest safe | no |
| 1 | `white_label`, `biometric`, `multi_branch`, `incident_management`, `disaster_management`, `ai_adaptive_learning` | already have in-folder `routes.py`+`hooks.py`; manifest promotion + `widgets.yaml` only | no |
| 2 | `attendance`, `fees`, `library_management`, `website_builder`, `whatsapp_bot` | already ship `config_schema.yaml` → become config-v2 + widget reference implementations | no (pointers stay `app.api.v1.*`) |
| 3 | `notices`, `exams`, `assignments`, `timetable`, `academics` | highest-traffic dashboards, biggest widget payoff | optional |
| 4 | `design_studio`, `basic_website` | own the TemplatePack + section-registry migration (`PTTA §5`) | templates only |
| 5 | remaining ~25 (`alumni`, `inventory`, `hr_payroll`, `gamification`, …) | mechanical, scriptable | no |
| 6 | 8 legacy flat manifests (`dashboard`, `students`, `teachers`, `users`, `hostel`, `marketplace_nav`, `plugins_nav`, `settings_core`) → `modules/` | retires the legacy dir | no |

Back-compat guarantees held throughout (`PTTA §1.4`): endpoint shapes unchanged; `SchoolPlugin.config` never rewritten except by an explicit versioned migration; a v1 manifest never becomes uninstallable; a plugin with no `widgets.yaml` renders exactly as today.

Migrations/ownership (`PTTA §1.5`): global alembic stays the schema authority — plugin `migrations/versions/*.py` are ordinary revisions picked up by adding the folder to `version_locations` in `backend/migrations/alembic.ini`, each with explicit `depends_on`. `hooks.activate` remains create-if-missing + seed (fail-soft contract at `api/v1/plugins.py:88-101` unchanged: hook failures logged, never fatal). `hooks.upgrade(db, from_version)` is new, called by `refresh_registry` when manifest `version` > new `SchoolPlugin.installed_version`.

## A.4 New/changed platform endpoints — all additive (`PTTA §1.6`)
| Method + path | Purpose |
|---|---|
| `GET /plugins/registry` | full normalized manifests (superadmin) incl. `schema_version` + validator status |
| `GET /plugins/<slug>/health` | runs `health_check` (superadmin) |
| `GET /plugins/widgets?surface=&role=` | all widget specs the caller may render (`PTTA §2.3`) |
| `GET /plugins/<slug>/config-schema` | **unchanged path**, now returns v2 dialect + `schema_version` (role-filtered) |
| `PUT /plugins/<slug>/config` | **unchanged path**, now schema-validated, secrets write-only (`PTTA §3.5`) |
| `GET /plugins/aliases` | alias + display-label map so `frontend/lib/plugins.tsx` stops hand-copying it |
| `GET /dashboards/layout?role=` · `PUT /dashboards/layout` | saved dashboard compositions (`PTTA §2.7`) |
| `GET /themes/tokens?scope=` | resolved theme document per school/surface (`PTTA §4.2`); also `PUT`/`DELETE` per `PTTA §6 Phase 2` |
| `GET /templates/packs?kind=` | unified template catalog (`PTTA §5.3`) |
| `POST /plugins/<slug>/migrate-config` | superadmin bulk stored-config migration (`PTTA §3.6`) |
| `GET /website/section-types` | data-driven section registry (`PTTA §5.5a`) |

## A.5 Validator rules — hard-fail vs warn (`PTTA §1.4b`)
| Check | v1 manifests | v2 manifests |
|---|---|---|
| `manifest.yaml` parses, has `slug`, folder name == slug | error | error |
| `__init__.py` exists (real Python package) | error | error |
| `category` in `Plugin.category` enum | error | error |
| `depends_on` / `conflicts_with` / `supersedes` / `aliases` resolve to known slugs | error | error |
| Every code pointer resolves on disk (`loader._module_path_exists`) | **warn** (≈20 known-broken) | **error** |
| `icon` present in sidebar `ICON_MAP` (`sidebar.tsx:81-160`) | warn | error |
| Referenced files exist (`config_schema`, `widgets_ref`, `mobile_ref`, `events_ref`, `permissions_ref`, template/theme paths) | error when declared | error |
| `owns_tables` claimed by exactly one plugin | warn | error |
| `config_schema.yaml` validates against the dialect (`PTTA §3`) | error | error |
| Each `widgets.yaml` entry has a resolvable renderer (registry token or `spec:`) | n/a | error |
| Route prefix collision between plugin blueprints | error | error |
| Every `@plugin_required` slug in the plugin's own routes == its slug or an alias | warn | error |

Additional validator duties stated elsewhere: missing `config_migrations` transform for a version gap = **load-time error** (`PTTA §3.6`); plugin theme tokens must be namespaced and may not overwrite a core role token, `applies_to` required, `public_site` requires `capabilities.public_routes` (`PTTA §4.1` layer 4); unknown spec keys in a widget spec are rejected (`PTTA §6 Risk register`); SMS segment overflow per locale is a **warning** (`PTTA §5.6`). CI: `pytest backend/tests/test_plugin_contract.py` fails the build on any error, warnings print a table. CLI: `python -m scripts.plugin_doctor [--fix-safe]` (`PTTA §6 Phase 0`).

---

# B. WIDGET CONTRACT
Principles (`PTTA §2.1`): **declare, don't inject** (widget = data + renderer token; plugins never ship frontend code the host `eval`s); **two renderer kinds** (`spec` = pure JSON drawn by generic host components, no deploy; `component` = token in a compile-time registry, for canvas/map/editor-grade UI); **slots are host property** (plugin asks for `dashboard.main`, host decides order/size/permission); **same declaration, three consumers** (Next.js, 4 Flutter apps, public website — each renders the subset in `surfaces:`); **gating is server-side** (a hidden widget is *absent*, not `display:none`).

## B.1 `widgets.yaml` schema (`PTTA §2.2`)
Top level: `schema_version: 1`, `widgets: [ … ]`. Per widget:

| Field | Type / allowed values | Meaning |
|---|---|---|
| `key` | str | unique within plugin; global id = `<slug>.<key>` |
| `title`, `description` | str | display |
| `title_i18n` | i18n key | resolved from `i18n/{en,ne}.json` |
| `type` | `dashboard-card` \| `stat-group` \| `table-panel` \| `chart` \| `list` \| `form` \| `detail-drawer` \| `settings-section` \| `quick-action` \| `mobile-card` \| `website-section` | selects the generic renderer in spec mode |
| `renderer` | `spec` \| `component` | spec → generic renderer for `type`; component → registry token |
| `component` | `"<plugin>/<Token>"` | required when `renderer: component`; must match `ui/index.web.json` |
| `surfaces[]` | `web` \| `mobile` \| `public_site` \| `pdf` | which consumers render it |
| `slots[]` | `{id, default?, order?, params_from?}` | placement requests; `default: true` = auto-placed on a fresh dashboard |
| `section_type` | str | for `website-section` widgets: registers a `SectionRenderer` type (`PTTA §5.5`) |
| `roles[]` | role names | role gate |
| `requires_permissions[]` | permission keys | permission gate (⊆ caller permissions) |
| `requires_plugins[]` | slugs | extra soft-deps; widget hidden if absent |
| `size` | `{default:{w,h}, min:{w,h}, breakpoints:{sm,md,xl:{w,h}}}` | grid units in a 12-col dashboard grid |
| `data.source` | `api` \| `socket` \| `static` \| `aggregate` | data acquisition mode |
| `data.endpoint` | path relative to `/api/v1` | **must be a GET route of this plugin** — validated against the plugin's own blueprint prefix at load time, so a widget cannot point at another plugin's API |
| `data.params` | map, binding tokens allowed | query params |
| `data.refresh` | `{mode: none\|poll\|socket\|on_focus, interval_s, socket_event}` | refresh policy |
| `data.cache_ttl_s` | int | client `staleTime` |
| `data.select` | dot-path | selection into the `ApiResponse` envelope (default `data`) |
| `data.pagination` | `{mode: server, page_param, size_param, default_size}` | mandatory server paging for `table-panel` |
| `data.sort` | `{mode: server, param, default}` | e.g. `default: "-date"` |
| `data.filters[]` | `{key, type, entity?, label, calendar?}` | e.g. `entity-picker` + `date-range` with `calendar: bs` |
| `data.public` | bool | public-site endpoints |
| `spec` | object | declarative body; shape per `type` — `items[]` (`{label, value, tone, icon, format}`), `columns[]` (`{key, label, sortable, width, link, format, map}`), `row_actions[]`, `bulk_actions[]`, `export{csv,print}`, `link{label,href}`, `layout` (mobile, e.g. `stat_row`), `tap{route}` |
| `config_schema.fields[]` | subset of the `PTTA §3` dialect | per-school widget customization |
| `states` | `{empty:{title,body,action}, error:{title,retry}, loading: skeleton\|spinner\|none, locked:{title,cta}}` | host-rendered states |
| `telemetry` | `{impression: bool, click: bool}` | analytics |

**Type → generic renderer mapping** (`PTTA §2.2`): `dashboard-card`/`stat-group` → `StatCard`/`StatGroup`; `table-panel` → `DataTable`; `chart` → `ChartKit` (line/bar/pie/donut/heat); `list` → `ListView`; `form` → `FormRenderer`; `detail-drawer` → `DetailPanel`; `settings-section` → `FormRenderer` over `config_schema`; `quick-action` → `QuickActionTile`; `mobile-card` → Flutter `SpecCard`; `website-section` → `SectionRenderer`.

**Slot catalogue — host-owned, closed set** (`PTTA §2.2`): `dashboard.main`, `dashboard.side`, `dashboard.wide`, `dashboard.actions`, `plugin_page.main`, `plugin_page.header`, `student_profile.tab`, `teacher_profile.tab`, `class_detail.tab`, `settings.section`, `plugin_settings.section`, `drawer`, `dialog`, `mobile.home`, `mobile.quick_actions`, `mobile.more`, `mobile.<module>.tab`, `website.section`, `pdf.block`. Adding a slot is deliberately a host change; plugins cannot invent render points. (`PUSA §0` repeats the same type and slot lists as the notation for its per-plugin widget records.)

**`$`-binding tokens** (`PTTA §2.2`): `$today`, `$now`, `$school_id`, `$school_slug`, `$user_id`, `$role`, `$context.<key>` (host-provided, e.g. a profile page's `student_id`), `$route.<param>`, `$config.<key>` (this widget's per-school config), `$.field` = dot-path into the fetched payload including `$.a.b[0].c`. Tokens are legal inside `data.endpoint`, `data.params` values, and `spec` value positions (e.g. `value: "$.present"`, `endpoint: /attendance/student/$context.student_id/summary`, `link: "/dashboard/students/$.student_id"`).

## B.2 `GET /plugins/widgets` payload (`PTTA §2.3`)
```jsonc
// GET /api/v1/plugins/widgets?surface=web&slot=dashboard.main
{ "success": true, "data": {
  "widgets": [
    { "id": "attendance.today_attendance", "plugin_slug": "attendance", "type": "stat-group",
      "renderer": "spec", "title": "Today's Attendance", "size": {...}, "data": {...},
      "spec": {...}, "states": {...}, "config": { "show_late": true, "scope": "my_classes" } }
  ],
  "layout": { "role": "teacher",
              "slots": { "dashboard.main": ["attendance.today_attendance", "fees.collections_today"] } },
  "registry_version": "2026-09-04T10:00:00Z"   // ETag/cache key
}}
```

Server-side filter order: plugin installed+active for `g.school_id` (reuses `g.installed_plugins`, alias-aware) → `roles` ∩ caller role → `requires_permissions` ⊆ caller permissions → `surfaces` contains requested surface → `requires_plugins` satisfied. Per-school widget config merged from `SchoolPlugin.config["widgets"][<key>]`. Cacheable per (school, role, surface) with the same 300 s TTL as `school:{id}:plugins` (`backend/app/__init__.py`); invalidated on install/uninstall/config write (`PTTA §6 Phase 3`).

## B.3 Host loading strategy — decision and rejections (`PTTA §2.4`)
| Option | Verdict | Reason |
|---|---|---|
| (a) Compile-time registry: `frontend/lib/plugin-widgets/registry.ts` maps token → `React.lazy(() => import(...))` | **CHOSEN as the mechanism** | type-safe, tree-shaken, no runtime code loading (no CSP/XSS surface), works with SSR/ISR and the existing single Next build, debuggable. Cost: adding a *component* widget needs a frontend deploy; registry kept in sync with `ui/index.web.json` by the validator |
| (b) Server-driven JSON specs rendered by generic renderers | **CHOSEN as the default authoring mode** | new widgets with **zero** frontend deploy (a school-visible change ships by editing YAML); one place to fix a11y/i18n/loading/empty states; mirrors to Flutter and PDF for free; the only feasible route for the 4 mobile apps. Cost: expressiveness ceiling (no fabric canvas, no Leaflet, no tiptap); needs a disciplined schema or it becomes a private templating language |
| (c) Module federation / remote ESM bundles loaded at runtime | **REJECTED** | Next 14 App Router + RSC support is poor; runtime remote JS in a multi-tenant SaaS is an XSS/supply-chain vector; version skew across React/Tailwind/query-client; SSR of remotes is painful; nobody outside the repo authors plugins today. Also a security call: plugins are first-party, the marketplace sells entitlements not third-party code, and remote JS would let one tenant's misconfiguration execute in another's dashboard |

Net: exactly one dynamic loader (the compile-time registry); the generic spec renderers are themselves entries in it; `renderer: spec` resolves to the generic renderer for its `type`, `renderer: component` to a plugin token. ~90% of widgets stay pure YAML. Precedent cited: `frontend/lib/school-website/registry.ts` already declares website sections as data with fixed controls while `SectionRenderer` holds the components.

## B.4 Web implementation sketch (`PTTA §2.5`)
Files and exports:
- `frontend/lib/plugin-widgets/registry.ts` — `WidgetProps = {widget, context, data}`; `SPEC_RENDERERS: Record<string, ComponentType<WidgetProps>>` keyed by widget `type` (`stat-group`→`StatGroup`, `dashboard-card`→`StatCard`, `table-panel`→`DataTablePanel`, `chart`→`ChartPanel`, `list`→`ListPanel`, `form`→`FormPanel`, `detail-drawer`→`DetailPanel`, `settings-section`→`SettingsSection`, `quick-action`→`QuickActionTile`); `COMPONENT_REGISTRY` keyed `"<plugin>/<Token>"` via `next/dynamic` (examples: `attendance/Heatmap`, `fees/CollectionSparkline`, `gps_tracking/LiveMap` with `{ssr:false}`, `design_studio/TemplateGallery`); `resolveRenderer(w)` returns the component or `null`.
- `frontend/components/plugin-widgets/PluginWidgetHost.tsx` — resolves renderer, `resolveBindings(src.params, {context, config})`, `useQuery({queryKey:["plugin-widget", widget.id, params], staleTime: cache_ttl_s*1000, refetchInterval: poll ? interval_s*1000 : false})`, `selectPath(res.data, src.select ?? "data")`, `useWidgetSocket(widget, refetch)` (no-op unless `refresh.mode === "socket"`). Unknown token → render nothing, log once. Loading → `WidgetSkeleton`; error → `WidgetError` with retry; empty → `WidgetEmpty`.
- `WidgetSlot({id, context})` — reads `usePluginWidgets("web")` (one cached fetch per session) and renders `layout.slots[id]` in order, skipping ids absent from the payload.
- `WidgetFrame` owns the React error boundary, title/i18n, per-widget overflow menu (configure/hide/refresh) and grid sizing, so a broken widget degrades to a card with an error, never a blank dashboard.
- Other files: `frontend/lib/plugin-widgets/{types.ts,bindings.ts,usePluginWidgets.ts}`; `components/plugin-widgets/{WidgetSkeleton,WidgetError,WidgetEmpty}.tsx`; `renderers/{StatCard,StatGroup,DataTablePanel,ChartPanel,ListPanel,FormPanel,DetailPanel,SettingsSection,QuickActionTile}.tsx`; shared primitives `components/ui/{data-table,skeleton,empty-state,error-state,confirm-dialog,pagination,status-pill,sheet}.tsx` + `components/charts/ChartKit.tsx` (`PTTA §6 Phase 3`).
- Renderer semantics: `StatGroup` filters `spec.items` by widget config, formats via `formatValue(selectPath(data, item.value), item.format)` with formats `percent|npr|int|bs_date`; `DataTablePanel` maps `spec.columns` onto the shared `DataTable` with cell renderers `status_pill|bs_date|npr|link|avatar` and server paging/sort/filters, `row_actions`/`bulk_actions` → row menu + bulk bar; `ChartPanel` maps `spec.chart` onto recharts wrappers reading theme tokens (`PTTA §4`); `FormPanel` reuses the `PTTA §3.8` `FormRenderer` verbatim — a widget-scoped form and a plugin settings screen are the same code.

## B.5 Flutter side (`PTTA §2.6`)
Mobile already consumes a server-driven nav document (`_visibility_for_role`, `backend/app/api/v1/mobile.py:159-468`, returning `modules`, `quick_actions`, `more_actions`, `drawer_sections`, `bottom_tabs`; gating via `PluginState.canAccess`, `aschool_shared/lib/services/plugin_provider.dart:38-41`). v2 **extends the same document** rather than adding a second channel — the reason server-driven-by-default was chosen for web.

`mobile.yaml`: `schema_version: 1`; `modules[]` = `{key, label, label_ne, icon (Material name, registry-checked), roles[], route, screen: registry|spec, screen_token, tabs: {role: [...]}, surfaces: {bottom_tab:{roles,order}, quick_action:{roles,order}, drawer_section: <name>}}`; `cards[]` = `{widget: "<plugin>.<widget_key>", roles[], slot, order}` pointing at `widgets.yaml` entries (spec-rendered home cards, no app release needed).

`GET /mobile/bootstrap` gains a `widgets: [...]` array (same records as web, filtered to `surfaces: [mobile]`) plus `modules`/`surfaces` merged from every installed plugin's `mobile.yaml`, replacing the hardcoded per-role rule lists. Client side in `aschool_shared`: `PluginState` gains `widgets` (parsed + cached in secure storage beside the existing plugin cache so offline start still renders); **`SpecWidget`** = Flutter twin of `PluginWidgetHost` (fetch → bind → render via `Map<String, SpecRenderer>` for `stat_row`, `list`, `table`, `chart`, `kpi`, `progress`, reusing `stat_card.dart`, `paginated_list.dart`, `no_data_container.dart`, `error_container.dart`, `loading_shimmer.dart`, `shimmer_loading_list.dart`); **`MOBILE_SCREEN_REGISTRY`** = `Map<String, WidgetBuilder>` per app for `screen: registry` modules, unknown tokens falling back to `module_screen_template.dart` so an older binary degrades instead of crashing; nav generated from bootstrap (`dynamic_bottom_nav.dart`, `app_drawer.dart` just read the new `surfaces` block). Net rule: a new mobile **card** ships by editing YAML; a new mobile **screen** requires an app release, which is now explicit.

## B.6 Dashboard composition rules (`PTTA §2.7`)
New table `dashboard_layouts`: `id uuid`, `school_id uuid FK nullable` (NULL = platform default), `role varchar(50)` (`school_admin`/`teacher`/`parent`/`student`/`accountant`), `user_id uuid FK nullable` (non-NULL = personal override), `surface varchar(50)` (`web_dashboard`, `mobile_home`), `slots JSONB` (`{"dashboard.main":[{"id":"attendance.today_attendance","w":6,"h":2,"x":0,"y":0}]}`), `is_default bool`, unique (`school_id`,`role`,`user_id`,`surface`).

Resolution order — first hit wins per slot, then merge: **user override → school+role layout → platform+role default → widget declarations' `slots[].default` + `order`**. So a school that never edits sees a sane auto-composed layout, and installing a plugin appends its `default: true` widgets to the end of the target slot without editing any layout row.

Editing: `/dashboard` gains "Edit layout" mode — dnd-kit drag/resize in a 12-column grid, add-widget palette of available-but-unplaced widgets grouped by plugin, per-widget config popover rendered by `FormRenderer` from `widgets.yaml → config_schema`, Reset-to-default. `PUT /dashboards/layout` persists; role-scoped saves need `dashboard.manage_layout` permission, personal saves need none. Uninstall behaviour: layouts **keep** unknown widget ids (the plugin may return) and `WidgetSlot` skips ids missing from the payload, mirroring the platform's soft-uninstall convention.

---

# C. CONFIG / SETTINGS v2
## C.1 Where v1 stops (`PTTA §3.1`)
`config_schema.yaml` today is a flat `fields: [{key, label, type, default, help, min}]` list with **four** types — `string`, `number`, `boolean`, `json` (see `modules/whatsapp_bot/config_schema.yaml:6-41`). The loader just returns the list (`loader.py:293-313`); the API does **no** schema validation on write — `PUT /plugins/<slug>/config` only checks "is a JSON object", ≤16 KB, and the reserved `last_payment` key (`api/v1/plugins.py:829-885`). The form maps values to text/number/switch/JSON-textarea (`frontend/app/dashboard/plugins/[slug]/settings/page.tsx:47-100`). Concrete consequences: no enums, no groups, no conditional fields, **no secret handling (an API key is echoed by `GET /config`)**, no server-side type enforcement, and defaults duplicated between YAML and consumer code (`library_management/config_schema.yaml:1-6` documents that duplication as a maintenance rule).

## C.2 Dialect v2 (`PTTA §3.2`)
Document: `schema_version: 2`, `config_version: <int>`, `title`, `description`, `groups[]`, `fields[]`.
`groups[]` = `{key, label, label_ne, description, icon, collapsed, roles[]}` — ordered; rendered as tabs when >2, else fieldsets; a group's `roles` hides it entirely for other roles.

**Field types** (18) — stored form / control / server validation:

| type | Stored as | Control | Server validation |
|---|---|---|---|
| `string` | str | Input (`multiline: true` → Textarea) | length, `pattern` regex, `format` (email/phone/url/slug) |
| `text` | str | Textarea | length |
| `int` / `number` | int / float | number Input + `unit` suffix | min/max, `step` |
| `boolean` | bool | Switch | strict bool (must be true/false) |
| `enum` | str | Select (>8 options → searchable) | value ∈ options; `requires_plugins` honoured |
| `multi-enum` | list[str] | checkbox group / TagPicker | subset of options; `min_items`/`max_items` |
| `color` | str | colour picker + hex input | hex or colour-word allowlist (reuses `_is_safe_color`, `theme_engine.py:17-25`) |
| `color-map` | dict[str,str] | per-key colour row | keys ⊆ declared `keys`, each value colour-validated |
| `file` | `{id, url, name, size}` | FilePicker/dropzone | mime ∈ `accept`, size ≤ `max_size_mb`, tenant-scoped id |
| `secret` | encrypted str (`PTTA §3.5`) | password Input with "Replace" affordance | length/pattern; **never echoed** |
| `cron` | str | cron builder + raw field with human preview | 5-field cron parse |
| `time` / `date` / `bs_date` | `"HH:MM"` / ISO / BS str | time input / `BSDateInput` | format parse |
| `json` | any | JSON textarea with parse feedback | valid JSON, optional `json_schema` |
| `entity-picker` | id str (or list when `multiple`) | searchable async Select | id exists **and is tenant-scoped** |
| `list` | list[dict] | repeatable subform over `item_fields` | per-item recursion, min/max items |
| `markdown` | str | small rich editor | length; sanitized on read for display |

**Field attributes** (`PTTA §3.2`): `key` (dot path into `SchoolPlugin.config`), `group`, `type`, `label`, `label_ne`, `help`, `help_ne`, `placeholder`, `default`, `unit`, `validate{}`, `visible_when{}`, `enabled_when{}`, `roles[]`, `requires_plugins[]`, `advanced` (behind "Show advanced"), `readonly`, `deprecated`, `order`, `i18n_key`, plus type-specific `options`, `entity`, `entity_filter`, `accept`, `max_size_mb`, `storage`, `keys`, `item_fields`, `multiple`, `multiline`, `pattern`, `format`, `write_only`, `json_schema`.

**Visibility rules.** `visible_when: {field: <key>, eq|ne|in|gt|lt|truthy: <value>}` with composites `all_of: [...]` / `any_of: [...]`. Evaluated on **both** sides: the client hides the control live, and the server validator **drops** hidden fields' values instead of validating them, so a disabled feature never blocks a save (`_cond_met`, `visible_fields` in `PTTA §3.7`; `in` is membership either way — scalar-in-list or list-intersects-list). Per-role visibility via `roles[]` on field or group: `GET /config-schema` filters by caller role, `GET /config` filters returned keys, and **writes to fields the caller cannot see are rejected 403**.

**Coercion/validation contract** (`backend/app/plugins/config_schema.py`, `PTTA §3.7`): `validate_config(schema, payload, role, installed, stored) -> (errors_by_key, merged_config)` **never partially applies** — errors non-empty ⇒ nothing applied; returns a field-keyed error dict for inline form rendering. Sequence: deep-copy stored → deep-merge payload (so `visible_when` sees new values) → compute `allowed = visible_fields(...)` → per flattened dotted key: unknown/not-editable → error, `readonly` → error, `secret` + `None` → explicit clear, else `_coerce(f, value)` catching `FieldError(key, message)`; then prune hidden known keys from the result; then stamp `result["__config_version__"] = schema.config_version`. `load_schema(slug)` structurally validates and caches: unknown `type` → error, duplicate `key` → error, `enum`/`multi-enum` without `options` → error, `entity-picker` without `entity` → error, `list` without `item_fields` → error; a v1 schema is upgraded in memory by `_upgrade_v1_schema`. Regexes: `_HEX = ^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`, `_CRON = ^(\S+\s+){4}\S+$`. `entity-picker` calls `entity_exists_for_school(entity, value, g.school_id, entity_filter)` which blocks cross-tenant ids. `resolve_config(slug, school_id, role)` = schema defaults ← stored values (defaults resolved at read time, never written; unknown keys preserved via `deep_merge`), and it is what kills the documented defaults-duplication rule; `plugin_config_value` (`config_store.py:49-55`) delegates to it.

Route deltas (`PTTA §3.7`): `PUT /plugins/<slug>/config` keeps its 16 KB cap, reserved-key check and `?replace=1` semantics, inserting `errors, merged = validate_config(...)` before assignment and returning `422 {"errors": {...}}` on failure. Plugins without a schema keep today's pass-through behaviour.

## C.3 Secret handling (`PTTA §3.5`)
- Storage: `SchoolPlugin.config[<path>] = {"__secret__": true, "cipher": "<fernet>", "last4": "abcd", "updated_at": "..."}`, encrypted with platform key `SECRET_CONFIG_KEY` (env; rotate via a `key_id` field). Plaintext never lands in JSONB.
- `GET /plugins/<slug>/config` returns `{"__secret__": true, "set": true, "last4": "abcd"}` — never the value. The existing GET (`api/v1/plugins.py:812-826`) is patched to redact before serialization, so even legacy plaintext values written before v2 stop leaking.
- `PUT` semantics: **absent key = unchanged; `null` = clear; string = re-encrypt.** Form shows "Set ••••abcd — Replace".
- Consumer read path: `config_store.plugin_secret(school_id, slug, path)` decrypts on demand and never logs; `plugin_config_value` returns the redaction marker for secret paths so an accidental log line cannot print a key.
- Audit: every secret write appends `{path, actor_id, at}` to an append-only `plugin_config_audit` table (secret values excluded).

## C.4 Stored-config migration (`PTTA §3.6`)
Adding fields is safe by construction (defaults resolved at read time by `resolve_config`), so migrations are needed **only for renames/reshapes**. Mechanism: `config_version` in the schema + `SchoolPlugin.config["__config_version__"]` on the row; each plugin ships `backend/app/plugins/modules/<slug>/config_migrations.py` with `MIGRATIONS = {version: lambda cfg -> cfg}` transforms (example given for `fees` versions 2→4). Runner: **lazy on first read/write per school** via `ensure_config_version(school_id, slug)`, plus a superadmin bulk pass `POST /plugins/<slug>/migrate-config`. Each step must be idempotent; pre-migration config is snapshotted into `plugin_config_audit` so a bad transform is recoverable; a **missing transform for a version gap is a validator error at load time**, not a runtime surprise.

## C.5 Generic form renderer (`PTTA §3.8`)
`frontend/components/plugin-widgets/FormRenderer.tsx` replaces the bespoke logic in `app/dashboard/plugins/[slug]/settings/page.tsx`:
- Input `{schema, values, onChange, role, errors}`; output a dot-path patch plus client-side validation mirroring the server rules (`visible_when` evaluated in the browser so controls appear/disappear live).
- One control component per type, built on existing primitives `Input`, `Textarea`, `Switch`, `Select`, `Checkbox` group, `BSDateInput`, `FilePicker`, plus new `ColorField`, `CronField`, `EntityPicker` (Phase 1 also lists `MultiEnumField`, `ListField`, `SecretField`, `FileField` — `PTTA §6 Phase 1`).
- Groups → `Tabs` when >2 else fieldsets; `advanced: true` behind a "Show advanced" disclosure; save is a single `PUT ...?replace=1` with server errors mapped onto fields by key.
- Unknown/extra config keys keep today's generic key-value editor at the bottom, so a partially-migrated plugin stays fully editable.
- **One form engine, three entry points**: plugin settings screen, `settings-section` widgets, and widget-level `config_schema` popovers (`PTTA §2.7`).

---

# D. THEME ARCHITECTURE
## D.1 One token document → four consumers (`PTTA §4.1`)
Today four unrelated theme systems exist: public-site palette duplicated in `backend/app/services/website/theme_engine.py:35-106` **and** `frontend/themes/registry.ts:34-125` (10 themes, 5 colours + 2 fonts each); dashboard HSL CSS variables in `frontend/app/globals.css:5-84` + `tailwind.config.js` (dark tokens are dead code — no toggle); admin-app branding in `School.settings["white_label"]["theme"]` with its own 7 keys (`services/website/white_label.py:33-62`); Flutter's hardcoded `ASchoolTheme` (`aschool_shared/lib/theme/app_theme.dart:17-31`).

v2 introduces one validated **theme document** (`aschool.theme/1`), resolved per (school, surface, mode). **The four consumers named by the report** (`PTTA §4.2` delivery table): **(1) public site**, **(2) web dashboard**, **(3) Flutter mobile**, **(4) PDF/WeasyPrint** — with a fifth delivery target, the **designer canvas**, also listed. `applies_to` enumerates `[public_site, web_dashboard, mobile, pdf, designer]`.

Token taxonomy (`PTTA §4.1`): document keys `theme_key`, `name`, `extends` (base theme key), `tier` (`free|pro`, marketplace gating as today), `applies_to[]`, `tokens{}`, `modes{}`, `surface_overrides{}`.
- `tokens.color` — **roles, not names**: `primary`, `primary_dark`, `primary_fg`, `secondary`, `secondary_fg`, `accent`, `accent_fg`, `bg`, `surface`, `surface_alt`, `text`, `text_muted`, `border`, `success`, `warning`, `danger`, `info`, `focus_ring`, `overlay`.
- `tokens.typography` — `font_heading`, `font_body`, `font_devanagari`, `font_mono`, `scale{xs..4xl}`, `weight{normal,medium,semibold,bold}`, `line_height{tight,normal,relaxed}`, `devanagari_line_height` (1.75).
- `tokens.spacing{unit,xs..3xl}`, `tokens.radius{none,sm,md,lg,xl,full}`, `tokens.elevation{sm,md,lg}`, `tokens.motion{fast,normal,slow,easing}`, `tokens.layout{container_max, sidebar_w, sidebar_collapsed_w, header_h}`.
- `modes.dark` = sparse override map (absent = derive). `surface_overrides.<surface>` = per-surface deltas (example keeps today's forest green for `web_dashboard`, Devanagari body font for `pdf`).

Layering, lowest → highest precedence (`PTTA §4.1`): 1 platform base `backend/app/themes/base.yaml` → 2 theme pack (one of the 10 website themes or a plugin theme, `extends` allowed) → 3 `surface_overrides.<surface>` inside the pack → 4 **plugin contributions: additive, namespaced tokens only** (may add `color.plugin.attendance.present`, **cannot** overwrite a core role token; `applies_to` must list the surface; `public_site` additionally requires `capabilities.public_routes`) → 5 school white-label (`School.settings["white_label"]`, `SchoolWebsite.customizations`) → 6 mode light/dark → 7 per-school explicit token overrides in the new `school_theme_tokens` table.

Storage (`PTTA §4.1`): `theme_documents` (`id, theme_key uniq, name, tier, extends, applies_to text[], tokens JSONB, modes JSONB, surface_overrides JSONB, version, source ('file'|'db'), is_published`) — platform packs mirrored from files, filesystem is truth; `school_theme_tokens` (`id, school_id, surface, mode, tokens JSONB sparse override, updated_by, is_published, draft JSONB`). Existing columns keep working: `SchoolWebsite.theme_slug` still selects the pack, `SchoolWebsite.customizations["colors"]` still holds the five core colours the public layout reads — the resolver treats them as layer 5, not the whole story.

## D.2 Resolution and delivery (`PTTA §4.2`)
`backend/app/services/theme/resolver.py::resolve_theme(school_id, surface, mode="light") -> dict` — fully-merged document, cached per (school, surface, mode) 300 s, invalidated on any white-label / website-config / theme write. `GET /themes/tokens?surface=web_dashboard&mode=light` returns `{tokens, css_vars, theme_key, version, etag}`.

| Consumer | Delivery |
|---|---|
| Public site (`frontend/app/school/[slug]/layout.tsx`) | **unchanged path**: `getThemeById(themeSlug)` + `generateThemeCSS(theme, sanitizeColorOverrides(...))` into the nested `<style>`. Phase 2: `frontend/themes/registry.ts` stops hardcoding the 10 palettes and is generated from the resolved document, so the emitted CSS text is **byte-identical** (`PTTA §4.4`) |
| Web dashboard | server component reads `resolve_theme(school, "web_dashboard", mode)` and emits `:root{--primary:…}` in `app/dashboard/layout.tsx`; Tailwind keeps consuming `hsl(var(--primary))` (no class churn); dark mode finally works via `<html class="dark">` toggled by the already-existing-but-unused `useAppStore.theme` |
| Flutter | `GET /themes/tokens?surface=mobile` on bootstrap, cached in secure storage; new `ASchoolTheme.fromTokens(json)` builds `ThemeData` (ColorScheme, TextTheme with Devanagari fallback, radii, elevations); current hardcoded constants become the offline/first-run default; `themeModeProvider` already handles light/dark/system |
| PDF (WeasyPrint) | `services/designer/pdf_css.py` gains `pdf_theme_css(school_id)` emitting the same variables plus the existing `@font-face` Devanagari block; `wrap_pdf_html` prepends it, so documents use `var(--color-primary)` instead of hardcoded `#1e40af` literals in `template_engine.py` |
| Designer canvas | `GET /themes/tokens?surface=designer` feeds a palette swatch row + token-aware defaults for new elements; **existing saved canvases keep their literal colours** (no retro-theming of saved documents — that would change printed output) |

## D.3 Devanagari / typography requirements (`PTTA §4.3`)
- `font_devanagari` is a first-class token resolved on all four surfaces. Web: font stack ends with it and `.font-nepali` maps to it (fixing the declared-but-never-loaded `--font-mukta`). PDF: already installed system-wide in the Docker image and embedded via `@font-face` (`pdf_css.py:14-29`). Flutter: `TextTheme` `fontFamilyFallback`.
- `devanagari_line_height` (1.75) exists because Devanagari clips at Latin leading; renderers apply it when the string contains Devanagari codepoints **or** the active locale is `ne`.
- Type scale is token-driven so the density presets already in the white-label theme keys (`comfortable|compact|spacious`) become a scale multiplier instead of per-component classes.
- Related: SMS/Devanagari cost safety is handled in template packs (UCS-2, 70 chars/segment — `PTTA §5.6`); `tailwind.config.js` gains token-backed utilities (`font-nepali` → `font_devanagari`, `PTTA §6 Phase 2`).

## D.4 THE PUBLIC-SITE PARITY LOCK (`PTTA §4.4`, hard constraint #1)
Constraint as stated (`PTTA §Hard constraints` 1): **"The public school website's rendered design must not change. Everything feeding it becomes data; the pixels stay identical."** `PTTA §4.4` is titled "CRITICAL: the public site must look identical" and its mechanism is **baseline capture + byte-equality test**, in five parts:

1. **Capture.** One-off `backend/scripts/capture_theme_baseline.py` reads today's truth — `ThemeEngineService.THEMES` (`theme_engine.py:35-106`) **and** `frontend/themes/registry.ts` — *asserting they agree*; any divergence is reported and resolved **before proceeding**. It writes 10 files `backend/app/themes/packs/<theme_key>.yaml` whose `tokens.color.{primary,secondary,accent,bg,text}` and `tokens.typography.{font_heading,font_body}` are the **exact current values**. Additional token roles come from `base.yaml` and are *not referenced by any public-site CSS in phase 1*.
2. **Same emitter.** `generateThemeCSS` (`frontend/themes/registry.ts:138-149`) continues to emit **exactly seven declarations in the same order**. The resolver may only change *where the seven values come from*, never the emitted text shape. `DEFAULT_THEME_ID = "global-elearning"` preserved on both sides (`theme_engine.py:33`, `registry.ts:131`).
3. **Equality tests, both directions** — (a) backend `tests/test_theme_baseline.py`: for each of the 10 theme ids, `resolve_theme(None, "public_site")["css_vars"]` **== string-compared ==** `ThemeEngineService.generate_css(theme_id)` variable block; (b) frontend `__tests__/theme-parity.test.ts`: `generateThemeCSS(getThemeById(id))` for all 10 ids matches a snapshot committed **before** any change; (c) **Playwright visual diff on `/school/<slug>` for 3 schools × 3 viewports, threshold 0**, run before/after the theme refactor lands.
4. **No new tokens reach the public site in phase 1.** `surface_overrides.public_site` starts **empty**; the public `<style>` block keeps exactly `themeCss + surfaceOverride + customCss + 2 resets` (`layout.tsx:229-239`). Extra tokens ship only when a section component is explicitly changed to consume them — a separate, visible decision.
5. **Section defaults frozen.** The section-registry migration (`PTTA §5.5`) copies `defaultContent` **verbatim** from `frontend/lib/school-website/registry.ts`, and the fallback hardcoded homepage layout (`app/school/[slug]/page.tsx:106+`) stays as the no-sections path until a school opts into a section-based page. Menus are likewise **seeded from exactly the current hardcoded arrays** so rendered menus are identical until an admin edits them (`PTTA §5.5c`).

Divergence path for a school, safe by construction (`PTTA §4.4`): every value passes three existing gates — server-side hex/colour-word allowlist (`_is_safe_color`, `theme_engine.py:17-25`; `_HEX_COLOR_RE`, `white_label.py:32`), the same allowlist client-side (`sanitizeColorOverrides`, `frontend/lib/sanitize.ts:134-147`), and `sanitizeCss` for custom CSS (`sanitize.ts:101-119`) — plus four v2 additions: **contrast validation** (WCAG AA 4.5:1 body, 3:1 large text/UI computed per fg/bg pair; failures are a *blocking* error in the theming UI with a "nearest passing shade" suggestion), **derived-token generation** (`primary_dark`, `primary_fg`, hover/active derived from the chosen primary), **token allowlist per role** (a school may override colour/typography/radius/density; may **not** override layout or motion tokens or inject arbitrary keys), and **draft + publish** (`school_theme_tokens.draft` holds unpublished edits; the public site reads only published tokens, matching the existing `SchoolWebsite.draft_config`/`is_published` pattern).

Phase-2 compat guarantee restated (`PTTA §6 Phase 2`): "public-site CSS byte-identical for all 10 themes (two unit tests + zero-threshold visual diff); `SchoolWebsite.theme_slug`/`customizations.colors` remain the write path; white-label precedence (`brand_colors`, `white_label.py:270-289`) unchanged." Cut-line ordering (`PTTA §6 Cut lines`, Day 1): run `capture_theme_baseline.py` and commit the 10 packs **plus the two parity tests before touching any theme code — the parity lock exists before anything can break it.**

## D.5 Admin theming UI (`PTTA §4.5`)
`/dashboard/settings/theme`, extending today's white-label branding + website-design screens: **preset gallery** (10 packs, live thumbnails, free/pro badges honouring existing tier gating); **token editor** (grouped colour/typography/shape/density controls rendered by the `PTTA §3.8` `FormRenderer` over a platform-owned theme schema, so the theming UI is not a bespoke form); **live preview** (split view with a dashboard mock and a public-site mock in an iframe fed by draft tokens; a "Public site" tab makes the *no visual change by default* promise verifiable by the school); **contrast panel** (per-pair AA/AAA badges, failing pairs listed); **scope switch** (Public site / Dashboard / Mobile, so a school can restyle its dashboard without touching its website); **reset** per-token / per-group / whole-surface (`DELETE /themes/tokens?surface=`); **export/import** of token JSON for multi-branch chains, validated through the same gates.

---

# E. TEMPLATE ARCHITECTURE
## E.1 The six template systems that exist today (`PTTA §5.1`)
| # | System | Storage | Catalog source (where it lives) | Renderer |
|---|---|---|---|---|
| 1 | Designer documents (ID cards, certificates, marksheets…) | `designer_templates` (`models/designer_template.py:12-33`) + `designer_documents` | 40 folders `backend/app/templates/designer/<key>/` scanned by `services/designer/template_folders.py:96-120`, **merged with** a 2272-line in-code `TEMPLATES` dict (`template_engine.py:898+`), seeded to DB (`template_engine.py:1183-1305`) | fabric canvas (web) / `document_renderer.py` → WeasyPrint |
| 2 | Website sections | `WebsitePage.sections` JSONB (`models/website.py:18`) | `frontend/lib/school-website/registry.ts` (17 types, `defaultContent` + `controls`) | `SectionRenderer.tsx:973-1019` switch |
| 3 | Website page presets | none (applied into sections) | `frontend/lib/school-website/templates.ts` (3 presets) | same as #2 |
| 4 | Website themes | `SchoolWebsite.theme_slug` / unused `website_themes` table (`models/website.py:30-42`) | duplicated registries (`PTTA §4.1`) | CSS vars |
| 5 | Notification templates | `notification_templates` (`models/notification.py:79-87`: `channel, template_en, template_ne, variables`) | none — schools create their own | string interpolation in sms/communications |
| 6 | Calendars / question papers | folders + generator scripts (`tools_gen_calendar_templates.py`, `tools_gen_nepal_school_templates.py`, `tools_redesign_nepal_templates.py`) | ad hoc | designer / writer |

Shared shape across all six: identity + metadata + variables + layout body + optional assets + ownership (platform vs school); only the layout format and renderer differ. `template_folders.py:1-22` already documents the right philosophy ("the FILESYSTEM is the source of truth… the DB only stores per-school user edits") — v2 generalizes exactly that.

## E.2 TemplatePack spec / `pack.yaml` (`PTTA §5.2`)
Folder: `<owner>/templates/<pack_key>/` containing `pack.yaml`, `layout.<ext>` (`canvas.json | writer.json | section.json | body.md | body.html`), optional `layout.ne.<ext>` locale variant, optional `print.json` (print vs screen variant), `preview.png` (generated if absent by `thumbnails.py`), `assets/` (referenced by relative path). `owner` ∈ platform (`backend/app/templates/<kind>/`), plugin-shipped (`backend/app/plugins/modules/<slug>/templates/`), or a DB row (school-authored/overridden).

`pack.yaml` keys: `schema_version: 1`; `pack_key` (unique within `kind`; global id `<kind>:<pack_key>`); `kind` ∈ `document|website_section|notification|report|calendar|question_paper|email` (plus `website_page_preset` per `PTTA §5.5`); `name`, `name_nepali`, `description`; `category` (normalized via `TemplateEngineService._CATEGORY_ALIASES`); `tags[]`; `version`; `owner` ∈ `platform|plugin:<slug>|school`; `provided_by` (plugin slug when owner is a plugin); `requires_plugins[]` (pack hidden unless installed); `locales[]`, `default_locale`; `engine` ∈ `writer|canvas|sections|text|html|markdown`; `page{size (A4|A3|A5|"ID Card"|Thermal80|"794 1123"), orientation, margins{top,right,bottom,left}, page_count}`; `variants{screen, print, ne}`; `variables[]` = `{key, type (string|image|table|number|date|qr…), source (dotted data path e.g. `payment.receipt_number`), required, format (npr|bs_date|percent|nepali_digits), columns[] for tables}` — this **replaces the untyped `fields: []` list**; `data_sources[]` validated against design_studio `/data-sources`; `theme{tokens[], respect_school_theme}` (`false` = fixed brand, e.g. government forms); `preview`; `is_default`; `published`; `editable` (`false` = platform-locked statutory formats).

Resolution order, highest first, implemented once in `TemplateRegistry.resolve(kind, pack_key, school_id)`: **1 school override** (`template_packs` row with `school_id`, created the moment a school edits, deep-merged over the parent so new upstream fields still arrive — the `deep_merge` at `template_folders.py:127-138` is already exactly this) → **2 plugin-provided** (`modules/<slug>/templates/<pack_key>/` for installed+active plugins) → **3 platform default** (`backend/app/templates/<kind>/<pack_key>/`) → **4 legacy in-code registry** (`template_engine.TEMPLATES`, kept during migration; folders already win today). This preserves current `file default ← DB overlay` semantics and adds the plugin layer.

## E.3 Registry, storage, API (`PTTA §5.3`)
`backend/app/services/templates/registry.py::TemplateRegistry` — one scanner for all kinds, absorbing `template_folders.scan_template_folders`: `scan(force=False) -> dict[(kind, pack_key), pack]`, `list_packs(kind=None, school_id=None, installed=None)`, `resolve(kind, pack_key, school_id=None, locale="en", variant="screen")`, `render(kind, pack_key, values, school_id=None, **opts)` (dispatch by `engine`), plus `install_plugin_packs(slug, school_id)`.

New table `template_packs` replaces/absorbs `designer_templates` (migrated, not dropped): `id`, `school_id` (NULL = platform mirror), `kind`, `pack_key` (unique together with `school_id`), `name`, `name_nepali`, `category`, `tags text[]`, `description`, `engine`, `page JSONB`, `variables JSONB`, `data_sources text[]`, `layout JSONB` (screen), `layout_print JSONB`, `layouts_i18n JSONB`, `theme JSONB`, `preview_url`, `version`, `owner`, `provided_by`, `is_default`, `published`, `editable`, `source ('file'|'plugin'|'db')`.

Migration from `designer_templates` is a straight column map (`template_key→pack_key`; `canvas_json`/`writer_json`→`layout` + `engine`; `fields`→`variables` with `type: string` inferred; `extra_config`→`page`), so 40 folder packs + every school override survive; `designer_templates` is kept as a **view for one release** so `bulk_generator.py`, `document_renderer.py` and `api/v1/design_studio.py` keep reading during migration.

API: `GET /templates/packs?kind=&category=&q=`, `GET /templates/packs/<kind>/<key>`, `PUT` (school override), `DELETE` (revert to parent), `POST /templates/packs/<kind>/<key>/render`, `GET .../preview.png`. Existing design_studio template endpoints (`api/v1/design_studio.py:370-415`, `:1233-1273`) become thin proxies, so the designer UI needs no change on day one. Installation/seeding: `hooks.activate` calls `TemplateRegistry.install_plugin_packs(slug, school_id)` which only ensures **mirror rows** exist (files stay truth, no content copying) so a plugin update ships improved templates automatically unless the school overrode them; uninstall keeps school overrides (`uninstall_policy: keep_data`).

## E.4 Rendering engines (`PTTA §5.4`)
| `engine` | Layout format | Renderer | Reuses |
|---|---|---|---|
| `canvas` | fabric JSON (single or `{version:"multi-page", pages:[]}`) | web fabric editor; PDF via `document_renderer.py` | as-is |
| `writer` | block list (`header_band`/`columns`/`table`/`paragraph`/`signature`/`spacer`/`footer_band`) | tiptap writer; PDF via writer→HTML | `template_engine._writer*` helpers |
| `sections` | `[{type, title, content, sort_order}]` | `SectionRenderer` (web + public site) | `PTTA §5.5` |
| `text` | `{body_en, body_ne, max_length, channel}` | SMS/WhatsApp/push interpolation | `PTTA §5.6` |
| `html` / `markdown` | body with `{{var}}` tokens | email (MJML-free HTML) / notice bodies, sanitized | `lib/sanitize.ts` `sanitizeHtml` |

Token syntax unified on the existing `{var}` / `{{var}}` pattern (`template_engine._TOKEN_PATTERN`, `document_renderer._TOKEN_RE`), with typed variables declaring `format` (`npr`, `bs_date`, `percent`, `nepali_digits`) so number/date localization stops being per-renderer guesswork.

## E.5 Website sections as templates — design-preserving (`PTTA §5.5`)
Three moves, **none of which changes rendered output**:

**(a) Section-type registry becomes data.** `frontend/lib/school-website/registry.ts` (474 lines of `SchoolWidgetDef`) is replaced by `GET /website/section-types`, served from `backend/app/templates/website_section/<type>/pack.yaml` — one pack per existing type: `hero`, `slideshow`, `stats`, `about`, `principal`, `programs`, `facilities`, `notices`, `teachers`, `gallery`, `testimonials`, `results`, `cta`, `contact`, `spacer`, `divider`, `map` (17). Each pack carries `name`, `icon`, `category`, `preview_gradient`, `default_content` (**copied verbatim**), `controls` (**copied verbatim**), `renderer_token`. The `SectionRenderer` switch (`SectionRenderer.tsx:973-1019`) becomes a `SECTION_COMPONENTS` map keyed by the same strings — same components, same props, lookup instead of `switch`. Unknown types keep today's honest placeholder branch (`SectionRenderer.tsx:1013-1018`), which is what makes plugin-added types safe.

**(b) Plugins can add section types.** A plugin ships `templates/<type>/pack.yaml` with `kind: website_section` plus a widget of `type: website-section` (`PTTA §2.2`). Bespoke markup → register a component token; otherwise use the generic `spec` section renderer (heading + body + list/grid + CTA), which covers most school-site content. Public-site data comes from a `public: true` endpoint on the plugin's **own** blueprint, and `/website/public/<slug>` gains a `plugin_sections` block so SSR still does one fetch.

**(c) Menus and page layouts become data.** Today the navbar has a hardcoded `NAV_ITEMS` fallback and derives items from published pages (`components/website/SchoolNavbar.tsx:26-44`), the layout hardcodes an 8-item `navLinks` array for the footer (`app/school/[slug]/layout.tsx:165-174`), and the footer's Programs/Contact columns are hardcoded JSX (`layout.tsx:300-335`). v2 adds a `website_menus` table (`school_id, location ('header'|'footer_quick'|'footer_programs'|'mobile'), items JSONB [{label,label_ne,href,page_id,children[],visible}], sort_order`) **seeded from exactly those hardcoded arrays on first read**, so the rendered menu is identical until an admin edits it. Page layouts become `sections` on `WebsitePage` for every page rather than only `home`; `about/academics/teachers/notices/gallery/results/contact` keep their current hand-written components as the default until a school applies a section-based layout, matching how the homepage already falls back (`app/school/[slug]/page.tsx:106+`). Page presets (`lib/school-website/templates.ts`, 3) become `kind: website_page_preset` packs — one-click "apply layout" writes sections exactly as now.

## E.6 Notification / SMS / email / WhatsApp packs (`PTTA §5.6`)
`kind: notification`, `engine: text` (or `html` for email). Pack keys beyond the common set: `channels[]` (`sms`, `whatsapp`, `push`), `body.{en,ne}` with `{var}` tokens, typed `variables[]`, `limits{sms_segments, max_length}`, `push{title_en, title_ne}`, `default_locale`.

- Existing `notification_templates` rows (`models/notification.py:79-87`) migrate 1:1 (`template_en`/`template_ne` → `body.en`/`body.ne`, `variables` → typed variables) and become **school overrides** of platform/plugin packs; schools keep editing them at the same screens.
- Senders (`app/tasks/sms_sender.py`, `services/communications/*`, `tasks/push_notifications.py`) call `TemplateRegistry.render("notification", key, values, school_id, locale=school.default_language)`, replacing the **~15 inline f-strings** currently embedded in `plugins/listeners.py` (absent-alert SMS at `listeners.py:152-157`, fee-paid push at `:258-260`, emergency SMS at `:1018-1020`) — the reason schools cannot currently reword their own alerts.
- Nepali is first-class: `default_locale` follows `School.default_language` (defaults to `ne`, `models/school.py:149`), with per-guardian language preference overriding when known.
- SMS cost safety: the validator computes **segment counts per locale (Devanagari is UCS-2, 70 chars/segment)** and warns when a rendered message exceeds `limits.sms_segments`; today nothing checks this and Nepali messages silently cost 3-4× more.

## E.7 Generator scripts (`PTTA §5.7`)
`tools_gen_nepal_school_templates.py`, `tools_redesign_nepal_templates.py`, `tools_gen_calendar_templates.py`, `tools_gen_thumbnails.py` currently write `template.yaml` + `canvas.json`/`writer.json` straight into `backend/app/templates/designer/<key>/`. They **keep working unchanged** (the compat scanner accepts `template.yaml` and normalizes it into a pack) and are updated in phase 4 to emit `pack.yaml` with typed variables. `tools_gen_thumbnails.py` folds into `services/designer/thumbnails.py` so preview generation is one code path for every kind.

---

# F. IMPLEMENTATION PLAN + RISKS (`PTTA §6`)
Effort key: **S** ≤ 2 days · **M** 3-7 days · **L** > 7 days (one engineer). Every phase independently shippable and reversible; no phase changes public-site pixels except where explicitly tested for equality.

| Phase | Sizing | Deliverables (create / modify / migrations / compat / tests) |
|---|---|---|
| **0 — Contract + adapter + validator** | **S/M** | Create `plugins/validator.py`, `tests/test_plugin_contract.py` (parametrized over **all 47** manifests, errors fail CI), `plugins/schema/manifest_v2.yaml` (self-validating), `scripts/plugin_doctor.py` (`--fix-safe` writes `schema_version: 2`, moves `frontend:`→`ui.nav`, `flutter:`→`mobile`, pointers→`capabilities` for already-passing manifests). Modify `loader.py` (`_normalize_manifest`, sidebar/bottom-nav read `ui.nav`, effective alias map `manifest.aliases ∪ PLUGIN_SLUG_ALIASES`, `load_listeners()`, `get_module_file(slug,name)`), `decorators.py` (`_acceptable_plugin_slugs` consults loader map, single-hop preserved), `api/v1/plugins.py` (+`/plugins/registry`, `/plugins/aliases`, `/plugins/<slug>/health`), `frontend/lib/plugins.tsx` (fetch aliases, hardcoded table = offline fallback). **No migrations.** Compat: v1 manifests untouched on disk, every endpoint identical. Tests: contract test, alias resolution both directions, snapshot that `/plugins/sidebar` output is **byte-identical** before/after the `ui.nav` switch |
| **1 — Config schema v2** | **M** | Create `plugins/config_schema.py`, `plugins/secrets.py` (Fernet + rotation), `plugins/config_migrations.py` (runner), `FormRenderer.tsx` + `fields/{ColorField,CronField,EntityPicker,MultiEnumField,ListField,SecretField,FileField}.tsx`, `tests/test_config_schema.py`, `__tests__/form-renderer.test.tsx`. Modify `api/v1/plugins.py:812-885` (GET redacts + role-filters, PUT validates → 422, config-schema returns v2 role-filtered), `config_store.py` (`resolve_config`, `plugin_secret`, `plugin_config_value` delegates), rewrite the 5 existing schemas to v2 + add v2 schemas for `notices`, `exams`, `assignments`, `sms_notifications`, `timetable`, settings page delegates to `FormRenderer`. Migrations: `plugin_config_audit` table, `SchoolPlugin.installed_version` (nullable). Compat: unschema'd plugins keep pass-through; existing configs read unchanged; `?replace=1` preserved. Tests: every field type coerce/reject, `visible_when` truth table, hidden-field pruning, secret never in GET, `entity-picker` cross-tenant rejection, migration idempotency (apply twice = same), e2e fees settings persistence, teacher 403 on gateway group |
| **2 — Theme tokens + parity lock** | **M/L** | Create `themes/base.yaml` + 10 `themes/packs/<theme_key>.yaml` (from `capture_theme_baseline.py`), `services/theme/{resolver,validator,contrast}.py`, `api/v1/themes.py` extensions (`GET/PUT/DELETE /themes/tokens`), `frontend/lib/theme/tokens.ts` (+`cssVars()`), `dashboard/settings/theme/page.tsx`, `theme_from_tokens.dart`, `tests/test_theme_baseline.py`, `__tests__/theme-parity.test.ts`, `tests/e2e/public-site-visual.spec.ts`. Modify `frontend/themes/registry.ts` (palettes generated, `generateThemeCSS` untouched), `theme_engine.py` (`THEMES` → resolver read-through keeping `list_themes`/`get_theme`/`generate_css`/`synced_colors`/`apply_theme` signatures for `website_builder.py`, `api/v1/themes.py`, the marketplace description hack at `plugins.py:294-304`), `dashboard/layout.tsx` (emit vars, wire `useAppStore.theme`→`<html class="dark">`), `pdf_css.py` (`pdf_theme_css`), `app_theme.dart` (accept tokens, constants as fallback), `tailwind.config.js` (`font-nepali`→`font_devanagari`). Migrations: `theme_documents`, `school_theme_tokens`. Compat: **public-site CSS byte-identical for all 10 themes**. Tests: parity ×2 + zero-threshold visual diff, contrast unit tests, resolver layering (plugin token cannot overwrite a core role; `public_site` contribution refused without `public_routes`), Flutter goldens light/dark, PDF snapshot |
| **3 — Widget contract, host + dashboard composition** | **L** | Create `plugins/widgets.py`, `GET /plugins/widgets`, `api/v1/dashboards.py`, `lib/plugin-widgets/{registry,types,bindings,usePluginWidgets}`, `components/plugin-widgets/{PluginWidgetHost,WidgetSlot,WidgetFrame,WidgetSkeleton,WidgetError,WidgetEmpty}`, 9 generic renderers, shared primitives (`data-table`, `skeleton`, `empty-state`, `error-state`, `confirm-dialog`, `pagination`, `status-pill`, `sheet`, `ChartKit`), `widgets.yaml` for `attendance`, `fees`, `notices`, `exams`, `assignments`, `library_management`, `white_label`, `biometric`, plus 3 test suites. Modify `dashboard/page.tsx` (static KPI grid → `<WidgetSlot id="dashboard.main">` + dnd-kit edit mode), `students/[id]/page.tsx` (`student_profile.tab` slot), `plugins/[slug]/page.tsx` (`plugin_page.main` above existing content), `api/v1/plugins.py` (widget cache invalidation). Migrations: `dashboard_layouts`. Compat: no `widgets.yaml` ⇒ unchanged; pre-existing dashboard cards ship as platform-default widgets; unknown ids skipped. Tests: binding resolution (`$today`, `$context.*`, `$.a.b[0]`), unknown token renders nothing, error boundary contains failure, API filtering (inactive plugin / missing permission / role mismatch / endpoint must belong to declaring plugin), e2e install→appear, drag→persist, uninstall→vanish with layout intact |
| **4 — TemplatePack unification** | **L** | Create `services/templates/{registry,packs,render,variables}.py`, `api/v1/templates.py`, 17 `templates/website_section/*/pack.yaml` (verbatim `defaultContent`+`controls`), ~15 `templates/notification/*/pack.yaml` for the strings inlined in `listeners.py`, `scripts/migrate_templates.py`, 3 test suites. Modify `template_folders.py` → thin wrapper, `template_engine.py` (`_ensure_seeded`/`list_templates_for_school`/`get_template` read the registry; in-code `TEMPLATES` stays as legacy layer), `design_studio.py:370-415,1233-1273` → proxies, `school-website/registry.ts` → fetch `/website/section-types` with static array as build-time fallback, `SectionRenderer.tsx:973-1019` → `SECTION_COMPONENTS`, `api/v1/website.py:254-306` (+`plugin_sections`, seed `website_menus`), `listeners.py` + `tasks/{sms_sender,push_notifications,fee_reminders,attendance_alerts}.py` → render through packs, `SchoolNavbar.tsx` + `layout.tsx:165-174,300-335` → menus from API with current arrays as fallback. Migrations: `template_packs` (+ `designer_templates` view), `website_menus`. Compat: rendered public site identical (defaults + menus seeded from current values; zero-threshold visual diff again); designer UI unchanged; overrides preserved (dry-run + row counts). Tests: all 40 designer packs render byte-comparable PDFs, section-type list matches old registry exactly, notification packs match previous f-string output per event, SMS segment warnings fire for Devanagari overflow, e2e override→revert |
| **5 — Mobile widgets + wave 3-6 adoption** | **M/L, parallelizable** | Create `mobile.yaml` per plugin, `aschool_shared/lib/widgets/spec_widget.dart` + `spec_renderers/`, `MOBILE_SCREEN_REGISTRY` per app, `spec_widget_test.dart`. Modify `api/v1/mobile.py:159-468` (build visibility from installed plugins' `mobile.yaml` instead of hardcoded per-role rules, add `widgets`), `plugin_provider.dart` (parse/cache widgets), `dynamic_bottom_nav.dart`, `app_drawer.dart` (read `surfaces`). Compat: bootstrap payload is a superset; stale binaries ignore unknown fields and fall back to `module_screen_template.dart`. **Golden test: bootstrap visibility for each of the 5 roles identical to current hardcoded output for a fully-provisioned school** — the safety net for deleting ~300 lines of rules. Then run waves 3-6, each plugin a small PR (promote manifest, add `widgets.yaml`/`config_schema.yaml`/`i18n`, move routes with re-export shim, add `tests/`) |

## F.1 Cut lines (`PTTA §6 Cut lines`)
- **Day 1** — `plugin_doctor.py` + `validator.py` + `test_plugin_contract.py` run over all 47 manifests and produce the error/warning table (this alone surfaces the ~20 broken pointers, the missing `ai_suite/__init__.py`, and every icon/section mismatch). Land `_normalize_manifest` behind existing tests. Run `capture_theme_baseline.py` and commit the 10 theme packs **plus the two parity tests before touching any theme code**.
- **Week 1** — Phase 0 merged (adapter, validator in CI, `/plugins/registry`, `/plugins/aliases`, frontend alias fetch). Phase 1 backend merged (`config_schema.py`, validating `PUT /config`, secret redaction) with `fees` + `attendance` rewritten to v2 as reference schemas. `FormRenderer` skeleton rendering those two schemas behind the existing settings route.
- **Month 1** — Phases 0-2 complete; Phase 3 shipped for `dashboard.main` with 6-8 widgets across attendance/fees/notices/exams, editable layouts, and the shared `DataTable`/`ChartKit`/`StatCard`/`EmptyState`/`Skeleton` primitives. Theme tokens live on the dashboard (dark mode working) and in Flutter, public site provably unchanged. Phase 4 started with the website-section registry converted (design frozen by test) and notification packs replacing the inline strings in `listeners.py`.

## F.2 Risk register (`PTTA §6 Risk register`)
| Risk | Mitigation |
|---|---|
| Public-site visual regression | baseline capture + 2 unit parity tests + zero-threshold visual diff, all landed **before** refactor; `surface_overrides.public_site` empty in phase 1 |
| Config migration corrupts a school's settings | pre-migration snapshot in `plugin_config_audit`; idempotent transforms; lazy per-school application; dry-run bulk endpoint |
| Widget payload becomes a performance drag | one cached fetch per (school, role, surface) with ETag; per-widget `cache_ttl_s`; server-side pagination mandatory for `table-panel` |
| Spec dialect grows into a private language | fixed type list; no expressions beyond binding tokens; `renderer: component` as documented escape hatch; validator rejects unknown spec keys |
| Template migration loses school overrides | migration script with dry-run + row-count assertions; `designer_templates` kept as a view for one release; per-pack PDF byte comparison |
| Mobile clients break on the extended bootstrap | additive fields only; unknown tokens → template screen; golden test pinning current visibility output per role |
| Plugin restyles the public site | theme contributions namespaced; `applies_to` required; `public_site` needs `capabilities.public_routes`; validator enforces |

---

# G. AI TEACHER ENGINE INTERNALS (`ATIB`)
## G.1 Board grammar — every token/directive form (`ATIB §3.1`)
A **text DSL embedded in the LLM stream**, not JSON (`finalprompt.md`'s JSON `board_script` was proposed and rejected; `implementation_plan.md §0.2` documents why). Three live command families; the parser tolerates many legacy/SDL forms.

| Directive | Exact syntax | Semantics |
|---|---|---|
| **WRITE** | `[WRITE@x,y: text #RRGGBB]` | Handwritten text. `x,y` = percentage 0-100 (x=5 left margin; title pre-written at y=5; body starts y=13). Optional trailing `#hex`. Math wrapped `$…$` (LaTeX on client, spoken as English via `_latex_to_plain`). `#color` stripped from speech. Long non-math text (>120 chars) auto-split at ≤80 chars with propagated x. `delay_ms = max(380, len*24+200)` |
| **DRAW_SVG** | `<DRAW_SVG x=N y=N width=N height=N>` + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">…inline-attr SVG…</svg>` + `</DRAW_SVG>` | **The ONLY visual command.** width/height = % of board (0-100). Backend normalizes coords (`>1.5 → /100`), estimates size from viewBox aspect when omitted (`svg_diagram_size`), clamps to bands, runs 14-step `repair_svg()` (xmlns, viewBox, no `<style>`/`<script>`/`<foreignObject>`/external href/events/`<image>`, class attrs stripped, unclosed tags fixed, min font 8→10, default text fill `#1A1A1A`). `delay_ms=350`, `from_diagram=True` |
| **NEXT_SLIDE / ERASE_BOARD** | `[NEXT_SLIDE]` / `[ERASE_BOARD]` | Clear board: server `board.clear()`, client wipe animation, slide snapshot archived. **Banned in prompts ("one chapter = one slide") but still parsed** |
| **PAUSE** | `[PAUSE: seconds]` | Delay only, default 2000 ms |
| **REMOVE** | `[REMOVE: item_id_or_text]` | Removes a `wb_N` item by id, then exact text, then substring |
| **MCQ annotations** | `[CROSS_OUT@wb_N: #C62828]`, `[CIRCLE@wb_N: #color]`, `[UNDERLINE@wb_N: #color]`, `[BOX@wb_N: #color]`, generic `[ANNOTATE@wb_N: circle #FFB300]` | Annotate an existing item by id; client paints cross/circle/underline/box/tick/arrow with PathMetrics progress. **Known bug: `target_id` never populated — the parser stores the id in `text`** |
| **Legacy/SDL (parsed, strip-safe, prompt-disabled)** | `[DRAW_LINE@x,y: x2,y2]`, `[DRAW_SHAPE@x,y: type w h #stroke #fill\|label]`, `[DRAW_IMAGE@x,y: prompt]`, `[DRAW_VECTOR]`, `[DRAW_AXES]`, `[STEP_NUMBER]`, `[DRAW_TABLE]`, `[DRAW_GRAPH]`, `[DRAW_EQUATION_BOX]`, `<DRAW_MERMAID>`, `<DIAGRAM_REQUEST type="svg">desc</DIAGRAM_REQUEST>` | Map to DRAW_SVG/ANNOTATE handling or are stripped from speech; `DRAW_IMAGE` would fetch a Pollinations URL (dead) |
| **Zone form (supported, not prompted)** | `[WRITE@zone=top-left: …]` | 11 named zones resolved via `resolve_zone()` + open-region search (`whiteboard_service.py:110-122`) |

**Coordinate systems** (`ATIB §3.2`): the AI speaks **percentage 0-100**; the wire `DrawCommand` is **normalized 0.0-1.0** (parser divides by 100; values >1.5 treated as already normalized). Client renders x against viewport width and y against a **virtual unit height** (infinite scroll canvas grows with content; auto-scroll keeps newest content 65% down the viewport) (`ATIB §3.3`, `§8.1`).

**viewBox conventions** (prompt-enforced, `ATIB §4.2`): wide diagrams/flows/timelines `viewBox="0 0 500 200"`; standard `"0 0 400 300"`; tall hierarchies `"0 0 300 400"`; square `"0 0 300 300"`. Required opening tag with `xmlns`; inline attributes only; `<text>` labels 2–5 words, `font-size="14"`/`"16"`, `text-anchor`; arrows via `<defs><marker>` + `marker-end="url(#arr)"`; `rx="8"` rounded corners; pastel fills `#E3F2FD`/`#E8F5E9`/`#FFF3E0`/`#FCE4EC` with solid strokes; `stroke-width="2"` shapes, `1.5"` lines; 10–15 px inner padding. Shape rule: polygon for triangles/polygons, `<circle>`/`<ellipse>`, `<rect>` only when the concept *is* a rectangle, `<path d>` for free paths, zigzag paths for waves/springs — **never `<rect>` as a stand-in for a triangle or diamond**. (The separate diagram-specialist prompt uses a **different** convention: large `viewBox="0 0 800 600"`, `width="100%" height="auto"`, avoid `<g>`/`<use>`/`<defs>`/`<marker>`/gradients/filters, arrowheads drawn as `<path>`/`<polygon>`, no `stroke-dasharray`, font 18–28 px — `ATIB §4.9`.)

**y-cursor layout rules.** Prompt-side contract (`ATIB §4.2`, `§3.2`): title pre-written at y=5; first WRITE at y=13; **WRITE height = 8 units, gap exactly 2 → next y = prev + 10**; DRAW_SVG next y = current_y + `height` attr + 2; never leave more than 3 blank units; if the cursor passes **y=85** emit `[NEXT_SLIDE]` and reset to y=13 (while the runtime task simultaneously says "Do NOT use [NEXT_SLIDE] — one chapter = one slide" — flagged as a contradiction in `ATIB §9.4`). Worked example given: WRITE@13 → WRITE@23 → `<DRAW_SVG y=33 height=25>` → cursor 58 → WRITE@60.
Server-side engine (`WhiteboardState`, `ATIB §3.2`): `_next_write_y` starts **0.08**; WRITE height estimate base 0.07 plain / 0.09 math / 0.12 tall math (`\frac|\sum|\int|\sqrt|^|_`), +0.05/0.055 per extra 34/24-char line, capped 0.26/0.30; width = `clamp(0.20 + len*0.006, 0.22, 0.92)`; after each item `_next_write_y` advances by height + 0.015-0.04. Overlap: AABB test with 0.012 padding against all registered items; colliding writes nudged to the first free position from candidate x list (0.05, 0.33, 0.62−w/2) scanning y in 0.03 steps. **Diagrams never float beside text — y is floored to `_next_write_y` (own horizontal band).** Board→LLM views `describe()` / `items_for_ai()` print every item with `wb_N` id, type, text (≤45-50 chars), percent bounds, plus `">>> NEXT FREE y = N <<<"` and a nearly-full warning at y>80 — this is how the model avoids overlap across turns.

**Colour semantics** (prompt-enforced, `ATIB §3.1`/`§4.2`): Blue `#1565C0` = main concepts/key terms/correct answers; Red `#C62828` = wrong answers/critical corrections/cross-outs; Green `#2E7D32` = results/diagrams/correct signals; Amber `#FFB300` = highlights/attention; Black `#1A1A1A` = base text; Orange `#E65100` = emphasis; Purple `#6A1B9A` = formulas. If the AI omits a colour the backend cycles `MARKER_COLORS = ["#1A1A1A","#1565C0","#C62828","#2E7D32"]` per session.

**NEXT_SLIDE rule.** Prompt: one chapter = one slide, `[NEXT_SLIDE]` not to be used in chapter output; emitted **by the server** at chapter start as the first step (`[{NEXT_SLIDE}, {title WRITE}]`, NEXT_SLIDE only when `chapter_idx > 0`); the client archives the current elements to slide history (navigable, dimmed), plays a ~400 ms wipe, and resets the cursor. Cursor past y=85 is the only prompt-sanctioned reason to emit it.

**Blank-line / spacing rules** (`ATIB §4.2` "LAYOUT ENGINE — TIGHT, PRECISE SPACING"): "GAP RULE: exactly 2 units between items. No more, no less" with an explicit wrong/right pair (`[WRITE@5,13]` then `[WRITE@5,40]` = 27-unit gap, wrong; `[WRITE@5,23]` = 10 units, right) and "NEVER leave more than 3 units of blank space between items". Persona board notes repeat "exactly 2 y-units gap between items. NO big gaps" (`ATIB §4.1.1–4.1.5`).

**Bracket rule** (`ATIB §4.2`): `[square brackets]` **only** for `[WRITE@x,y: text]` and MCQ annotations; `<angle brackets>` **only** for `<DRAW_SVG …>…</DRAW_SVG>`; `[DRAW_SVG …]` / `[DRAW_SVG …>` are explicitly called out as WRONG and break drawing. Speech rules: never speak command syntax, command names, colours or coordinates; never narrate drawing actions; never emit raw SVG elements in the narrative.

**Char-timing hints** (`ATIB §3.3`, `§8.1`): handwriting reveal per character — space 55-80 ms, punctuation 140-220 ms, uppercase 65-95 ms, other 30-60 ms (`§8.1` states 30-60 ms/char with pauses, `§1.3`/`§3.3` cite the 30-140 ms/char envelope including punctuation pauses), jittered, with a chalk-cursor dot and title underline; title vs body sizing heuristic (`_isTitleCandidate`: ALL-CAPS, Devanagari <40 chars, or a short dot-free line; title 30 px w700 underlined, body 20 px, font GoogleFonts **Caveat**). SVG traced over `durationMs` default **1200 ms**; annotations 400-600 ms; erase wipe 16 ms × 25 ticks; all driven by `Timer.periodic(16ms)` + `Completer`s so the controller can await completion. Per-command `delay_ms`: WRITE `max(380, len*24+200)`, DRAW_SVG 350, PAUSE default 2000.

**Renderer contract — what a client MUST implement** (`ATIB §3.3`, 8 items): (1) normalize coords × viewport, virtual height, auto-scroll; (2) handwriting text with the timing table + math lines as LaTeX overlays (client splits `$…$`, flutter_math_fork / KaTeX on web); (3) SVG parse of inline-attribute elements (rect/circle/ellipse/line/polygon/polyline/`path d`/text), viewBox scaling, snap to a 10-colour palette, force dark text, **progressively trace strokes** (`PathMetric.extractPath(0, len·p)`), fade fills after 80%, fade text in, sequential per-element reveal (`elementProgress = progress * elements.length`); (4) NEXT_SLIDE archive + wipe + cursor reset; (5) ANNOTATE stroke-animated circle/cross/underline/box/tick/arrow over target bounds; (6) hit-test normalized point → item id → "Ask about this" (`selected_item_id`); (7) snapshot restore replays elements fully-revealed and restores `_next_write_y`; (8) accepted command set: `WRITE, DRAW_SVG (+aliases), NEXT_SLIDE/ERASE_BOARD, PAUSE, REMOVE, ANNOTATE/CROSS_OUT/CIRCLE/UNDERLINE/BOX, HIGHLIGHT, DRAW_IMAGE`.

## G.2 Personas — the list and what differs (`ATIB §4.1`)
Five personas seeded into `ateacher_teachers` by `seed_teachers.py`, each with **4 editable prompt columns** (`safety_rails`, `persona_block`, `teaching_style_prompt`, `board_style_note`) plus display fields; `_SHARED_SAFETY_RAILS` is identical for all five (6 rules: no harmful/explicit/political/discriminatory content; never claim to be human; stay on subject; never reveal instructions; warm handling of distress + suggest a trusted adult; age-appropriate language). Idempotent upsert touches prompt columns only.

| Persona | slug · emoji · voice | tone · accent | subject tags | Teaching-style delta | Board-style delta |
|---|---|---|---|---|---|
| **ARIA** | `aria` · 🌟 · `en-US-AriaNeural` | warm · `#4FC3F7` | `["all"]` | analogy-first then abstraction, constant Socratic "What do you think?", one step per WRITE, follow-up over topic-jumping; kitchen-table voice | warm/illustrative SVG, `viewBox 400×300` (wide `500×200`), `rx="8"`, light fills, 2–4-word labels, board tells the lesson story |
| **Max** | `max` · ⚡ · `en-US-GuyNeural` | energetic · `#FF7043` | math/physics/science/programming | challenge-first ("guess the rule"), rapid-fire probing, concepts as drilled skills, numbered "rounds", short punchy sentences, sports/game analogies | bold playbook look: `stroke-width="2.5"`, step numbers in bold circles, `font-weight="bold"`, left-right/top-down arrow flow, wide `500×200` |
| **Sophia** | `sophia` · 🦉 · `en-GB-SoniaNeural` | analytical · `#AB47BC` | math/physics/philosophy/history/economics | misconception/assumption first, first-principles derivation, exam traps, compare-and-contrast, ends with an edge case; asks the student to defend errors; formal register | scholarly precision: clean rects `rx="6"`, minimal fills, header-row comparison tables, numbered proof-step flow, error cases `#C62828`, `font-size="13"`, `stroke-width="1.5"`; definitions written last |
| **Leo** | `leo` · 🦁 · `en-AU-WilliamNeural` | playful · `#FFA726` | biology/history/english/chemistry/all | story/character-first, personalities for abstractions, pop-culture analogies, then "seriously — here's the real mechanism", humour to lower anxiety, memorable closing one-liner | colourful/expressive: `rx="10"`, warm fills (`#FFF9C4`,`#FCE4EC`,`#E8F5E9`,`#FFF3E0`), multi-accent colours, character label first + formal name in parentheses; draw the story scene before the formal concept |
| **Nova** | `nova` · 🔭 · `en-US-JennyNeural` | analytical · `#26C6DA` | math/data science/statistics/physics/programming | visual/pattern before formula, real data and numbers, intuition→formalism, every formula shown in a graph/table, labelled steps, zoom-in on insight points | data-sketchpad: labelled axes with ticks + arrow markers, curves as `<path>`/`<polyline>` in `#1565C0`, filled circle key points, annotation arrows with values, dashed `#E0E0E0` grid, `font-size="13"`, opens every chapter with a `<DRAW_SVG>` visual |

What is **identical** across personas: the safety rails, the board grammar directive (`SINGLE_DRAW_METHOD_DIRECTIVE`), the 2-y-unit gap rule, "each step gets its own WRITE", the never-translate technical-vocabulary rule and the Nepali/mixed-language code-switching guidance (each persona has its own set of Nepali discourse markers, e.g. ARIA "Okay, ta suna —", Max "Yaar, suna!", Sophia "Dhyan dinus —", Leo "Sochnus ta —", Nova "Yo graph hernus —"). What differs: persona voice/emoji/accent colour/subject tags/default voice, opening move, question style, register, and SVG aesthetic parameters.

## G.3 Prompt assets to port (`ATIB §4`, quoted verbatim in the source)
| Constant / asset | Source | Role |
|---|---|---|
| `_SHARED_SAFETY_RAILS` | `seed_teachers.py:30-37` | 6 non-negotiable safety rules prepended for every persona (`ATIB §4.1.0`) |
| 5 × `persona_block`, `teaching_style_prompt`, `board_style_note` (+ per-persona `safety_rails`) | `seed_teachers.py` per-teacher dicts | Who you are / how you teach / whiteboard style, wrapped by `PromptComposer` in `━`-divided sections `SAFETY RAILS` / `WHO YOU ARE` / `HOW YOU TEACH` / `WHITEBOARD STYLE` (`ATIB §4.1`, `§4.14`) |
| `SINGLE_DRAW_METHOD_DIRECTIVE` | `groq_service.py:465-672` | The board-grammar prompt: 3 command types, SVG rules + 5 worked diagram examples (triangle, 3-step process flow, coordinate axes w/ curve, 2-column comparison table, force diagram), semantic colour table, disabled-command list, speech-board interleaving rules, bracket rule, layout engine spacing (`ATIB §4.2`) |
| Runtime chapter task template | `groq_service.py:1363-1399` | Per-chapter user message: plan context, chapter title, topic/level/language, slide type, board state, pre-written title notice, board language guidance, source handling, detected teaching need, analyzer block, output requirements (first action `[WRITE@5,13: …]`, y-cursor arithmetic, WRITE/DRAW_SVG rules, interleaving, speaking style), `Do NOT use [NEXT_SLIDE]`, transition note, language/technical-terms rule (`ATIB §4.3`) |
| `transition_note` (2 variants) | same | Final-chapter variant (connect to the real world, one memorable image, end with a transfer question) vs mid-chapter variant (create anticipation for the named next chapter via an open question, "curiosity, not an announcement") (`ATIB §4.3`) |
| Question-answer runtime task | `groq_service.py:1270-1290` | Barge-in answer message: answer the exact question, detected need, source handling, board writing rule, WRITE every key term, one math step per WRITE (y+10), DRAW_SVG when it clarifies, interleave, natural phrasing, keep technical terms English (`ATIB §4.3`) |
| Adaptive remediation note | `groq_service.py:15-30` | Appended when `confusion_count ≥ 2`: switch strategy (concrete-first, add a DRAW_SVG, intuition before formula, a *new* analogy, smaller steps) and "Do NOT mention that you are changing approach" (`ATIB §4.4`) |
| `TeachingBlueprint.to_strategy_block()` | `session_analyzer.py:113-153` | The `═══ TEACHING BLUEPRINT ═══` block injected into the teacher system prompt: question type, intent, scope/depth, chapters planned, visual complexity + symbol board, visual strategy, question diagnosis, image context, teaching strategy, opening hook, misconceptions, prior knowledge, chapter arcs, special instructions (`ATIB §4.5`) |
| `_ANALYZER_SYSTEM` | `session_analyzer.py:179-244` | Stage-1 learning-scientist prompt with the full JSON schema: `question_type` (8 enum), `user_intent` (5), `scope` (3), `depth` (3), `recommended_chapters` 1-5, `chapter_themes[]`, `visual_complexity` (4), `requires_symbol_board`, `visual_strategy_note`, `teaching_strategy`, `opening_hook`, `known_misconceptions[]`, `prior_knowledge_check[]`, `special_instructions[]`, `question_diagnosis` (`ATIB §4.6`) |
| `_PLANNER_SYSTEM` + `_PLANNER_PROMPT_TEMPLATE` | `session_planner.py:106-157` | Stage-2 curriculum designer grounded in Cognitive Load Theory, Spaced Repetition, Dual Coding, Faded Scaffolding; JSON schema `session_title`, `concept_graph[{id,label,prereqs,difficulty,teach_time_min}]`, `slide_sequence[{index,concept_id,slide_type,modality,description}]`, `spaced_review_slots[]`, `attention_reset_slots[]`, `estimated_total_slides`; **7 hard constraints** (no two concepts sharing a prereq back-to-back; SPACED_REVIEW every 5-7 TEACH slides; ATTENTION_RESET every 8-10 slides; TEACH→FULL_EXAMPLE→PARTIAL_SCAFFOLD per group; end with exactly one QUIZ then one REVIEW; slides×2 min ≤ time budget; monotonic difficulty per prereq chain) (`ATIB §4.7`) |
| Plan-generator system prompt | `groq_service.py:1133-1152` | Chapter-title generator: JSON array only, level-matched arc, **Bloom's progression** (open = Remember→Understand + misconception inoculation; middle = Apply→Analyze; close = Analyze→Evaluate with exam traps and transfer), curiosity-driven titles with good/bad examples (`ATIB §4.7`) |
| Response classifier prompts | `response_classifier.py:62-86` | 5-class output (`CORRECT_FAST`, `CORRECT_SLOW`, `INCORRECT_MISCONCEPTION`, `INCORRECT_CARELESS`, `NO_RESPONSE`) as JSON `{class, confidence, misconception, hint}` (`ATIB §4.8`) |
| `_SVG_SPECIALIST_SYSTEM`, `_MERMAID_SPECIALIST_SYSTEM`, `_GENERATE_USER_TEMPLATE`, `_CRITIC_SYSTEM` + critic user + retry injection | `diagram_specialist.py:61-137` | `<DIAGRAM_REQUEST>` sub-pipeline: `<thinking>` planning phase → SVG generation (70b, temp .4) → critic PASS/`FAIL: <issue>` (8b) → 1 retry → `repair_svg` (`ATIB §4.9`) |
| `_slide_type_guidance` (8 blocks) + reteach prefix | `groq_service.py:675-751` | Per-slide-type mode prompts: TEACH (Hook→Foundation→Worked Example→Landing, early diagram by third board action, one check question), FULL_EXAMPLE, PARTIAL_SCAFFOLD, INDEPENDENT_PRACTICE, QUIZ, REVIEW, ATTENTION_RESET, SPACED_REVIEW; plus a `⚠️ RETEACH SIGNAL` prefix. **Dead in current wiring — must be wired in the port** (`ATIB §4.10`, `§10.1`) |
| Lesson summary prompts | `groq_service.py:1438-1451` | Three fixed sections (**What we covered** 3-5 bullets / **Strong spots** / **Next steps** 2-3 items), <220 words, in the lesson language, with `mastery_context` lines built from per-chapter question counts (`ATIB §4.11`) |
| Primary-teaching-source injection | `groq_service.py:1252-1263` | `⚠️ PRIMARY TEACHING SOURCE` block instructing the model to teach *from* the student's course material over general knowledge (`ATIB §4.12`) — **note this exact concatenation is the injection hole S-17; the port must delimit it as data** |
| Vision prompt + analyzer image pre-pass | `groq_service.py:810-818`; `session_analyzer.py` | Describe a student-uploaded image for the tutor (formulas/diagrams/labels/worked steps) / 2-3-sentence factual pre-pass for the analyzer (`ATIB §4.13`) |
| `PromptComposer` assembly + `SESSION CONTEXT` block | `prompt_composer.py:27-45`, `:128`, `:80-95` | Final system prompt order: safety rails → persona → teaching style → board style → `SESSION CONTEXT` (topic/level/language + current whiteboard state, with an empty-board variant naming y=5 title and y=13 first WRITE) → `SINGLE_DRAW_METHOD_DIRECTIVE` → blueprint strategy block; plus the "Mixed/Natural" Nepali-English code-switching block listing ~30 never-translate terms (`ATIB §4.14`) |
| `board_state_compressor` prompts | `board_state_compressor.py` | Dense single-paragraph board summariser — **dead code** (`ATIB §4.15`) |
| Not to be shipped | `chemistgpt.txt`, `physicsgpt.txt` | Third-party MathGPT-style tutor prompts, unused in code, **license concern — do not ship** (`ATIB §1.2`, `§11`) |

## G.4 Teaching flow state machine, step by step (`ATIB §2.2`)
**A. Launch (pre-LLM).** Platform → `POST /api/auth/token` (`X-API-Key`) creates `ateacher_users` + `ateacher_user_tokens`; `POST /api/session/create` (Bearer) creates the `ateacher_sessions` row (topic/level/language/voice/teacher_id/status=teaching/started_at) + optional `ateacher_session_context` (≤150k chars, markdown-stripped); the Flutter web app is iframed with `session_id` in URL params.

**B. `start_lesson`** (`events.py:203`): 1 DB session is the source of truth, context pulled, preferences updated → 2 in-memory `Lesson` created/registered, `join_room(session_id)`, `lesson_status: teaching` → 3 `teacher_info` emitted (persona row, default ARIA) → 4 xAPI `lesson_started` → `ateacher_learning_events` → 5 **Stage 1** `analyze_learning_need()`: 1 blocking LLM call (LEARNING_ANALYZER, 70b, temp 0.2) → `TeachingBlueprint` (16 fields) cached in `_session_blueprints`, `lesson_blueprint` emitted → 6 **Stage 2** `create_session_plan_sync()`: 1 blocking call (SESSION_PLANNING, 70b, temp 0.3) → `SessionPlan` (concept graph + slide sequence); chapter titles = concept labels; on planner failure fall back to `generate_plan()` (blueprint-guided titles), on that failure 4 hardcoded titles; plan persisted to `ateacher_sessions.chapter_plan`, `lesson_plan` emitted — **20-40 s of opaque latency here** → 7 `_stream_chapter()`.

**C. Chapter streaming loop** (`_stream_chapter`, `events.py:1240`): 1 `board.clear()`, title WRITE built locally (y=0.05, x=0.05, cap 60 chars; "Chapter N" when Devanagari/non-ASCII), first `lesson_step` = `[{NEXT_SLIDE}, {title WRITE}]` (NEXT_SLIDE only when `chapter_idx>0`) → 2 `stream_chapter()` builds messages: **system** = PromptComposer(teacher row) + `SINGLE_DRAW_METHOD_DIRECTIVE` + blueprint `to_strategy_block()`; **user 1** (if context) = primary-source block + chapter-relevant slice (≤110k chars, section-scored); trimmed history (12 msgs / 14k chars); **user N** = runtime task → 3 stream via `gateway.route_stream_sync(SLIDE_SCRIPT or QUIZ_GENERATION)` → 4 per token `raw_buffer += token`, `_split_at_incomplete_bracket()` holds back anything from the last unmatched `[`, an unclosed `<DRAW_SVG`/`<DRAW_MERMAID`/`<DIAGRAM_REQUEST`, or a trailing `<tag` stub → only "safe" text proceeds → 5 `_process_diagram_requests()` replaces `<DIAGRAM_REQUEST>` with a synchronously generated specialist SVG (generate → critic → retry) or a placeholder → 6 `parse_draw_commands(safe, board_state)` extracts commands **in document order** and registers each WRITE/DRAW_SVG on `WhiteboardState` (assigns `wb_N`, nudges position, cycles colour when absent) so **server board == client board** → 7 emission rule: if commands were parsed → **one `lesson_step` per command, the FIRST carrying all accumulated cleaned speech and the rest `speech: ""`**; else when cleaned speech > **260 chars** flush a speech-only step split at a word boundary → 8 on stream end: flush remaining speech in ≤260-char chunks; append command-stripped assistant text to `lesson.history` + `ateacher_messages` (role=assistant, type=lesson, raw with commands); emit `chapter_complete`; save board snapshot to `ateacher_board_snapshots`; sync session; xAPI `concept_mastered`; KG `record_interaction` (confusion_count>0 → CORRECT_SLOW else CORRECT_FAST).

**D. Client playback** (`lesson_controller.dart`) — see G.5. **E. Barge-in** — see G.6.

**F. Attention resets / spaced review.** Client `SessionManager` fires every **600 s** → `attention_reset` → server cancels the stream, emits a fixed English break sentence as a speech-only step + `awaiting_resume`. The planner's `ATTENTION_RESET`/`SPACED_REVIEW` slide types exist in `_slide_type_guidance` but are **not wired** (`ATIB §2.2F`, `§9.4`).

**G. Lesson close.** `stop_lesson` → stream cancelled, lesson stopped, DB ended; per-chapter mastery events → `ateacher_mastery_events` (confusion ≥2 → confused, ≥1 → practicing, else understood); final board snapshot saved; a background task emits `concept_mastery` then `generate_lesson_summary()` (1 LLM call) → `lesson_summary` → client summary overlay; xAPI `lesson_completed` with score = chapters_done/total.

Protocol surface (`ATIB §2.1`): client→server `start_lesson`, `student_question`, `pause_lesson`, `resume_lesson`, `continue_after_question`, `next_chapter`, `stop_lesson`, `clear_board`, `attention_reset`, `restore_session` (10); server→client `lesson_status` (`teaching|answering_question|awaiting_resume|paused|ended|attention_reset|restored`), `teacher_info`, `lesson_blueprint`, `lesson_plan`, **`lesson_step {speech, commands[], session_id}` — the unit of teaching**, `chapter_complete`, `concept_mastery`, `lesson_mastery`, `board_snapshot`, `lesson_summary`, `error`.

## G.5 Client step queue + TTS/animation pairing rule (`ATIB §2.2D`, `§2.3`, `§5.3`)
`lesson_step` events append to an ordered `Queue<_LessonStep>` of (speech, commands) pairs. `_processStepQueue()` runs steps **sequentially**; within a step, TTS `playText` (prefetched bytes) is awaited **in parallel** with `whiteboardController.executeCommands()` via `Future.wait`, so **speech and handwriting start together and the next step begins only after BOTH finish**. The controller prefetches the next chunk's audio while the current one plays; `waitForPlaybackStart()` ensures board animation begins when audio actually starts, not when it was requested. Topic progress panel + live caption update from `currentSpeechText`. When the queue drains **and** `chapter_complete` has arrived, the client auto-emits `next_chapter` until the last chapter, then shows the summary. Explicit statement of the pairing rule (`ATIB §5.3`): "each `lesson_step` pairs ≤260-char speech with its draw commands; next step begins only after BOTH audio and animation complete (`Future.wait`) — this is the entire speech/drawing synchronization design; **there is no word-level alignment**."

## G.6 Barge-in flow (`ATIB §2.2E`, `§5.3`)
Deliberate (UI): any tap on Ask/mic or keyboard Space → `askQuestion()` stops TTS instantly (`_ttsPlayer.stop()`), **clears the step queue**, emits `student_question {session_id, question_text, image_base64?, mime_type?, selected_item_id?}`. Server: sets the cancel flag (`_active_streams[session_id] = False`, checked per token), pauses the lesson, optionally runs Groq Vision on an attached image, appends the question to history + `ateacher_messages` (type=question), classifies via `classify_response_sync` (8b, 64-token JSON) → KG `record_interaction`, emits `concept_mastery` + `lesson_mastery`, then `_stream_question_answer()` re-streams **on the existing board** (board_state = `items_for_ai()` with ids). Student taps Continue → `continue_after_question` → `_continue_chapter_after_question()` with an explicit "pick up where you left off, don't repeat" user turn. Automatic voice barge-in exists (`interrupt_detector.dart`: amplitude polled every 100 ms, normalized > 0.3 → interrupt, 1500 ms silence → `onSilenceAfterSpeech`) but is **dead code, never wired into the lesson screen**.

## G.7 Voice stack (`ATIB §5`, `§1.4`)
**TTS — Microsoft Edge-TTS** (`edge-tts==7.2.8`), free neural voices, mp3 24 kHz mono, synthesized per speech chunk (≤260 chars from the streaming step, internally re-chunked at **350 chars** on sentence boundaries), fetched over **HTTP GET** `/api/tts/stream?text=…&voice=…`.
- **9 voices**: `en-US-AriaNeural`, `en-US-JennyNeural`, `en-GB-SoniaNeural`, `en-US-GuyNeural`, `en-GB-RyanNeural`, `en-AU-WilliamNeural` (Leo's — *missing from the backend catalog*), `hi-IN-SwaraNeural`/`hi-IN-MadhurNeural`, `ne-NP-HemkalaNeural`/`ne-NP-SagarNeural`. `VOICE_LANGUAGE_CODES`/`LANGUAGE_STT_CODES` map voice → Whisper BCP-47 hint (`config.py:82-99`).
- **Expressive presets** (`_STYLE_PRESETS`, `tts_service.py:63-69`): `default +0%/+0Hz`; `question −6%/+8Hz`; `emphasis −10%/+4Hz`; `excited +8%/+6Hz`; `calm −8%/−4Hz`. `infer_style()` classifies each sentence by punctuation (`?`→question, `!`→excited) and ~60 keyword triggers ("watch this", "the key here is", "don't worry", …); `text_to_audio_bytes(auto_style=True)` splits into sentences, batches consecutive same-style sentences and synthesizes each batch with its preset.
- Reliability: 2 retries + exponential backoff (0.4 s base) on edge-tts/OSError/Timeout; 15 s stream timeout; voice fallback to `TTS_VOICE`; 0.2 s inter-request delay; bounded semaphore `TTS_MAX_CONCURRENT_SYNTH=3` with 12 s slot timeout → HTTP **503 `tts_server_busy` + `Retry-After: 2`**.
- Caching: server LRU 128 keyed `sha256(voice|text)`; client prefetch LRU 24 entries, 1 parallel download, 350 ms soft-wait before direct fetch, 4 retries on 502/503, `BytesSource` playback via `audioplayers`.
- **Known flaw**: the endpoint is not actually streaming (`b"".join`), so latency = full synthesis time. Prescribed fix: true POST chunked streaming + `just_audio`/`StreamAudioSource` gapless playback + word-boundary events for caption sync.

**STT — Groq Whisper** `whisper-large-v3-turbo` (configurable), `response_format=verbose_json`, temperature 0, optional BCP-47 hint from the session voice/language map (avoids auto-detect), 25 MB cap, WAV 16 kHz mono from the `record` package (also webm). Confidence estimated from `no_speech_prob` or mean `exp(avg_logprob)`, **fallback 0.85 is fabricated** (audit D-18).

**Models behind the engine** (`ATIB §1.4`, `§9.2`): Groq only — `llama-3.3-70b-versatile` for LEARNING_ANALYZER / SESSION_PLANNING / SLIDE_SCRIPT / DIAGRAM / QUIZ / MULTILINGUAL / ADAPTIVE_RETEACH; `llama-3.1-8b-instant` for DRAW_CMD_PARSING / RESPONSE_CLASSIFY / BOARD_SUMMARIZE; `meta-llama/llama-4-scout-17b-16e-instruct` for vision. 10 TaskClasses, latency budgets that only log, `fallback=None` everywhere (fallback branch unreachable), no retry on stream, MULTILINGUAL unused. Streaming `max_tokens: 2048` for slide script — long chapters can truncate mid-SVG (B-17).

## G.8 DEFECTS to fix rather than port, with evidence (`ATIB §9.4`, `§6`, `§10.1`, `§11`)
**Pedagogy discarded / never wired (~600+ dead lines; ~1400 LOC dead in total):**
- **Analyzer output discarded downstream** — Stage-1 blueprint "currently only reaches the teacher prompt, **not the planner**" (audit **P-10**, `ATIB §6`); fix = pass the blueprint into the planner (`ATIB §10.1 teacher_planner.py`).
- **Slide guidance never wired** — `_slide_type_guidance` (8 slide modes, `groq_service.py:675-751`) is dead; `needs_reteach` is "accepted but unread"; planner `spaced_review_slots`/`attention_reset_slots` are "generated then discarded" (`ATIB §4.10`, `§9.4`, `§2.2F`). The blueprint calls wiring these "**the highest-value porting decision**" (`ATIB §10.1 teacher_grammar.py`).
- Other never-invoked builders: `_level_runtime_guidance`, `_prior_knowledge_prompt`, `_misconception_note`, `_scaffolding_note`, `_teaching_arc_for_position`, `_lesson_density_for_mode`, `_bloom_questions_for_chapter` (`ATIB §9.4`).
- **Mastery inferred from question counts** — chapter completion records an automatic `CORRECT_FAST`/`CORRECT_SLOW` (confusion_count>0 → SLOW), which "**inflates mastery**" (audit **P-15**, `ATIB §6`, `§2.2C.8`); per-chapter outcomes are derived purely from confusion counts (≥2 confused, ≥1 practicing, else understood) (`ATIB §2.2G`); and asking a question is scored as a failure — the "**question = INCORRECT_CARELESS**" heuristic is on the do-not-copy list (`ATIB §11`). Missing piece to add: "real assessment capture (quiz grading — currently questions are classified as failures)" (`ATIB §11`).
- **Chapter completion auto-success** — same mechanism as above: `record_interaction` fires on chapter end with a synthetic correct-quality value rather than on evidence (`ATIB §2.2C.8`, `§6`).
- **Spaced repetition inert** — designed via planner `KNOWN CONCEPTS (skip these)` + `get_known_concepts()`, but the KG is keyed **per session**, so `get_due_concepts`/`get_known_concepts` are never called and cross-lesson review cannot work; fix = re-key by **student** (`ATIB §6`, `§10.1 teacher_knowledge_graph.py` — "the single biggest product upgrade").
- Client-side SM-2 mirror `KnowledgeTracker` is "fully disconnected" (`ATIB §6`, `§1.3`).

**State machine defects:** no `try/finally` around token loops (a Groq error wedges `_active_streams=True` forever); the cancel bool is not a mutex (double-start interleaves chapters); pause/resume restarts chapters from scratch; **websocket-created sessions key on a different UUID than the DB row → persistence FK-fails silently** (audit **B-06**, `ATIB §1.2 session_service.py`); disconnect does not stop the LLM stream (burns tokens into an empty room); 7 unbounded global registries leak (`ATIB §9.4`, `§11`).

**Streaming defects:** 20-40 s opaque planning gap with no progress UI; blocking diagram specialist inside the token loop; speech cleaning is O(n²) over accumulated text; **`_emit_steps` gives all speech to the first command so later WRITEs animate silently** (`ATIB §9.4`).

**Frontend defects:** step-queue races on pause/ask; `chapter_complete` double-advance; no `session_id` filtering on socket events (stale-session bleed); `copyWith` cannot clear `studentQuestion` (Continue is a no-op); erase wipe deletes content written during the wipe; PDF export drops all SVGs; touch devices cannot reveal controls; contrast failures (1.5:1); per-character full-repaint jank (`ATIB §9.4`).

**Content/grammar defects:** NEXT_SLIDE mandated and banned simultaneously; `[DRAW_SVG` bracket confusion (normalized in 3 places); a WRITE containing `]` truncates; text height estimated by 3 disagreeing heuristics; MCQ annotation `target_id` never populated (id stored in `text`) (`ATIB §3.1`, `§9.4`); `flutter_markdown` discontinued; `socket_io_client` 2.x forces polling.

**Security/ops defects:** no socket auth, CORS `*`, IDOR on sessions, tokens in query strings (S-03/S-04/S-05); `POST /api/lesson/start` unauthenticated; no output moderation and **no injection defense** — student context is concatenated with an instruction to prioritize it (**S-17**); no consent flow, age gating, PII handling or rate limiting; **no token/cost accounting at all** (latency only, in memory); a **live Groq API key committed in `render.yaml`** (S-01) which "must be revoked, never copied" (`ATIB §9.1`, `§9.3`, `§11`).

**Must be redesigned for multi-tenant SaaS** (`ATIB §11`): socket JWT + lesson-ownership checks + school-scoped rooms on every event; move `_sessions`/`_board_states`/`_active_streams`/`_session_plans`/`_session_blueprints` to Redis with TTLs (process-local + unbounded today, breaks with >1 worker); DB-row-first session identity; MySQL `create_all` + LONGTEXT → Postgres + Alembic + JSONB, KG out of SQLite and re-keyed by student; ASchool JWT instead of `SERVER_API_KEY`+uuid tokens; uploaded images into ASchool file storage with retention rules; TTS at scale (Edge-TTS is unofficial and rate-limited; a single Flask route with a 3-slot semaphore "will not survive a classroom" — needs per-school queueing/caching and a fallback vendor).

**Explicit do-NOT-port list** (`ATIB §11`, verbatim items): `session_service.py` session-id logic; `websocket/events.py` triple-duplicated token loop without `try/finally`; the truncated `_log_chapter_mastery` stub; `InterruptDetector`; `HandwritingAnimator`; `DrawingOperation` registry; client `KnowledgeTracker`; `TeacherAvatar`; `image_gen_service.py`; `board_state_compressor.py`; `parse_stream_chunk`; `SYSTEM_PROMPT_TEMPLATE`; the "question = INCORRECT_CARELESS" mastery heuristic; `get_active_session()` cross-user fallback; TTS GET-with-text-in-URL; eventlet specifics; `render.yaml` entirely. Also: `chemistgpt.txt`/`physicsgpt.txt` (third-party prompts) must not ship, and `finalprompt.md`'s SDL design is unimplemented — **do not port as-is**.

**What DOES work well — port these** (`ATIB §9.4`): the bracket-holdback streaming parser; `repair_svg` sanitizer; the board-state `items_for_ai` feedback loop; prompt-composed DB personas; per-sentence TTS style inference; `lesson_step` pairing (speech+commands with a completion barrier); the blueprint JSON schema; the SM-2 knowledge graph; and the single-draw-method grammar ("it reliably produces valid SVG from a 70B model").

**Port target shape** (`ATIB §10`, for orientation): new services `teacher_board.py`, `teacher_grammar.py`, `ai_teacher.py`, `teacher_session_orchestrator.py`, `teacher_planner.py`, `teacher_knowledge_graph.py`, `teacher_voice.py` under `backend/app/services/ai/`; 8-9 `ai_teacher_*` tables on `SchoolModel`; blueprint `backend/app/api/v1/ai_teacher.py`; Socket.IO rooms `lesson:{lesson_id}` with JWT handshake and `seq`-acked steps; Celery tasks (`generate_lesson_summary`, `export_lesson_pdf`, `compute_spaced_reviews`, `compress_board_state`, `prewarm_planning`); web player under `frontend/app/dashboard/ai-teacher/` using a **DOM+SVG hybrid** (absolutely-positioned divs + Caveat-like webfont per-char reveal, KaTeX math, inline SVG with stroke-dashoffset tracing); guardrails mapped onto existing `workbench.py` (`AIToolRegistry` key `ai_teacher_lesson`, `GuardianAIConsent`, `detect_injection`/`moderate`/`pseudonymize`, token_hub reserve→reconcile ledger); phases P1–P5 sized L/L/M/M/M with per-phase e2e tests; cost estimate ~$0.01-0.03 per chapter, ~$0.05-0.15 per 5-chapter lesson, +~$0.005 analyzer/planner.

---

## Open gaps in the sources (report does not specify)
- `PUSA` contains **no per-plugin screen or widget specs** — only §0 conventions before the `<!--APPEND-->` marker; the promised 39 plugin specs + Appendix P (8 platform-core manifests) are unwritten.
- `PTTA` does not specify the `permissions.yaml` / `events.yaml` schema versioning, the `GET /plugins/widgets` error/ETag semantics beyond `registry_version`, or the exact `spec.chart` sub-schema for `type: chart` (only "maps onto recharts wrappers").
- `PTTA §2.6` does not enumerate the Flutter `SpecRenderer` field-level schemas (only the 6 renderer keys).
- `ATIB` does not give exact char-timing constants consistently (30-60 ms/char in §8.1 vs a 30-140 ms envelope in §1.3/§3.3) and does not specify how `HIGHLIGHT` is produced (listed in the renderer's accepted set but absent from the directive table).

