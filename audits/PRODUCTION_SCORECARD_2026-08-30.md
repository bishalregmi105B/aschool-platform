# PRODUCTION SCORECARD — 2026-08-30

Scope: the live 55-plugin published catalog (inventory §2's 57 slugs minus the deprecated/delisted `digital_content` and `portfolio`, both unpublished by E14; `plugins_nav` is published:false and not a product). Cells are ✅ Verified / ⚠️ Partial / ❌ Broken / ⚪ Out of scope, with ONE line of runtime-verified evidence drawn only from the Phase-9 inputs. Mobile evidence is app-level (M-fixes); "⚪ no app surface" per the M11 list. External/Integrations is "—" where the plugin has no external dependency.

## Core (free)

| Plugin | Backend | Frontend | Mobile | External/Integrations | Overall |
|---|---|---|---|---|---|
| dashboard | ✅ `/analytics/overview` hand-checked vs SQL (attendance 66.7, fees 5000) | ✅ `/dashboard` KPIs + plugin badges verified | ⚪ admin app uses its own dashboard (E-batch principal dashboard rewired, t15) | — | ✅ |
| students | ✅ slice-1 backend: CRUD/cap/rollback, E100/E163 fixed | ✅ slice-2: 10 pages, add→DB, cap 403, E100 fixed | ⚠️ shared screens verified via M9/M10 sweep only | — | ✅ |
| teachers | ✅ slice-2: create→login→toggle→delete E2E | ✅ teachers page + error state (slice-2) | ✅ teacher app login live on :8092 (UX test) | — | ✅ |
| users | ✅ slice-1: E160 role-escalation guard, tenant 404s, dup-phone 409 | ✅ users page CRUD + toggle-active verified | ⚪ no dedicated app surface | — | ✅ |
| academics | ✅ slice-2: years/classes/subjects/sections CRUD, E101 fixed | ✅ academics hub tabs + class-subjects/class-teachers | ⚠️ shared timetable/class models via M9 | — | ✅ |
| attendance | ✅ E27 uniform late rule across 6 sites; mark/summary probed | ✅ mark + reports pages hand-checked (80.0% = (P+L)/T) | ⚠️ shared attendance repo (M9-verified parse) | — | ✅ |
| notices | ✅ comms batch: CRUD + bleach XSS + fan-out notifications live | ✅ notices page + events + holidays (slice-1/2) | ⚠️ teacher announcements screen (M10-converted) | — | ✅ |
| basic_reports | ✅ 3 JSON + 3 `/pdf` exports stream real %PDF (platform batch) | ✅ reports/exam/expense pages match SQL | ⚪ no dedicated app surface | — | ✅ |
| basic_website | ✅ config PUT sanitizes CSS; public endpoint reflects config | ✅ settings/website-design publish flow verified | ⚪ no app surface | — | ✅ |
| file_management | ✅ slice-1: E162 presign clamp, E166 SSRF allowlist, E167 type gate, E169 isolation | ✅ /dashboard/files lists uploads after E175 fix | ⚠️ uploads consumed by student-photo flows (M9) | ⚠️ R2 presign verified in dev; prod R2 creds untested | ✅ |
| marketplace_nav | ✅ 55-plugin catalog + install/uninstall/activate APIs (E160–E162 arch) | ✅ marketplace + /dashboard/plugins manager + settings page (E163–E165) | ✅ M4: admin install/uninstall fixed against real `/plugins/install` | — | ✅ |
| settings_core | ✅ `/schools/current` GET/PUT roundtrip + notification-settings merge | ✅ settings pages E90 fixed (real `settings` column) | ⚠️ M7: plugin config plumbing now real on mobile | — | ✅ |

## Add-on (free)

| Plugin | Backend | Frontend | Mobile | External/Integrations | Overall |
|---|---|---|---|---|---|
| iemis_importer | ✅ platform batch: validate/import/history E2E, cap rollback, E10/E13 | ✅ E91 real CSV importer, E156 template download + history fix, E92 | ⚪ no app surface | ✅ openpyxl/CSV round-trip runtime-proven | ✅ |

## Legacy-renamed / free-tiered

| Plugin | Backend | Frontend | Mobile | External/Integrations | Overall |
|---|---|---|---|---|---|
| library | ✅ campus ops: issue/return E2E + rollback proof; gates legacy slug | ✅ 6 library pages (slice-5) | ⚠️ teacher library screen M10-converted | — | ✅ |
| library_management | ✅ same feature, canonical product slug; single-hop alias both ways | ✅ gates resolve via alias (E71 zero-lockout audit) | ⚪ student app gates canonical slug | — | ✅ |
| timetable | ✅ E25/E102 conflict detection live (409s, guards, rollback) | ✅ grid + generate + teacher views; crash fixed live (UX test) | ⚠️ shared timetable_slot model M9-converted | — | ✅ |
| hostel | ✅ E8 tenancy FIXED-COMMITTED; allocate/checkout E2E + occupancy math | ✅ hostel pages in campus-ops batch | ⚪ no app surface (M11) | — | ✅ |
| ai_insights | ✅ E19 fixed; risk-alerts/daily-brief/weekly real aggregates | ⚠️ web surfaces insights under ai_tools (E22b dual-gate open) | ⚪ no app surface | ⚠️ LLM via token hub; dev key invalid → honest 502 (E113) | ✅ |

## Starter (paid)

| Plugin | Backend | Frontend | Mobile | External/Integrations | Overall |
|---|---|---|---|---|---|
| assignments | ✅ E26/E28: guards, is_late computed, rollback proofs | ✅ slice-2/3 pages + `submitted_count` fix | ⚠️ shared assignment repo verified (parent 404 fixed M-batch: route is `/assignments/<id>/submit`) | — | ✅ |
| conferences | ✅ E33/E192/E193: BS-range, booking attribution, participant-only notes | ✅ conferences page + PluginGate added | ⚠️ parent conference booking verified via parent_app probes; no teacher conf mgmt (M11) | ⚠️ Jitsi public rooms, no access control (flagged in-code) | ✅ |
| dismissal | ✅ E16: QR-string verify + records contract; E17 guards | ✅ dismissal verify page + search | ⚠️ parent QR screen real; admin `/dismissal/summary` 404 residual | — | ✅ |
| elibrary | ✅ campus ops: books/papers/OER verified; canonical (E14) | ✅ 3 elibrary pages + upload round-trip | ✅ E165: parent elibrary endpoint + envelope fix live | — | ✅ |
| exams | ✅ E24/E28: class_id resolution, batch guards, rollback | ✅ slice-3: marks/results hand-checked, E110–E112 fixed | ⚠️ student online-exam screen (M10-converted) | — | ✅ |
| fees | ✅ E15/E181/E182: money math hand-verified, receipts point-in-time | ✅ slice-4: collect bar E2E, partials, PDFs | ✅ M6 FIXED-COMMITTED `3920609` (parent checkout completable) | ✅ eSewa/Khalti/FonePay/Stripe callbacks verified (E60–E66) | ✅ |
| incidents | ✅ E42: cross-tenant UUID[] leak fixed, guards + rollback | ✅ incidents page (Type column fixed E44b) | ⚪ no dedicated app surface | — | ✅ |
| sms_notifications | ✅ E31/E34/E197: real outcomes, header-auth fix, template guards | ✅ slice-4 comms pages; E93 history crash fixed | ⚠️ no sms screen (M11); broadcast push reaches app notifications | ⚠️ Sparrow honest-fail without creds (E31); console mode loud | ✅ |
| whatsapp_bot | ✅ E32/E121/E198: rules persist + exact-match, webhook fail-closed/dedupe | ✅ E210–E213: 4 real sub-pages (conversations/templates/AI/analytics) | ⚪ no app surface (M11) | ✅ Cloud API signature/dedupe probed; Meta creds unconfigured in dev (honest skip) | ✅ |

## Growth (paid)

| Plugin | Backend | Frontend | Mobile | External/Integrations | Overall |
|---|---|---|---|---|---|
| admission | ✅ ops batch: inquiry→accept auto-enroll cap-checked; E186 fixed | ✅ admission CRM funnel pages (UX test) | ⚪ no app surface | — | ✅ |
| ai_grading | ⚠️ `/assignments/<id>/ai-grade` works + usage rows, but gated `assignments` not `ai_grading` (E22a product decision OPEN) | ⚠️ web has no ai_grading gate; manifest routes don't exist | ⚪ no app surface | ⚠️ LLM via token hub; dev key invalid → honest 502 | ⚠️ |
| ai_tutor | ✅ both gates 200 (`/design-studio/ai/homework-help` + `/ai-tools/homework-help`) | ✅ homework-help surfaces render real JSON | ⚠️ student homework-help verified matching (M5) | ⚠️ LLM via token hub; dev key invalid → honest 502 | ✅ |
| alumni | ✅ E50: contract fixed both sides, stats == SQL | ✅ alumni directory page fixed + search | ⚪ no app surface | — | ✅ |
| compliance | ✅ platform batch: report generate, draft→submit, EMIS CSV download (G2) | ✅ compliance generate flow verified | ⚪ no app surface | ✅ EMIS export persisted + streamed | ✅ |
| design_studio | ✅ platform batch: templates/render/bulk JSON; E3 alias leak closed; E151 fixed | ✅ designer editor/bulk/writer + certificates (E151/E155) | ⚪ no app surface | ✅ bulk id-cards/marksheets/certificates/admit-cards 200 with real data | ✅ |
| emergency | ✅ campus ops: alert/headcount guards, Socket.IO `emergency.alert_broadcast` | ✅ emergency page hooks-order crash fixed live | ⚠️ shared emergency screens (M10 sweep) | ⚠️ `alert_service` SMS/push fan-out unwired (residual) | ✅ |
| gamification | ✅ E131 dedup 409; leaderboard hand-computed == SQL | ✅ 5 gamification pages (slice-5) | ⚠️ student badge lists consume real rows | — | ✅ |
| gps_tracking | ✅ ops batch: ingest range/FK guards, E189 update-side, E143 ISO-Z | ✅ 8 transport pages; map via poll leg | ⚠️ student live-bus screen absent (M11); REST+socket unused there | ⚠️ Firebase poller honest no-op unconfigured; real ESP32 untested | ✅ |
| health_records | ✅ E130 search fix; visits/immunizations with tenant guards | ✅ 4 pages incl. E44c date binding fix | ✅ E165: parent child-health endpoint live with fixtures | — | ✅ |
| hr_payroll | ✅ E185 tenant/enum guards; math audit §2 invariant; payslip PDF exact | ✅ E123 component editor + E124 leave-apply UI | ✅ M3: shared HR repo repointed to real `/hr/*` routes | — | ✅ |
| incident_management | ✅ E41 implemented: workflow/escalation/audit/reports (8/8 tests) | ✅ 4 pages hand-checked vs fixture | ⚪ no app surface | — | ✅ |
| inventory | ✅ E17/E187: dup-code 409, money guards, auto audit trail | ✅ inventory page (UX test) | ⚠️ admin inventory add (M10-converted) | — | ✅ |
| lms | ✅ platform batch: course→lesson→enroll→progress E2E + rollback | ✅ E214 Create Course action live-verified | ⚠️ parent LMS view absent (M11) | ⚠️ Jitsi public `meet.jit.si`, no auth | ✅ |
| social_ads | ✅ E30 implemented: 8 gated routes, honest audience estimate | ✅ campaigns page lifecycle E2E (E133) | ⚪ no app surface | ⚪ Meta delivery not implemented — honest zeros, labeled | ✅ |
| social_hub | ✅ E194/E195/E196: moderation, real group membership, guards | ✅ feed + campaigns (E132 delete affordance fixed) | ⚠️ chat threads verified in M10 conversion | ⚠️ Meta/TikTok/YouTube read-only wrappers, timeouts verified (E199) | ✅ |
| student_portfolio | ✅ E72/E134: real `/portfolio/students/:id/items` contract, FK guards | ✅ portfolio page rewired + verified | ⚠️ all 4 apps pass `pluginSlug: student_portfolio` (E14); screens M9/M10-swept | — | ✅ |
| visitor_management | ✅ E17/E188: FK/tenant guards, double-checkout 400 | ✅ visitors page check-in/out E2E | ⚠️ visitor check-in M10-converted | — | ✅ |
| website_builder | ✅ E152/E159/E201/E202: revalidation, publish guard, foreign-slug 403 | ✅ builder/editor/SEO/themes pages + live SSR proof | ⚪ no app surface | ✅ Google Fonts css2 200 (11 families); 10 GPL-ported themes (E170–E174) | ✅ |
| wellbeing | ✅ E43 contract + mood summary math; E44d dead inputs removed | ✅ 4 wellbeing pages | ⚠️ parent wellbeing via `/parent/child-wellbeing` (probed) | — | ✅ |

## Premium (paid)

| Plugin | Backend | Frontend | Mobile | External/Integrations | Overall |
|---|---|---|---|---|---|
| advanced_analytics | ✅ AI batch: overview/academic/financial aggregates hand-verified vs SQL | ✅ analytics pages + error states (E73) | ⚪ no app surface | — | ✅ |
| ai_adaptive_learning | ✅ E23 implemented: learning-paths/mastery/progress routes + models + migration (7 tests) | ✅ learning-paths/progress pages rewritten (honest source badges) | ⚠️ manifest flutter section aspirational — no app screens | ⚠️ AI generation needs real LLM key (rule-based fallback verified honest) | ✅ |
| ai_tools | ✅ AI batch: 6 tools 200 + usage rows; E18 429 / E113 502 handlers | ✅ slice-3 rewrites (E114–E117); letter-writer route added (E72) | ✅ M5: admin+teacher AI screens rewired to real `/ai-tools/*` | ⚠️ Anthropic via token hub only (E7 re-check: 0 bypassers); dev key invalid → honest 502 | ✅ |
| benchmarking | ✅ AI batch: district/national averages == independent SQL recomputation | ✅ benchmarking page + error state | ⚪ no app surface | — | ✅ |
| biometric | ✅ implemented: devices/ingest/heartbeat/sync, DB idempotency (11/11 tests) | ✅ E141 one-time device key captured; ingest E2E | ⚪ no app surface | ⚠️ ZKTeco-style HTTP ingest proven; real hardware untested (⚪) | ✅ |
| disaster_management | ✅ E40 implemented: drills/participations/readiness/USGS (6/6 tests) | ✅ 4 pages; readiness hand-computed 70 | ⚠️ shared emergency screens only | ✅ live USGS FDSN feed (2 real M4.2+ events); honest `unavailable` on egress failure | ✅ |
| multi_branch | ✅ implemented: chains/branches/overview/analytics (10/10 tests) | ✅ 4 pages hand-checked vs SQL (branch create E2E) | ⚪ no app screens (manifest aspirational) | — | ✅ |
| white_label | ✅ E142 `flag_modified` fix; DNS verify live resolver pending/failed/active | ✅ 4 white-label pages (branding write-through verified) | ⚪ no app surface | ⚠️ no unset-domain API (residual); DNS verification needs real domains | ✅ |

**Tally: 54 of 55 published plugins ✅ verified working; ai_grading ⚠️ (works, wrong gate — E22a decision pending). Zero ❌.**

## Platform-level scorecard

| Area | Verdict | Evidence |
|---|---|---|
| Auth / tenancy / entitlements | ✅ (1 open bug) | E1–E5/E34/E8/E160–E163 fixed + runtime; single-hop aliases; caps enforced — **open:** login-lockout 500 `auth_service.py:166`; password reset E164 live 12/12 |
| Payments (gateways + plugin billing) | ✅ | E60–E66 probe 60/60 ×2 + 16/16 tests; E5 402-proof subscribe; E61 `PaymentInitiation`; gateway verdicts eSewa/Khalti/FonePay/Stripe ✅ |
| Docs / PDF generation | ✅ | G1/G2 persisted + served (%PDF verified); reports `/pdf` ×3; marksheets/report-cards/certificates pdftotext-verified; money math to the paisa |
| Mobile push | ❌ | M1: `NotificationService.init()` never called in any app; tokens always null; `register-fcm` no-ops; M2 center unrouted |
| Plugins / themes architecture | ✅ | E160–E166 plugin arch 39/39 probe; E14 dedup (55 catalog, zero lockout slugs E71); E170–E174 10 GPL-ported themes, migration idempotent |
| CORS / web security | ✅ | E200 preflight 204 + env honored; E166 SSRF allowlist; E167 upload type gate; E160 priv-esc guard; E94 phone variants; E198 webhook fail-closed |
| Tests | ✅ | New pinned suites across all batches (payments 16, comms 21–24+19, campus 13+8, biometric 11, multi_branch 10, disaster 6, incident-mgmt 8, adaptive 7, social_ads 7, password-reset 15, slice-3 ops 16, provisioning 6, models 13); shared-DB TRUNCATE deadlocks are infra, not code |
| Production deployment | ⚪ not yet hardened | No TLS/prod-secrets/gunicorn-socketio evidence in any input; Celery worker restart proven load-bearing (E93, money-audit §3); backup restore drill untested |
