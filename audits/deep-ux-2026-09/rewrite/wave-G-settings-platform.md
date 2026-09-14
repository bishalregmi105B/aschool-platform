# wave-G — Settings & Platform cluster rewrite (settings · marketplace · plugins · website-builder · multi-branch · white-label · analytics · benchmarking · reports)

Date: 2026-09-14. Agent: wave-G (coordinated UI/UX rewrite, wave G).
Scope (exclusive): `frontend/app/dashboard/settings/**`, `marketplace/**`,
`plugins/**`, `website-builder/**`, `multi-branch/**`, `white-label/**`,
`analytics/**`, `benchmarking/**`, `reports/**`. Shared `components/aos/kit`,
`components/ui`, `lib/`, `components/website/**` (Wave I) and
`components/aos/apps/AppStoreApp.tsx` were NOT touched.

## 0. Research pass (honesty note)

Live research via WebFetch: 3 NN/g articles fetched successfully —
"dashboards-preattentive" (encode magnitudes via length/2D position; at-a-glance
brevity; operational vs analytical split), "ten-usability-heuristics"
(undo/cancel + in-context help + error prevention for settings & forms) and the
F-pattern scanning study (first lines/leftmost words get the gaze; group related
content; start headings with the most informative word). Targeted slugs for
settings-save behavior (`/articles/settings-preferences-design/`,
`/articles/save-apply-update-cancel/`) and marketplace listing
(`/articles/search-result-pages/`) returned 404 (articles retired/renamed) and
the search-engine fallback was bot-gated — the per-page notes below therefore
lean on the fetched sources + the plan's own citations (48.5, A8, Part 33).

## 1. Settings (8 pages → A8 grammar)

Research note (cluster): NN/g heuristics — user control means visible Cancel/
Reset and undo paths; help must be "in context right at the moment required"
(→ helper text under every setting, not a wiki). F-pattern — left-edge nav gets
the gaze, so settings sections live in a persistent left list, never a mega-tab.
Per 48.5, a global Save over 30 fields hides state — per-section save with
change-detection is the fix.

New shared helpers (inside `settings/`, not the shared kit):
- `settings-page.tsx` — `SettingsPage` shell: AOSPage + header + DetailSplit
  with a 7-item left `ListView` nav (School · Notifications · Integrations ·
  Roles · Custom Fields · Access Logs · Backup), `useAOSRouterNavigate` so it
  works in-window and on direct URLs.
- `settings-section.tsx` — `useSectionSave(initial, onSave)` (draft vs committed
  JSON diff, re-seeds from server only while clean), `SettingsSection` (per-
  section Save + Reset + "Unsaved changes"/"Saved ✓" in the section header),
  `SettingField` (label + control + REQUIRED effect text).

| page | 2-line note | what shipped |
|---|---|---|
| `settings/page.tsx` | Global Save made state invisible (heuristic: visibility of system status). Grouped forms ≤7 visible fields with effects inline. | Split into General Information, Branding, Advanced Configuration (JSON) — each its own Save/Reset + change detection; every field gained one-line effect text ("Shown in headers, certificates and the public site title"); invalid JSON is now rejected with a named error instead of silently dropped. Partial `PUT /schools/:id` confirmed safe (populate-by-key). |
| `settings/notifications/` | Immediate-save toggles fire a request per click with no recovery (undo/cancel). | Rewritten on the shell: Channels and Types are two independently-saved sections; each channel/type now says what it delivers and costs ("SMS — costs credits per message"); error state renders an honest infobar + Retry. |
| `settings/roles/` | Shipped rewrite already good (per-role counts, users drawer, honest permissions note) — conform only. | Wrapped in the shell; Roles/Permissions tabs became URL state (`?tab=permissions` deep-linkable, plan 33 rule 2). |
| `settings/access-logs/` | Filters that die on refresh cost a "send me the link" ticket. | Wrapped in the shell; event/user/page filters moved to the window's URL params (`?event=locked_out&user=…`) with a Clear-filters chip; DataTable/CSV/export states preserved. |
| `settings/backup/` | Ops pages answer "when did it last run, can I run it now" — KPI strip + one action. | Wrapped in the shell; status/error re-rendered inside the same shell; refetch now invalidates the query (no stale-state hack). |
| `settings/custom-fields/` | Boolean settings use switches, never checkboxes (31.3); deletion needs its consequence named. | Shell + empty-state CTA "Add first field"; delete now goes through `useConfirm` naming the orphaned-data consequence; dialog rebuilt with `Select` + two `Switch`es + inline "Label is required" hint and Nepali-label helper. |
| `settings/integrations/` | 48.5: per-connection cards with a Test button *only if the API has one*. | Shell + Payment Methods converted to one change-detected `SettingsSection` (per-card switches, masked `***` secret envelopes with keep-existing hint); the hardcoded fake social cards (Facebook/TikTok "Connected" with dead buttons) were REMOVED and replaced by an honest "Communication Channels" panel driven by `useInstalledPlugins` with real deep-links (whatsapp_bot, sms_notifications). No test-connection endpoint exists → display/edit only. |
| `settings/website-design/` | Redirect stub kept intentionally: the white_builder manifest nav (route: /dashboard/settings/website-design) and direct links still resolve through it; the AOS route table maps it to the builder page. | No-op (11-line redirect; the builder hub's self-looping "Website Settings" tile was retargeted to School Settings instead). |

## 2. Plugins + Marketplace (rows 20/21/22)

Research note: app-store UX lives on card states (install/active/trial/upgrade)
+ honest entitlement copy (eSchool-SaaS padlock pattern, Part 8.12/9.6).

- `marketplace/page.tsx` — kept as-is per the wave brief (no redirect-agnostic
  changes needed; shared `AppStoreApp` untouched). Already carries tier cards,
  trial/subscribe states, URL `?search=` handoff from Spotlight.
- `plugins/page.tsx` — already A1-conformant (DataTable, activate/deactivate
  switches, Settings deep-link, useConfirm uninstall with data-preserved copy);
  no changes required.
- `plugins/[slug]/settings/page.tsx` (the 648-L generic renderer) — per 48.5:
  v1 schema section and "Other settings" section each got their own
  Save/Reset/change-detection header (`SectionControls`); a section's Save
  commits ONLY its own drafts (the other section is re-sent from its committed
  baseline, so half-typed edits can't leak); "(default)" markers appear when a
  field equals its schema default; every schema field now shows its `help` or a
  generic effect line; credential-looking keys (secret/token/password/api_key)
  render masked with an Eye reveal toggle. v2 (FormRenderer) keeps its global
  save (renderer is shared).

## 3. Website Builder (row 55 — "most launch-ready", keep logic, polish)

Research note: editor surfaces are operational — status must be glanceable
(NN/g operational dashboards); destructive toggles (unpublish) need a named
consequence; list rows follow the F-pattern (title first, metadata trailing).

- `website-builder/page.tsx` (hub) — publish/unpublish gained success/failure
  toasts; Unpublish now confirms ("site goes offline… edits are kept"); dead
  self-loop quick-link fixed → School Settings; unused tab state removed.
- `website-builder/pages/page.tsx` (A1) — hand-rolled modal replaced by
  `ui/Dialog`; page-title/slug validation is inline (required, lowercase
  slug pattern, duplicate-slug check against existing pages) with a live
  "/school/…/<slug>" preview of the resulting URL; `useConfirm` on delete kept.
- `website-builder/editor/page.tsx` (A6) — autosave/publish/revert/history
  logic untouched. Added: a Live/Draft-only `win11-chip` in the preview toolbar
  and a "N unpublished changes" chip expanding a what-changed summary (edited
  section titles + click-to-select + "Publish to make live" copy). The
  mislabeled "Open Site ↗" (which opened the builder hub) now opens the real
  public URL (reuses the `["website-status"]` cache).
- `website-builder/domain/page.tsx` (A8) — bare-hostname validation with inline
  error ("no http:// or path"), save/removal toasts, Remove custom domain now
  goes through `useConfirm` naming the DNS consequence.
- `website-builder/seo/page.tsx` (A8) — null-safety preserved; GA4-ID format
  warning inline; every field gained effect copy (analytics, verification,
  robots.txt, sitemap).
- `website-builder/themes/page.tsx` — hand-rolled tab strip → `ui/Tabs`
  (G1 styled, keyboard a11y); hand-rolled preview modal → `ui/Dialog`;
  filtered-empty state with "show all".
- `website-builder/ai-builder/page.tsx` — honest empty state before generation
  ("Describe your school above…") and an error infobar with Retry instead of a
  bare sentence.

## 4. Multi-branch (row 50) + White-label (row 56)

Research note: chain/console pages are A5/A1/A8 hybrids already; the failure
mode to avoid is fake connected/synced states (honest zeros, Part 19.3).

- multi-branch hub/dashboard/analytics — verified conformant (KPI bands,
  trend footnotes, status chips, honest nulls, gated via PluginGate).
- `multi-branch/branches/page.tsx` — added query error handling (the table
  silently showed empty on failure) + required-fields note in the create dialog.
- `white-label/page.tsx` (hub) — conformant (setup checklist + KPIs).
- `white-label/branding/page.tsx` — rebuilt as A8: three independently-saved
  sections (Identity / Colors & Fonts / Logo) with change detection, effect
  helper text on every field, a live preview card that renders the DRAFT values
  (logo + colors + fonts + footer), and the "hide ASchool branding" checkbox
  replaced by a Switch with plan-availability copy.
- `white-label/theme/page.tsx` — same treatment: Appearance/Colors split into
  two saved sections, helper text per token, preview labeled
  "unsaved values".
- `white-label/domain/page.tsx` — hostname validation inline (was a silently
  disabled Save), helper text explaining what saving does; verify flow kept.

## 5. Analytics / Benchmarking / Reports (rows 20/21/51 — A7 grammar)

Research note: NN/g dashboards study — at-a-glance readings, honest zero-data
states, comparisons encoded as length not decoration; report pages need print
twins (A7 "export + print").

- `analytics/analytics-kit.tsx` (new) — `PrintButton` (window.print scoped via
  an injected `@media print` sheet that isolates the `[data-print-area]`
  region), `PrintArea`, `ChartEmpty`, `downloadCsv`.
- `analytics/compare-panel.tsx` (new) — benchmarking content extracted into a
  reusable `BenchmarkCompare` with honest MetricCards whose deltas are the REAL
  school-vs-district difference (lowerIsBetter for ratio) + first-run empty
  state ("Publish exam results…").
- `analytics/page.tsx` (hub) — gained **Overview | Compare (Benchmarking)**
  URL-synced tabs (`?tab=compare`); Compare wrapped in `PluginGate slug="ai_suite"`
  so non-entitled schools see the standard gate, not a broken panel; the
  redundant "Benchmarking" tile was dropped from quick links.
- `benchmarking/page.tsx` — old route KEPT (plan 34 #21) as an alias that
  embeds `BenchmarkCompare` + a cross-link "Open in Analytics" + AI-suite quick
  links; its duplicated KPI block was removed (data now fetched once).
- `reports/page.tsx` (hub) — PrintButton + PrintArea; all four charts now have
  honest empty states ("No attendance recorded yet — mark attendance to see
  class trends", fee/exam twins).
- `reports/exam/`, `reports/expense/`, `reports/teacher/` — print twins added
  beside the existing Export buttons; expense/teacher empty copy made
  action-oriented; teacher DataTable gained its missing empty state.
- `analytics/academic/` — PrintButton + honest empty copy per panel ("No class
  results yet — enter and publish marks…"). `analytics/financial/` — PrintButton
  + per-panel empty guidance. `analytics/ai-usage/` — left as-is (usage table +
  settings tabs already conform; print is not meaningful there).

## 6. Verification

- `tsc --noEmit -p tsconfig.json` (full project): **0 errors** (checked after
  every 3 pages per the wave rule; final run includes everything).
- `next lint` over all nine module dirs: 0 errors; 4 warnings — 2 pre-existing
  (roles memo pattern, editor useCallback dep) and both addressed or noted.
- No dev server was available in-sandbox for click-through; every change kept
  the existing query/mutation contracts (view layer only — all endpoints,
  PluginGate slugs and AOSRouteTable keys untouched).

## 7. Flags for later waves (not dropped)

1. **MFA / Enable 2FA**: backend TOTP endpoints exist (`auth.py` ~762–930) but
   there is no settings *Security* subpage and the profile page is the natural
   host (Part 34 #13 "profile … security section (MFA enable)"). Handing to
   the portals/profile wave — building it here would have created a 9th
   settings subpage outside the manifest.
2. **Store detail view + upgrade-CTA gate (Variant B/C, 48.4/9.6)** lives in
   the shared `AppStoreApp` / `PluginGate` — orchestrator/Wave-owner work.
3. **Public-site null-address bug** ("null, Kathmandu" topbar): layout null
   guards already landed; remaining template-level guards are in Wave I's
   `components/website/**`.
4. **`settings__website-design` route-table key** kept because the
   `website_builder` manifest still declares the route; when the manifest
   entry is retargeted to the builder, both the stub and the AOSRouteTable
   line can go.
5. `analytics/ai-usage` is the only A7 page without a print twin (it is a
   settings+usage console; revisit if a print spec is requested).
