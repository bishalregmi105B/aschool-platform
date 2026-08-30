# WP-STYLE PLUGIN ARCHITECTURE — RESEARCH + MIGRATION DESIGN (2026-08-30)

## How WordPress manages plugins (verified model)
1. **Filesystem is the catalog.** Plugins live in `wp-content/plugins/<folder>/<main>.php`; the main file starts with a plugin **header comment** (Plugin Name, Version, Description, Author, TextDomain). WP scans the directory at runtime — drop a folder in, the plugin appears in the admin list instantly. **No DB insert for the catalog.**
2. **DB stores only STATE.** `wp_options.active_plugins` = array of ACTIVE plugin file paths (+ per-site state on multisite). Deactivated = just not in the array.
3. **Folders are fully self-contained.** Each plugin dir carries ALL its code: main file, `includes/`, `assets/` (css/js), `templates/`, `readme.txt`, `uninstall.php`.
4. **Lifecycle hooks.** `register_activation_hook` (create tables/defaults on activate), `register_deactivation_hook` (cleanup-light), `uninstall.php` (full removal on delete).
5. **Versioning/updates** via `readme.txt` + update API; schema upgrades via `dbDelta()` in the activation hook.

## Where ASchool is today (delta)
| WP concept | ASchool now | Gap |
|---|---|---|
| Plugin folder w/ header | `backend/app/plugins/modules/<slug>/manifest.yaml` — loader.py already scans dir at startup ✅ | manifest lacks some header fields (author, config schema, uninstall hook) |
| Self-contained code | Blueprint/services live OUTSIDE (app/api/v1/*.py referenced by entry_points) | move/attach code into the module folder |
| FS = catalog | DB `Plugin` table is the catalog; populated by seed scripts ❌ | **marketplace must read the FS registry live**; DB Plugin table deprecated for catalog |
| DB = state only | `SchoolPlugin` per-school install/activate ✅ (matches WP) | keep |
| Activation hook | install = SchoolPlugin row only | add module-level `hooks.py::activate/deactivate/uninstall` |
| No seed needed | seed.py/seed_full.py hardcode/seed catalog | remove plugin seeding entirely |

## Target architecture (one folder = one plugin)
```
backend/app/plugins/modules/<slug>/
  manifest.yaml        # name, slug, version, description, author, category/tier,
                       # price_monthly, price_yearly, depends_on, published
  routes.py            # the plugin's Flask blueprint (moved from app/api/v1 where owned by the plugin)
  services.py|services/
  models.py            # plugin-owned tables (SQLAlchemy models, created on activate)
  config_schema.yaml   # settings screen definition (field, type, default, help)
  hooks.py             # activate(db), deactivate(db), uninstall(db) lifecycle
  tests/               # plugin tests
  README.md
  frontend/            # declarative: routes → frontend pages (FE tree stays, mapping declared here)
  mobile/              # mobile repo/screen declarations
```

## Runtime rules to implement
1. **Discovery**: loader scans `modules/` at startup AND exposes `POST /api/v1/plugins/refresh-registry` (superadmin) → re-scan without restart. Registry = in-memory; on scan, UPSERT catalog mirror rows into `Plugin` (for backward-compatible queries) and DEACTIVATE (published=false) any DB row whose folder vanished.
2. **Catalog reads**: `/plugins/marketplace`, `/plugins/installed`, sidebar/nav must read the REGISTRY (merged with SchoolPlugin state), never trust seed data.
3. **Seed scripts**: delete ALL plugin-catalog seeding from seed.py/seed_full.py (they keep schools/users/demo data only).
4. **Lifecycle**: on install → run module `hooks.activate` (create its tables via its metadata, seed its defaults); on deactivate → hooks.deactivate; on uninstall → hooks.uninstall (drop plugin-owned tables? default: keep data, only remove state — WP keeps data too; document).
5. **API contract unchanged** for frontend/mobile (same endpoints/shapes) — only the data source changes.
6. Config schema: `GET /plugins/<slug>/config-schema` serves config_schema.yaml → the existing /dashboard/plugins/[slug]/settings page renders the form from it instead of generic key/value.

## Migration steps (ordered)
1. Loader: add header parsing (author, config_schema path, hooks import), registry refresh API, catalog mirror upsert.
2. plugins.py: switch marketplace/installed/nav to registry-first.
3. Move each plugin's blueprint into its folder where the plugin owns it (start with the 7 newly implemented ones: white_label, biometric, multi_branch, adaptive_learning, social_ads, disaster_management, incident_management — they have no legacy callers), keep app/api/v1 shims importing from the new location for untouched ones.
4. hooks.py for the 7 new plugins (activate = create tables; the models already exist).
5. config_schema.yaml for 3-5 flagship plugins; settings page consumes schema.
6. Strip plugin seeding from seed scripts; seed_full keeps demo school/users.
7. Fresh-deploy check: empty DB + `create_all` + registry scan → marketplace lists ALL plugins with zero plugin seeding.
