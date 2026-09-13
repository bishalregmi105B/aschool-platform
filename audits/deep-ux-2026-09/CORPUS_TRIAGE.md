# Corpus Triage — Deep UX 2026-09

**Date:** 2026-09-13  
**Scope:** prior audit corpus only; claims below are leads to re-verify at current source.  
**Method:** read the requested root conventions, current `audits/` ledgers, reconciled historical digests, prior web/mobile inventories, plugin duplication work, current docs plans, and all files in `docs/competitor-audits/`. No prior report is treated as ground truth without a current-source check.

## Executive ledger

The repository already contains extensive architecture, route/model, plugin, test, and implementation-defect research. The latest seven competitor reports (all except eSchool SaaS) were deepened on 2026-09-12 with route/controller/migration/screen reads and several end-to-end traces. The ASchool corpus contains broad web/mobile inventories and a strong targeted all-screens/flow audit. However, the prior corpus does **not** satisfy this pass's required deliverable: it has no report-embedded screenshots, no persistent Playwright accessibility snapshots tied to each screen, no complete per-screen inventory of every field/action/filter/modal/state across the whole surface, and no literal route -> handler/service -> DB read/write -> side effect -> response trace for every core/plugin flow.

Counts in the inherited corpus are snapshot-specific and conflict with current disk counts. The live recon in `RECON_MAP.md` is authoritative for this pass.

## Required source conventions

- `README.md` (status marked 2026-08) is a high-level product/stack/quick-start document, not a screen inventory or flow audit. Its aggregate counts are stale against current disk and its “Coming soon”/not-launched claims are snapshot claims (`README.md:1-15,44-68`).
- `AI_CODING_GUIDE.md` (last updated 2026-08-27) and `.cursorrules` define audit-before-edit, audit-log, theme, and plugin-gating conventions; neither contains visual evidence or literal flow traces. Their 57-plugin wording must be reconciled with current manifest/module scopes (`AI_CODING_GUIDE.md:1-14,20-81`; `.cursorrules:1-21`).
- `audits/AUDIT_INDEX.md` is the newest running implementation ledger, with entries through 2026-09-12. It records compact implementation claims and verification results for S0, S12, S-A1 through S-A4, but not a per-screen visual audit. It is valuable for “fixed since” reconciliation, not a substitute for source verification (`audits/AUDIT_INDEX.md:45-61,72-102,164-188,263-361`).
- `audits/PLAN_2026-09-08.md` is a dated implementation plan. Its opening “Wave R done” and later “Wave R do first” sections contradict each other; later index entries supersede many statuses. Treat it as historical sequencing and defect leads, not current state (`audits/PLAN_2026-09-08.md:12-33`).
- `audits/PLUGINS_ECOSYSTEM_2026-09-08.md` is a broad 41-module + orphan plugin/engine/security/widget/mobile audit. It gives strong architecture and defect tables but no complete screen inventory or screenshots. It explicitly describes a half-wired surface and capability ceiling; later S0/S-A waves claim some fixes, so current source checks are required (`audits/PLUGINS_ECOSYSTEM_2026-09-08.md:1-10,37-105,107-159`).
- `audits/AUDIT_2026-09-08_VERIFICATION.md` is a historical local/prod verification snapshot. Its “still present” defect tables are superseded in part by later S0/S12/S-A entries; it remains useful for regression leads but cannot be quoted as current without re-running checks (`audits/AUDIT_2026-09-08_VERIFICATION.md:1-21,25-40,44-101`).

## By surface

### Competitors

The old corpus contains Nepal market research and broad competitor positioning. `docs/competitor-audits/` currently has exactly seven reports: `eduex-lms-v2.0`, `eschool-v3.3.6`, `infixedu-addon-modules`, `infixedu-v9.4.0`, `instikit-school-v5.5.0`, `mighty-school-pro-v1.6`, and `schoolbustrack-v2.3`. The latest cross-audit and execution plans document implementation-level route/model/controller/migration reads and several concrete traces. These are not architecture-only reports: EduEx includes a widget-by-widget course-player read; eSchool and SchoolBusTrack include substantial screen/widget descriptions; the other reports include selected form/view/flow detail. Nevertheless, they are source-code audits rather than a complete screenshot-backed inventory of every screen state and every control. None of the seven reports embeds screenshots or persistent accessibility snapshots. `eschool-saas-v1.8.0` is confirmed to be the **only missing competitor report** in the current `docs/competitor-audits/` directory and must be built fresh. The competitor reports are also uneven: several explicitly leave full admin form-field or mobile widget coverage out of scope, and all need a common template/visual evidence layer for this pass. Relevant sources: `docs/COMPETITOR_CROSS_AUDIT_PLAN_2026-09-11.md:1-20`; `docs/MASTER_EXECUTION_PLAN_2026-09-12.md:15-135`; `docs/competitor-audits/*.md`.

### Backend

Prior backend audits are comparatively strong on route/model/plugin census, defect localization, security, migration drift, tests, and selected lifecycle traces. The plugin audit maps loader, registry, entitlements, request-time gates, widgets, hooks, and events; the index documents recent fees, transport, notification, exam, attendance, and AI content changes. The corpus still does not trace every plugin/domain from literal request entry through service, DB mutation/read, event/task/webhook/notification, and final response. It also carries stale/conflicting counts: current recon finds 72 `app/api/v1` route modules, 74 model files excluding `__init__`, 251 class declarations excluding the isolation exception, 23 task modules, 41 plugin manifests, and 81 `test_*.py` files—different from README and older audit counts. This pass must re-run source traces and reconcile prior “still true/fixed/worse” claims per surface.

### Frontend

The prior web corpus is broad: a 224/226-page route census, a widget-level audit, plugin UI checks, and the C1 daily-flow audit. It already identifies many real UX gaps—basic rather than complete pages, inconsistent error/loading/empty states, native confirmations, orphan routes, responsive table problems, and backend capabilities without UI consumers. It has no complete per-screen field/action/filter/modal/state inventory and no report-embedded runtime screenshots or accessibility snapshots. The designer, writer, and website-builder surfaces are each large bespoke systems and were not previously covered at the required screen-by-screen depth. C1 is the freshest prior web snapshot (2026-09-05), but current route code and runtime must be rechecked.

### Mobile

Prior mobile work covers all five Flutter apps plus `aschool_shared`, with screen/file counts, role/plugin matrices, widget audits, architecture, and release blockers. It identifies genuine role divergence and shared infrastructure, as well as push configuration/routing, offline, i18n, accessibility/dark-mode, testing, and fabricated/stub screen concerns. It is primarily static source analysis: there are no persistent device screenshots or golden/accessibility artifacts in those reports, and it does not enumerate every control/state on every screen. The current pass must compute exact shared-vs-duplicated counts and enumerate every backend/plugin/frontend domain with zero mobile representation. `eschool_components.dart` and `eschool_dialog.dart` require direct reading rather than inherited interpretation.

### Plugins and duplication

`audits_old/ALL_57_PLUGINS_DEEP_DIVE_AUDIT_2026-08-27.md` and `audits_old/research/ASCHOOL_PLUGIN_DUPLICATION_AUDIT.md` provide the strongest inherited plugin map. They already identify aliasing and overlap clusters and state that `library`/`library_management` share the physical-library implementation, `elibrary`/`digital_content` overlap as digital-content publications, and `incidents`/`incident_management` layer on the same `incidents` entity. They also identify AI gate fragmentation, legacy aliases, dead services, and inconsistent pricing. But this is **not fully resolved at current HEAD**: the reports recommend migration/deletion/rename cleanup, and later ledgers report fixes to individual gates and manifests without proving all structural cleanup. The current source audit must resolve each concept using manifests, routes, models, frontend pages, tests, and mobile consumers. In particular:

- **Incidents:** prior work says distinct base CRUD vs workflow/escalation tiers on the same incident entity, but naming and pricing remain confusing and the recommended merge/rename is not proven complete.
- **Library:** prior work says `library_management` is canonical and `library` is an alias over the same physical-library code; recent library v2 work expanded the canonical surface, but alias/migration/gate cleanup must be verified.
- **Digital library:** `elibrary` is conceptually distinct from physical `library_management`; `digital_content` is described as a duplicate/alias that still needs cleanup.
- **AI:** runtime alias/gate issues were reportedly improved in later waves, and `ai_teacher` is intentionally separate; however, the code still exposes multiple AI routes/plugins/models and the end-user boundaries must be mapped, not inferred from old gate claims.

## Evidence limitations inherited from the corpus

1. No requested prior corpus file contains embedded screenshots or persistent per-screen Playwright snapshots.
2. Existing reports cite files and lines well, but they do not consistently inventory every field, button, filter, menu item, modal/bottom-sheet, empty/loading/error state per screen.
3. Existing backend reports contain strong partial traces and defect chains, not one complete literal flow for every domain/plugin.
4. Existing competitor reports are implementation-level first drafts, not a completed nine-product visual/task benchmark corpus.
5. Prior claims are snapshot-specific. The latest source-generated map and fresh audit reports must be treated as the new spine.

## Reconciliation labels required for this pass

Every own-codebase report must label relevant inherited findings **still true**, **fixed since**, **worse now**, or **not reproducible**, with a current file/line or runtime capture. Every competitor report must distinguish live app, static code, and vendor screenshot evidence. No recommendation in the final synthesis may rely only on an inherited claim.

## Triage conclusion

The prior corpus saves substantial discovery time, especially for plugin architecture, known backend defects, route inventories, and competitor implementation traces. It does **not** remove the need for this deep pass. The net-new deliverable is a current, source-grounded, screenshot/snapshot-backed, per-screen element/state inventory; literal backend flow traces; an auto-generated current recon spine; the missing eSchool SaaS audit; explicit duplication and mobile-parity matrices; and a synthesis that cites those current artifacts.
