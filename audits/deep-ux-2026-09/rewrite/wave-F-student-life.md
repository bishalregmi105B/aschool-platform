# Wave F — Student Life & Records rewrite report

Modules owned: `wellbeing/**`, `health-records/**`, `gamification/**`, `alumni/**`, `biometric/**`, `disaster/**`, `emergency/**`, `files/**`, `teachers/**`, `staff/**`, `parents/**`, `users/**`, `profile/**`. Date: 2026-09-14.

## Research (per-page notes, written before rewriting)

Live WebSearch/WebFetch was blocked in this session (DuckDuckGo bot-wall, Bing garbage results, NN/g 404s, Wikipedia disambiguation — 10 fetch attempts). Notes below are grounded in the audits corpus (`IMPROVEMENT_PLAN` 8.18–8.20, 31–34; `aschool-frontend` §4) + standard privacy-by-design / productivity-UI heuristics:

- **wellbeing hub** — aggregate-first dashboards for minors (distribution/trend, not per-child surveillance); explicit confidentiality banner; honest zero-data states; trend needs a time-range control.
- **moods** — same; keep A1 registry, add URL-persisted mood filter (addressability).
- **counselor** — most sensitive register in the product; confidentiality by default, EntityPicker not raw UUID input (top data-entry error source).
- **surveys** — builders for staff work as short wizards (≤4 visible fields/step); anonymity must be a first-class labelled choice, not a checkbox.
- **health-records** — student is the unit of navigation (registry → per-student tabs Visits|Immunizations|Profile); health data gets the same confidentiality framing as wellbeing.
- **gamification** — wall-poster leaderboards need a print twin (8.20 "cheap delight"); house standings read best as KPI/MetricCards; podium row for top-3 glanceability.
- **emergency** — mass-notification UX demands a friction step: danger-tone confirm that restates audience ("EVERY parent"), with "drill vs real" guidance (34 #40).
- **disaster** — readiness = checklist derived from real stats (no fabricated score-only panel); drills are registry + month-grouped upcoming calendar.
- **files** — win11-Explorer grammar: left TreeView, top command bar (search/type/view), breadcrumb, bottom statusbar (quota/selection); deletes confirmable/reversible.
- **teachers/staff/parents/users** — already near-A1; conformance deltas only (URL filters, undoable deletes per G8, EntityPicker/AdvancedSelect for >20-option selects).
- **profile** — self-service pages inline-edit cheap fields, gate dangerous ones (password, MFA) behind confirmations; MFA enrolment = QR → verify code.

## What changed (page by page)

| Page | Archetype | Changes |
|---|---|---|
| `wellbeing/page.tsx` | A7 | Rewritten: confidentiality infobar, 4-KPI band (check-ins / top mood / low-mood % / at-risk from `/wellbeing/dashboard`), mood-distribution donut + per-day trend line (`/wellbeing/mood` bucketed) with zero-data states, 7/14/30-day AdvancedSelect range, per-class rollup `win11-listview`, embedded recent-check-ins DataPanel, hand-rolled tab strip removed (check-in → header Dialog). |
| `wellbeing/moods` | A1 | URL-persisted mood filter (`useUrlFilters`), `useDebounced`, BS dates, bilingual, per_page=100. |
| `wellbeing/counselor` | A1 | Confidentiality banner + per-note `is_confidential` switch (backend reads it — old form never sent it), EntityPicker replaces "Student ID" input, dropped dead `action_taken` field, confidential column w/ lock icon. |
| `wellbeing/surveys` | A1+A4 | Create flow is now a 3-step **Wizard** (Basics → Questions → Audience) that posts a real `questions[]` array (old dialog created empty surveys) and real `target_class_ids` from `/academics/classes`; anonymity effect stated inline; anonymity info bar. |
| `health-records/page.tsx` | A5 hub + **A2 per-student** | Tabs (fixed `win11-tablist`) Visits/Immunizations/Profiles w/ badges; row-click drills into a per-student view (`?student=` URL-addressable via `useUrlFilters` — no new route, AOSRouteTable-safe): ObjectHeader + Tabs [Visits \| Immunizations \| Profile(EditableField inline saves via PUT students/<id>)]. Confidentiality infobar. EntityPicker in Record-Visit dialog. |
| `health-records/records`, `vaccinations`, `allergies` | A1 | EntityPicker replaces raw student-ID inputs (allergies lookup mutation fires on pick); array-field coercion fix for allergy inputs; loaders conformant. |
| `gamification/page.tsx` | A7 hub | Button-strip → real Tabs w/ count badges; **houses as MetricCards** (color-accent, pts value, motto footnote). |
| `gamification/leaderboard` | A7 | **Print-ready view**: segmented [Standings \| Print sheet] toggle + Print button; print sheet = school header + full ranked table isolated via scoped `@media print`; top-3 podium MetricCards; skeletons. |
| `gamification/houses` | A8-ish | House cards → MetricCards; module loading state. |
| `gamification/badges`,`rewards` | A1 | Loader swap only (already conformant; 4-field dialogs ≤7). |
| `alumni/page.tsx` | A1 | The `search` state existed but had **no input** — added debounced search box; batch filter + q moved to `useUrlFilters`; added Edit (PUT /alumni/<id>) + undoable Delete (DELETE /alumni/<id>) per G8; empty-filtered vs empty-never variants. |
| `biometric/devices` | A1/A8 | Added regenerate-key (shows new one-time key via existing E141 dialog) + delete device w/ danger confirm + undo. |
| `biometric/logs`,`biometric/page` | A1/A5 | logs → `useUrlFilters`; hub already conformant. |
| `disaster/page.tsx` | A5 | **Readiness checklist** panel: score Progress bar + 6 pass/fail items derived from real `/emergency/disaster/overview` stats, failures show the fix. |
| `disaster/drills` | A1+A4 | **Drill calendar**: upcoming drills month-grouped panels; status filter via URL. |
| `emergency/page.tsx` | A1+A3 | Broadcast moved from inline always-open form into a **Dialog**; SEND now gated by danger-tone `useConfirm` with **requireText "BROADCAST"** restating audience+type; Recent-alerts DataTable (GET /emergency/alerts) with inline Resolve (POST …/resolve) replaced dead KPI-only filler. |
| `files/page.tsx` (1174 L) | A6 | **Left TreeView** (recursive BFS over existing GET /folders; navigates + rebuilds breadcrumb trail from parent chain); **bottom win11-statusbar** (files/folders counts, N selected + size, quota from /files/usage); multi-select checkboxes on file cards/rows + bulk "Delete selected" (confirm+undo); file delete → `undoableDelete`; folder delete → danger confirm; debounced search; honest "Recently deleted — not available" view (see API gaps). Existing workspace chrome preserved. |
| `users/page.tsx` | A1 | q/role/page → `useUrlFilters`, debounced search. |
| `teachers/page.tsx` | A1 | Delete: confirm-dialog → **undoableDelete** (optimistic hide + rollback); URL-persisted debounced search. |
| `staff/page.tsx` | A1 | Same undoable delete + URL search wiring (server param `search` was previously dead — now 250 ms debounced). |
| `parents/page.tsx` | A1 | q/status/page → URL filters + debounce (was refetching per keystroke). |
| `parents/[id]/page.tsx` | A2 | Was off-shell raw Cards: now AOSPage + **ObjectHeader** + Tabs [Children(win11-listview) \| Profile & access \| Link student]; 300-option native `<select>` → searchable AdvancedSelect; password reset gets danger confirm; unlink confirm kept. |
| `profile/page.tsx` | A2 | Was a static info card: **ObjectHeader** + Tabs [Account \| Security]; inline **EditableField** saves (full_name, Nepali name, address) + language/gender selects via PUT /auth/me; **Security tab with fully-wired MFA** (see below), change-password card, sign-out-everywhere card. |

## MFA-endpoint finding (required)

**The endpoints EXIST** — `backend/app/api/v1/auth.py`: `POST /auth/totp/setup` (returns `secret`, `uri`, optional `qr_data_url` PNG), `POST /auth/totp/verify {code}` (activates), `POST /auth/totp/disable {password}`, `POST /auth/totp/challenge` (login step-2). Status is readable client-side: `User.to_dict()` strips `*_secret` keys but **exposes `permissions.mfa_enabled`**. So the profile Security tab is **fully wired, not a placeholder**: setup → QR render → 6-digit verify → enable; disable requires password + danger confirm; `refreshUser()` updates state after toggles. (pyotp missing server-side → 503 handled with a toast.)

## Data / API gaps flagged (no endpoints added; view-layer only)

1. **files "Recently Deleted"** — `DELETE /files/<id>` soft-flags `is_deleted` AND purges the R2 object, and every list route filters `is_deleted=False`; there is **no list-deleted or restore endpoint** → tree node renders an honest unavailable state instead of fabricating.
2. **files quota** — `/files/usage` reports used MB/files but no tenant **quota limit** → statusbar shows usage, not a percentage.
3. **wellbeing mood enum** — `POST /wellbeing/mood` accepts any `mood` string (plan §11 #23); UI restricts to the 5 canonical moods.
4. **mood trend cap** — `GET /wellbeing/mood` is capped at `per_page=100`; the trend line buckets only the latest 100 check-ins. Needs a server aggregate (`/wellbeing/mood/trend?days=`) later.
5. **health "Incidents" tab** — the spec tab [Visits|Immunizations|Incidents] has no health-records incidents endpoint (incidents are a separate module, not cross-linked) → third tab is **Profile**; flagged.
6. **surveys** — no responses endpoint and `_survey_dict` has no `response_count` → responses column shows question count; student-side response capture isn't exposed to admin.
7. **parents list** — no delete/unlink-account action beyond deactivate (toggle-active); undoable delete applied where endpoints exist (teachers/staff/alumni).
8. **ICON_MAP gaps** (shared `lib/`, outside my scope): `Stethoscope`, `Syringe` missing → substituted registered icons in QuickLinks; suggest adding them.

## Verification

- `npx tsc --noEmit` filtered to the 13 module dirs: **0 errors** (checkpoints run every ~3 pages).
- `npx eslint` on all owned dirs: **0 errors**; 5 warnings, all pre-existing-style (`<img>`/alt in files thumbnails, one exhaustive-deps note) — no new hook-order or type issues.
- No native `alert/confirm/prompt` in owned dirs (grep-verified); all destructive paths use `useConfirm`/`undoableDelete`.
- Bilingual `t(en, ne)` on new chrome across all touched pages; ≤7 visible fields per form; Tabs only via fixed `win11-tablist` grammar (G1); zero modals-in-modals.
