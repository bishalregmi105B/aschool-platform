# Plugin / marketplace / entitlement audit — condensed evidence

Source: Explore agent — read all 9 files in `backend/app/plugins/`, **all 59 manifests** (52 module + 7 legacy), `api/v1/plugins.py`, `models/plugin.py`, all 7 module `routes.py`+`hooks.py`, all 6 `config_schema.yaml`, the gate in `app/__init__.py`, `tasks/trial_expiry.py`, `webhooks/__init__.py`, `frontend/lib/plugins.tsx`, marketplace/settings pages, **all 190 dashboard pages (gate scan)**, `frontend/themes/*`, and both design audits.

## Headline
Genuinely WordPress-like on **discovery/mirroring** (filesystem is the catalog, `refresh_registry`, zero seeding — the E230–E238 work is really implemented). Not a plugin architecture: **45 of 52 module folders contain only `manifest.yaml` + an empty `__init__.py`**; their code lives in `app/api/v1/*.py`, statically mounted, un-swappable. Only 7 are self-contained (`ai_adaptive_learning` 647 L, `biometric` 736, `disaster_management` 664, `incident_management` 822, `multi_branch` 638, `social_ads` 656, `white_label` 216). `ai_suite/` has no `__init__.py` at all.

**Real counts: 59 manifests — not 57.** 46 published, 13 unpublished, 12 deprecated, 3 coming-soon.
**Flutter: 26 of 45 declared `feature_folder` values point at directories that do not exist.** `flutter_user/lib/features` is empty.

`ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md` is stale to the point of being misleading: every price in it is wrong post-E234; it calls `biometric`/`multi_branch` "unimplemented/delisted" when both now have 600–740-line real routes; it says `timetable` and `hostel` are free when they are 99 and 149.

## The money problem (fix first)

**B1 CRITICAL — plan grants hand out every paid plugin for free, permanently.**
`entitlements.py:122-261` `ensure_free_plugins` walks `PLAN_PLUGIN_TIERS` and inserts `SchoolPlugin(active=True, is_trial=False, trial_ends_at=None, next_billing_date=None)` for **every published non-coming-soon non-deprecated manifest in the plan's cumulative tier set**:

| plan | plugins | paid plugins | catalog value given away |
|---|---|---|---|
| free | 13 | 0 | NPR 0 |
| starter | 20 | 7 | **NPR 693/mo** |
| growth | 34 | 21 | **NPR 2,879/mo** |
| enterprise | 43 | 30 | **NPR 5,670/mo** |

There is **no plan billing anywhere**. `School.plan` is set from an **unauthenticated `POST /auth/register` body** (`auth.py:449` `plan_map`, `:507 ensure_free_plugins(school, plan=plan)`) with no payment step; the register page shows "NPR 399/month Starter" / "NPR 999/month Pro" and posts `plan: selectedPlan` (`register/page.tsx:591`). **Anyone can self-register with `plan:"pro"` and receive NPR 2,879/mo of plugins forever, free** — and `plan:"enterprise"` is accepted via `normalize_plan`'s `premium→enterprise` alias.

**B3 CRITICAL — `/subscribe` accepts unverified payment references.** `plugins.py:523-690` demands `payment.provider` + `payment.transaction_id`, 402s without them, then stores them in `config["last_payment"]` and flips `is_trial=False, active=True`. The docstring is candid: "provider-side verification is NOT attempted". `SubscribeDialog` is a free-text form ("You can still record an offline payment below"). **Any school_admin permanently activates any paid plugin by typing a fake transaction id.** Most exploitable path in the system.

**B2 CRITICAL — no recurring billing; `next_billing_date` is decorative.** `grep next_billing_date` → only writes (`plugins.py:499/650`, `billing.py:71`) and one echo-back read. Of 15 beat jobs the only plugin one is `expire_trials`. Nothing charges a renewal, marks a lapse, or deactivates on non-payment.

**B5 HIGH — no downgrade path.** `ensure_free_plugins:238-241` explicitly never touches existing rows; `grant_plan_plugins` (`entitlements.py:76`) — the only function with reactivation logic — is **dead code, nothing calls it**. Enterprise→free keeps all 30 paid plugins active forever. `School.plan_expires_at` and `School.status` (default `trial`) are **never read** except an analytics counter — a `suspended` or `cancelled` school retains full access.

**B4 HIGH — expired trials keep working up to an hour, and the DB row lies.** The request-time `_trial_expired` filter (`app/__init__.py:373-392`) is good defence-in-depth, but the 300 s cache is populated *from* the filtered list so a mid-window expiry keeps working until the key expires, and `expire_trials` runs hourly. Worse, `trial_expiry.py:38-39` sets **both `active=False` and `uninstalled_at=now`**, conflating "trial lapsed" with "admin uninstalled" → `install_plugin` then refuses reinstall ("trial already used") and `/subscribe` is the only recovery; `activate_plugin` wrongly says "not installed — install it from the marketplace first".

**B9 MEDIUM — infinite trials.** `install_plugin` refuses a consumed trial, but `POST /<slug>/trial` (`plugins.py:440`) only checks `existing.trial_started_at` (`:464`) — and `/subscribe` **clears `trial_started_at = None`** (`:647`). Sequence: trial → subscribe (fake txn) → uninstall → `/trial` again succeeds.

**B10 MEDIUM — Stripe webhook activates arbitrary slugs.** `webhooks/__init__.py:534-556` trusts `session.metadata.plugin_slug` and creates/activates a row for **any string** — no `Plugin` existence check, no `is_published`, no `coming_soon` guard, no dependency check, and it never runs the `activate` hook so plugin tables are not created.

**B7 MEDIUM — `white_label.uninstall` corrupts every tenant.** `_run_plugin_hook` (`plugins.py:718`) passes only `db`, never the school id. `white_label/hooks.py:73` therefore does `for school in School.query.filter(...).all()` and drops `School.settings["white_label"]` **platform-wide** — school A uninstalling wipes school B's branding.

**B8 MEDIUM — the `deactivate` hook is never invoked.** `_run_plugin_hook` is called for `activate` (`plugins.py:435/507/671`) and `uninstall` (`:718`); `/deactivate` (`:746`) calls neither. All 7 modules ship a `deactivate(db)` that can never run.

**B11 LOW — `max_students` never derives from plan.** Defaults to 100 (`models/school.py:47`) and register never sets it — a school that chose "Pro / Unlimited students" is capped at 100 by `student_cap_error`.
**B12 LOW — SMS credits unenforced.** `sms.py:186` reads `config["credits_topup"]` only to display; no send path checks it.
**B13 LOW — `install_count` is one-way** (incremented at `billing.py:167`, `plugins.py:502`, `:624`; never decremented; `/subscribe` double-counts).

## Gating holes

**H1 CRITICAL — `fees` and `exams` root pages import `PluginGate` and never use it.** `fees/page.tsx:5` imports it, `:52-54` returns `<FeeOverviewContent/>` bare. Same at `exams/page.tsx:6` and `:81-83`. Every *child* page is gated, so it reads as a regression from a page split. Backend is 33/33 and 25/25 gated, so the leak is UX-only — but the school sees a Fee Management shell with error cards instead of the upsell.

**H2 CRITICAL — `advanced_analytics` (premium 999) has zero enforcement.** `analytics.py` has 6 routes, **0 `@plugin_required`** (`:288 /overview`, `:302 /academic`, `:403 /financial`, `:479 /benchmarking`, `:524 /teacher-dashboard`, `:590 /superadmin-dashboard`), and the 3 analytics pages have no `PluginGate`. **`analytics.py:479 /benchmarking` returns district+national comparisons — the exact payload `benchmarking.py:16` charges NPR 1499/mo for behind a gate.** Any authenticated school_admin on the free plan gets the premium analytics product.

**H3 HIGH — `website_builder` (299): 6 of 7 subpages ungated** (`editor`, `themes`, `pages`, `domain`, `seo`, `ai-builder` — only the root has a gate). Backend gaps: `website_builder.py:268 /themes`, `:279 /themes/<id>/preview-css`, `:564 /sections/available`. Domain management *is* gated so custom domains don't leak, but the visual editor and theme catalog do.

**H4 HIGH — theme "pro" tier is decoration.** `themes/registry.ts` marks 6 of 10 `tier:"pro"`; `themes/page.tsx:292` renders a gold PRO badge and `:310` renders **the same enabled Apply button** for pro and free. `theme_engine.py:199 apply_theme` never checks tier. `themes.py:13/22/34` (list/get/preview-css) are ungated — only `/apply:45` requires `website_builder`.

**H5 HIGH — `hr_payroll` (199): 5 of 9 pages ungated** (`hr/expenses`, `hr/expense-categories`, `hr/staff-attendance`, `hr/leaves/report`, `hr/payroll/settings`).
**H6 HIGH — `gps_tracking` (299): 4 of 8 pages ungated** (`transport/routes`, `transport/allocation`, `transport/pickup-points`).
**H7 HIGH — `design_studio` root page ungated** (`designer/page.tsx`, 367 L, 0 gates). Backend gaps: `design_studio.py:1233 /templates/<key>/assets/<path>` and `:1253 /thumbnail` serve paid template artwork with weak auth.

**H8 HIGH — alias-mismatch fragility class.** 20+ pages gate on **alias keys no installed row ever carries**: `visitors/page.tsx:20` gates `"visitors"` (real: `visitor_management`), all `hr/*` gate `"hr"` (real: `hr_payroll`), `communications/*` gate `"communications"` (real: `sms_notifications`), `library/*` gate the **deprecated** `library`, `ai-tools/*` gate the **deprecated** `ai_tools`. These work only because `plugins.tsx:93`'s reverse-alias loop adds the canonical slug. **Remove one alias entry and 20+ pages silently open.**

**H10 MEDIUM — `exams/online/questions` gates `elibrary`** while every sibling gates `exams`. Question banks belong to exams.
**H11 MEDIUM — `communications.py` chat is ungated** (`:35`, `:50`, `:84`) while the same blueprint's diary routes gate `notices`.
**H12 MEDIUM — mobile APIs are ~85% ungated.** `parent_app.py` 3/19 gated (results, timetable, bus-info, conferences all open); `student_app.py` 5/14 (`:281 /results`, `:494 /lms`, `:606 /portfolio`, `:876 /fees` open); `teacher.py` 2/6. `mobile.py:37` returns `installed_plugins` and hides modules **client-side**, but the endpoints answer regardless. A parent app hitting `/parent-app/outstanding-fees` reads fee data for a school that never bought `fees`.
**H13 MEDIUM — `plugins.py` `/marketplace:242` and `/<slug>/config-schema:872` lack `@school_required`**; config-schema leaks any plugin's settings schema to any authenticated user of any school.

## Duplicate/overlapping plugins — verdicts
- **`library` vs `library_management`** — `library_management` is real; `library` unpublished+deprecated. But same blueprint, same models, **same 99 price**, and **the frontend gates on the deprecated slug**. `library_management`'s manifest route `/library` normalizes to `/dashboard/library`, colliding with `library`'s own route.
- **`incidents` (premium 299) vs `incident_management` (growth 199)** — genuinely different code (8 routes vs 822 lines; separate models and FE trees), intended as a two-tier chain. **But pricing is inverted: the base tier costs 299 and the upgrade that `depends_on: [incidents]` costs 199.** A school must buy 299 to be allowed to buy the 199 upgrade.
- **`ai_tools`/`ai_suite`/`ai_insights`/`ai_grading`/`ai_tutor`/`ai_adaptive_learning`/`advanced_analytics`/`benchmarking`** — `ai_suite` (399) is the only real catalog item; the other 7 are unpublished+deprecated licensing shells aliased to it. `ai_suite` has no blueprint and no models by design. Residue: `ai_tutor.models_module: app.models.ai_tutor` **does not exist**; `advanced_analytics` points at `app.api.v1.reports` (which is the *free* `basic_reports`); FE pages still gate `ai_tools`; all 7 have 404 sidebar subitems.
- **`portfolio` (399) vs `student_portfolio` (149)** — same blueprint and models; the deprecated one is priced **2.7× the canonical**.
- **`website_builder` (299) vs `basic_website` (0)** — intentional chain, but **`SIDEBAR_SUPERSEDED_BY` (`loader.py:473`) is declared and never read** — `get_frontend_sidebar` never consults it, so both nav entries render at the same route when both are installed. That is exactly the bug the map was added to fix.
- **`elibrary` (99) vs `digital_content` (499)** — deprecated duplicate at 5× the price, blueprint pointed at `design_studio`.
- **`social_hub` (699) + `social_ads` (499)** — both withdrawn and broken. `social_ads depends_on: [social_hub]` which is unpublished, so `social_ads` is **uninstallable** even if republished. Both declare `/dashboard/social-hub` which **does not exist** — 12 dead routes. Both backends still mounted and gated.
- **`emergency` (299) vs `disaster_management` (299)** — same price for base and upgrade; a school pays 598 for what reads as one product.
- **THE REVENUE LEAK:** `/ai-tools/question-paper` + `/lesson-plan` (gated `ai_tools`) are duplicated at `design_studio.py:585` + `:607` gated **`digital_content`** — a deprecated 499 slug that aliases to `elibrary` (99). **So a 99/mo elibrary install unlocks the AI question-paper and lesson-plan generation that ai_suite charges 399 for.** The design doc claims this was fixed in E3; the aliases were fixed, **the route gates were never repointed**. Same for `/ai/insights:627`, `/ai/risk-students:640` (`ai_insights`) and `/ai/homework-help:653` (`ai_tutor`).

## Plugin cache `school:<id>:plugins`
Written once (`app/__init__.py:364-393`, 300 s Redis). Invalidated by **three identical duplicated helpers** (`billing.py:274`, `entitlements.py:340`, `trial_expiry.py:57`).
- **C1 HIGH** `PUT /plugins/<slug>/config` (`plugins.py:795-851`) never invalidates. Gating is unaffected (cache holds slugs only), but nothing invalidates `analytics_overview:<school_id>` (also 300 s) whose payload includes `active_plugins`, so the dashboard plugin count is stale for 5 min after any install.
- **C2 HIGH** direct `SchoolPlugin` mutations bypass invalidation — `plugins.py:472-479` mutates inline and happens to call the helper at `:511`, but there is **no `after_commit` event listener enforcing it**, so any future writer silently serves stale entitlements for 5 minutes.
- **C3 MEDIUM** `refresh_registry` (`loader.py:281`) unpublishes plugins **without touching any school cache** — and since `g.installed_plugins` is the only thing `@plugin_required` checks, a just-unpublished plugin keeps working indefinitely (the mirror row is unpublished but the `SchoolPlugin` row stays active). Same for a plugin folder deleted from disk.
- **C4 MEDIUM** `PluginLoader._plugins` is a **per-process class dict** (`loader.py:38`) and prod runs `-w 4`. `refresh-registry` mutates only the worker that served the request; workers 2-4 keep the old registry until restart, so marketplace/sidebar/config-schema responses differ by which worker answers.
- **C6 LOW** the gate filters only `active=True`, not `is_deleted` — a soft-deleted install still passes `@plugin_required` while being invisible in the UI (`entitlements.py:229` explicitly resurrects such rows, confirming they exist).

## Dependency resolution
15 `depends_on` declarations; **`conflicts_with` is empty everywhere** — the entire conflict mechanism is untested by any manifest. Enforced in 3 places (`billing.py:143-148`, `plugins.py:482-490`, `:596-604`/`:631-639`), one level deep, read from the DB mirror not the manifest.
- **D1 HIGH** dependencies are **not enforced on the path that actually provisions plugins** — `ensure_free_plugins:214-241` bulk-inserts with zero dependency logic, in alphabetical order (so `admission` inserts before `academics`). It works only because everything in the tier is granted anyway.
- **D2 HIGH** nothing enforces dependencies on **removal**. Uninstalling `basic_website` breaks `website_builder`; `incidents` breaks `incident_management`; `emergency` breaks `disaster_management`; `lms` breaks `ai_adaptive_learning`.
- **D3 MEDIUM** no transitive resolution, no auto-install — a 409 string naming only the first missing dep.

## Hooks / events
Lifecycle hooks work for the 7 module plugins (`activate` does `__table__.create(checkfirst=True)`, idempotent). Failures are swallowed by design (`plugins.py:98`) — **a plugin whose tables failed to create is billed and 500s on first use.**

Event bus: 17 `@on` listeners in one 904-line `listeners.py` — the antithesis of plugin-local. 14 events genuinely fire (attendance.marked, assignment.created/submitted, fee.paid, notice.created, results.published, gamification.points_awarded/badge_earned, incident.created, emergency.alert_broadcast, admission.accepted → auto-creates student). But:
- **E1 HIGH** `listeners.py:363` registers `@on("iemis.imported")`; the emitter at `iemis_importer.py:1178` fires **`iemis.import_completed`**. The import-complete notification never fires.
- **E2 HIGH** 4 emitted events have **no listener at all**: `attendance.student_absent`, `library.book_overdue`, `gamification.streak_milestone`, `whatsapp.message_received`. And **`register_plugin_events` is never called anywhere**, so `_event_plugin_map` is permanently empty → `emit_for_school`'s plugin check always resolves `required_plugin=None` and gates nothing. **`emit_for_school` is `emit` with extra steps.**
- **E3 HIGH** manifest `events:` blocks are pure documentation — nothing reads `manifest["events"]`, and the manifests use a **different naming convention than the code** (`fees.collected`/`exams.result_published`/`notice.published` vs the emitted `fee.paid`/`results.published`/`notice.created`). The declared inter-plugin graph does not exist.
- **E4 MEDIUM** listeners are not plugin-scoped — only `_award_points_if_enabled` checks installation. `on_incident_created` SMSes schools without `incidents`; `on_emergency_alert` bulk-SMSes 1000 users for schools without `emergency`.
- **E5 MEDIUM** `emit()` is synchronous inside the request transaction: `_create_school_notifications` (`listeners.py:511`) loops up to **500 users** creating rows and **commits mid-request**; `on_emergency_alert` (`:891`) queries 1000 phones and sends bulk SMS synchronously. `emit_async`/`emit_async_for_school` exist and are **never used**.

## Settings schema
Storage is untyped JSONB. Validation at `plugins.py:795-851` is "must be an object, ≤16 KB, `last_payment` reserved" — that is the entire server-side contract.
- **S1 HIGH** `config_schema.yaml` is parsed (`loader.py:236`) and served (`plugins.py:872`) and the settings page renders typed controls from it, but **`PUT /config` never consults it**: no type check, no `min` enforcement (`library_management` declares `min: 0` on 4 numeric fields — ignored), no unknown-key rejection. `POST {"fines.per_day": "not-a-number"}` is stored and `library.py:34 _fine_settings` then does float math on a string.
- **S2 MEDIUM** only 6 of 59 plugins ship a schema, and 2 of those 6 are for **deprecated** plugins. Real config consumers **without** a schema: `hr_payroll` (`hr_payroll.py:213` reads a whole nested `config["payroll"]` object; also `tasks/payroll_monthly.py:54`) and `sms_notifications` (`sms.py:186 credits_topup` — a **billing-relevant** value any school_admin can set to 999999 through the generic editor).
- **S3 MEDIUM** the settings UI has an **arbitrary key/value editor** with "Add a setting" (`settings/page.tsx:438-521,494`) and `?replace=1` full-dict saves, so admins can invent keys or overwrite billing-relevant ones (only `last_payment` is reserved). A second hardcoded screen (`communications/whatsapp/ai-settings`) writes the same blob through the same endpoint with no shared validation.
- **S4 MEDIUM** `setPath` (`settings/page.tsx:115-126`) overwrites a non-object node with `{}` when a dot-path traverses it — saving `ai_settings.working_hours.start` when `working_hours` is a string silently destroys it, and `get_dotted` returns the default so the loss is invisible.
- **S5 LOW** `GET /plugins/<slug>/config` has `@school_required` but **no `@role_required`** — a student can read `hr_payroll` payroll settings and SMS credit balances.
- **S6 LOW** no defaults are ever materialised; every consumer duplicates its defaults inline (`library.py` comments "MUST mirror the defaults below") — two sources of truth by construction.

## Empty / stub plugins
**Marketed (published) with no working implementation:** `ai_suite` (premium 399 — the flagship; no blueprint, no models, no routes.py, no hooks.py, no `__init__.py`; works only because 7 deprecated plugins' blueprints stay mounted; both declared Flutter folders missing; 4 sidebar subitems of which `/analytics` is ungated and `/ai-tools` gates the deprecated slug) and `basic_website` (core, no sidebar block, shares its route with the 299 premium plugin, declared Flutter folder missing).

**Unpublished but still priced, mounted, and installable via the Stripe webhook:** `social_hub` 699 (12 routes, real models, **zero frontend**), `social_ads` 499 (656 lines, **zero frontend**, uninstallable), `ai_tutor` 1499 (1 route, missing models module), `ai_insights` 999 (2 routes), `ai_grading` 599 (no own routes), `advanced_analytics` 999 (blueprint points at the free `reports`; its real surface is ungated), `benchmarking` 1499 (`analytics.py:479` serves the same data free), `digital_content` 499, `portfolio` 399, `library` 99, `ai_tools` 1499.

**Coming-soon (disabled button) but MORE complete than several published plugins:** `whatsapp_bot` (511-line working backend), `gps_tracking` (355-line backend + ESP32 hardware in repo), `conferences` (428-line backend). The flag looks stale.

**12 published plugins promise Flutter screens that do not exist:** biometric, multi_branch, white_label, website_builder, disaster_management, incident_management, health_records, hostel, visitor_management, sms_notifications, file_management, iemis_importer.

## What a real WP-style architecture still needs
1. **A registration API.** Adding a plugin means editing **6 core files**: `STATICALLY_MOUNTED_MODULES` (`api/v1/__init__.py:9`), `SLUG_SECTION_MAP` (`loader.py:392`), `CORE_ALWAYS_SLUGS` (`:366`), `PLUGIN_SLUG_ALIASES` (`decorators.py:13`), `PLUGIN_LABELS` (`plugins.tsx:200`), `PLUGIN_SECTION_ORDER`+`PLUGIN_SECTION_ITEM_ORDER` (`sidebar.tsx:196/214`). A plugin cannot be dropped in.
2. **Scoped activation hooks** — `activate(db)`/`uninstall(db)` get no `school_id`, so per-tenant activation is impossible and white_label corrupts other tenants. Need `(db, school_id)` + an `upgrade(db, from, to)`.
3. **Admin menu injection** — half-built; section order, item order, labels and icon mapping all live in the frontend, `SIDEBAR_SUPERSEDED_BY` is dead, and **34 declared routes resolve to no page**.
4. **A capability system** — `visible_to` (nav only) and `@role_required` (7 hardcoded roles) are unrelated; no plugin can define a capability; `Plugin.visible_to_roles` is defined and never read.
5. **Plugin-provided migrations** — creation only, no ALTER, no version tracking, no Alembic integration for plugin tables.
6. **Plugin-owned frontend** — zero modules have `frontend/` or `mobile/`; all 190 pages live in `frontend/app/dashboard/**` with hand-written gates; no widget/block registry.
7. **Versioning** — only **2 of 59 manifests** declare `version:`; `refresh_registry:320` defaults the other 57 to `1.0.0` permanently. No `requires_platform`.
8. **Update mechanism** — none, and per-process registry (C4) makes even metadata refresh unreliable under 4 workers.
9. **Isolation** — 45 of 52 have no code; blueprints statically mounted so a broken import at `api/v1/__init__.py` is fatal to the whole app (only the dynamic path at `loader.py:202` is failure-tolerant); models shared across plugins (`app.models.social` serves social_hub AND social_ads; `app.models.incident` serves incidents AND incident_management), so "plugin-owned tables" is fiction for most.
10. **Marketplace primitives** — `screenshots`, `tags`, `avg_rating`, `video_demo_url`, `is_featured` columns exist and **nothing ever writes them**; no ratings/reviews; `PACKAGE_PLUGIN_SELECTIONS` (`marketplace/page.tsx:363`) is a hardcoded FE array whose `PackageCheckout` only lists what's missing and offers a Close button; no licensing keys; no purge option on uninstall.

## Agent's priority order
1. B3 fake-transaction subscribe → any paid plugin permanently
2. B1 self-register `plan:"pro"` → NPR 2,879/mo free, no payment path exists
3. H2 premium analytics + NPR 1499 benchmarking data fully ungated
4. B7 `white_label.uninstall` wipes every tenant's branding
5. B5 no downgrade/expiry/suspension enforcement anywhere
6. The elibrary(99)→ai_suite(399) AI generation leak via `digital_content` gates
7. H1/H3/H5/H6/H7 frontend gate gaps (fees, exams, website_builder, hr, transport, designer)
8. B9 infinite trials
9. B10 Stripe webhook activates arbitrary slugs
10. E1/E2/E3 dead listener, 4 orphan events, fictional event graph
11. C3/C4 unpublish doesn't revoke; per-process registry under 4 workers
12. S1 config schemas parsed, rendered, never validated
