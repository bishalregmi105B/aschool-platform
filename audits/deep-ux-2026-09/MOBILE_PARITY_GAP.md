# MOBILE_PARITY_GAP — Web/Backend-to-Mobile Parity Matrix

**Date:** 2026-09-13. **Built by:** the orchestrator (Step 2.5b) from `aschool-mobile.md` §5 (the exhaustive enumeration: every one of the 42 plugin dirs, 67 API modules, and 60 dashboard route folders grepped across all five app trees + `aschool_shared`), cross-checked against `aschool-backend.md` §5 (867-route inventory with consumer flags) and `RECON_MAP.md` §3.

**Headline numbers (exact, not estimated):**
- Backend exposes **42 plugin dirs** (41 manifests), **67-68 API modules / 867 routes**, **75 model files**.
- Web frontend has **60 dashboard route folders / 237 pages**, plus auth + 3 role portals + public site.
- `aschool_shared` has **20 model domains / 16 providers / 19 repositories**; the five apps total ~58k Dart lines, 120 screens, 0 dead files.
- **Zero mobile representation: 15/42 plugins, 23/67 API modules, 17/60 dashboard routes.** Roughly half of each set is a deliberate web-only scope call; the other half are genuine gaps.

---

## 1. The zero-representation tables (from aschool-mobile.md §5.1-5.3, evidence preserved)

### 1.1 Plugin dirs with ZERO mobile presence (15 of 42)

| Plugin dir | Verdict | Which app would need it if built |
|---|---|---|
| `ai_adaptive_learning` | **GAP** — module + API have no client at all (grep "adaptive": only transport-radius false positives) | student (adaptive practice) |
| `ai_suite` (own surfaces) | **GAP** for at-risk/insights surfacing (its ai-tools routes ARE consumed via AiRepository) | admin (at-risk students list) |
| `ai_teacher` | **GAP** — stated product pillar with web dashboard only | teacher (AI assistant), student (tutor sessions) |
| `basic_website` | deliberate — websites are a web product (`{slug}.aschool.com.np` SSR) | none |
| `benchmarking` | gap-ish (low) — would be an admin dashboard card | admin (low) |
| `biometric` | **GAP** — biometric *app unlock* is table-stakes; device sync is back-office | all (unlock), admin (sync view) |
| `disaster_management` | **GAP** — Nepal-specific (earthquake drills); emergency app exists but disaster module invisible | admin (plans), parent/student (drill alerts) |
| `file_management` | deliberate-ish — `/files/` used as upload backend only; browser is admin-web scope | admin (low) |
| `hostel` | **GAP — THE BIGGEST ONE.** 12 backend rules, 0 mobile. Nepal boarding schools are a core market | parent (child's room/warden), student, admin (occupancy) |
| `iemis_importer` | deliberate — XLSX ministry import is admin back-office | none (admin web) |
| `incident_management` | deliberate duplicate — the unmerged workflow tier (see DUPLICATION_MATRIX §1); apps use `incidents` slug only | — (merge first) |
| `multi_branch` | **GAP for chains** — branch switcher in admin app | admin |
| `sms_notifications` | deliberate (backend channel); send-from-admin-app is a plausible low gap | admin (low) |
| `whatsapp_bot` | deliberate — WhatsApp is its own client surface | none |
| `white_label` | deliberate-ish — branding applies server-side; static app branding can't rebrand anyway | admin (config exists) |
| `website_builder` | deliberate — canvas builder is desktop-only by nature | none |

### 1.2 API modules with ZERO mobile consumers (23 of 67)

**Gaps (a role-app user plausibly needs them):** `adaptive_learning.py`, `ai_capture.py` (photo homework-scan — a stated plan in FINAL_AI_PLATFORM_PLAN with no client), `ai_tutor.py` **session endpoints** (`:18-187` — plans/sessions/turn/close/messages/monitor unused; mobile tutor is stateless single-shot), `ai_workbench.py` (14 rules; stated pillar), `benchmarking.py`, `biometric.py`, `custom_fields.py` (custom fields don't render in any mobile form), `disaster_management.py`, `faqs.py` (small: in-app help), `hostel.py` (12 rules — top gap), `multi_branch.py`, `search.py` (no global search on mobile), `teaching_content.py` (the nepal_textbooks corpus is invisible to teachers on mobile), `question_bank.py` (feeds backend tools, no client).

**Deliberate (web-only by design, with evidence):** `ai_usage.py` (admin usage dashboards), `content_admin.py` (review queue is desktop work), `db_backup_api.py` (ops), `iemis_importer.py`, `incident_management.py` (duplicate), `sms.py`, `sse.py` (web stream), `super_admin.py` (platform console; flutter_user explicitly dead-ends admin roles, `role_app_host.dart:234-284`), `themes.py`, `website.py` + `website_builder.py`, `whatsapp_bot.py`.

**Covered via aggregates (not gaps):** `portfolio.py` (apps use `/student|parent|teacher/portfolio` aggregates), `staff.py` (teacher.py covers app needs — though no staff *directory* screen exists, see §1.3).

### 1.3 Web dashboard routes with ZERO mobile counterpart (17 of 60)

`ai-teacher`, `ai-workbench`, `benchmarking`, `biometric`, `bulk-uploads`, `content-review`, `designer`, `disaster`, `faqs`, `hostel`, `iemis-import`, `multi-branch`, `sms`, `staff`, `white-label`, `website-builder`, `teaching-content`.

- **Deliberate web-only within that set:** bulk-uploads, content-review, designer (canvas), iemis-import, website-builder, white-label, sms (config), faqs (public-site artifact), benchmarking (arguable).
- **Gaps that matter:** **ai-teacher / ai-workbench** (the AI pillar has no mobile face beyond 4 generate-tools), **hostel**, **disaster**, **biometric**, **multi-branch**, **staff directory**, **teaching-content**.

---

## 2. Prior-candidate confirmation (every candidate from the audit brief, confirmed or dismissed with evidence — aschool-mobile.md §5.4)

| Candidate from the brief | Verdict |
|---|---|
| AI teacher / workbench / insights | **Confirmed zero** (ai_teacher, ai_workbench); "insights" partially covered (daily-brief + weekly on admin dashboard/AI tools) |
| alumni | **DISMISSED** — admin alumni screen full (3 endpoints, live 200) |
| biometric | **Confirmed zero** |
| compliance / IEMIS | compliance **COVERED** (admin screen, 3 report types); IEMIS-importer zero (deliberate) |
| conferences | **DISMISSED** — parent PT-conference screen with booking (447 lines) |
| designer / website-builder | **Confirmed zero** (deliberate — canvas/desktop work) |
| disaster management | **Confirmed zero** |
| gamification | **DISMISSED** — admin leaderboard/badges + student points/badges/houses |
| health records | **DISMISSED** — 3 apps incl. parent 3-type view |
| hostel | **Confirmed zero — top gap** |
| HR payroll | **DISMISSED** as a screen (admin 3-tab + teacher slips/leave) — but admin leave-approval has no approve/reject actions (thin) |
| incident management | covered via `incidents` slug (thin list screen); duplicate workflow plugin unmerged/unused |
| inventory | **DISMISSED** — full CRUD admin screen (rewritten A-03) |
| LMS online exams | **DISMISSED** — student runner is best-in-repo; teacher authoring is thin |
| portfolio | **DISMISSED** — 4 apps |
| question bank | **Confirmed zero mobile** |
| staff | **Confirmed zero** (no staff directory screen) |
| student transfers | **Confirmed zero** (backend model/API under students; no mobile flow) |
| visitor management | **DISMISSED** — admin full screen incl. badge lookup |
| wellbeing | **DISMISSED** — 4 apps |

**Net correction to the brief's assumption:** of the 20 prior candidates, **9 are confirmed gaps, 10 are dismissed** (covered or deliberate), 1 partial. The brief's list over-stated absence — ASchool mobile is broader than the shared-package's 20 models suggest (the apps bypass `aschool_shared` models with direct repository calls), and the real gap list is: **hostel, the AI workspace family (ai_teacher/ai_workbench/ai_capture/adaptive_learning/ai-tutor-sessions), biometric, disaster management, multi-branch, staff directory, global search, teaching-content, question bank, student transfers, custom fields rendering.**

---

## 3. Thin coverage (present but shallow — the second-order parity problem)

Mobile consumes only a fraction of several large backend domains (aschool-mobile.md §5.2 tail):

| Domain | Backend rules | Mobile uses | What's missing on mobile |
|---|---|---|---|
| `exams.py` | 35 | ~8 | tabulation / merit / grade-scales / mark components |
| `fees.py` | 57 | ~10 | day-closure / aging / fines / carry-forward (admin surfaces) |
| `library.py` | 34 | 3 | scan / holds / fines / stock-take |
| `transport.py` | 28 | ~10 | trips CRUD / monitor / reports (admin app) |
| `hr_payroll.py` | 25 | 3 | leave approve/reject, payroll run |

Also: `flutter_admin` has 36 feature dirs but 34 of 36 are single-file screens — broad-then-thin (mobile report §3.1), trailing the backend by three waves (library v2, fees S-A1, exams S-A2, transport S-A4 all invisible on admin mobile).

---

## 4. Shared-vs-duplicated context (why parity is expensive today)

From aschool-mobile.md §4: 0 byte-identical files; `aschool_shared` = 108 files / 14,934 lines (~26% of total lines but ~75-80% of functional logic); ~11% of app-layer code is copy-variant duplication (4× login/theme shells ≈1,528 lines, AI-tool twins ≈1,066 lines, 4× notice wrappers, ~2,000 lines of setState boilerplate). The five-vs-one verdict (§9): consolidate to **2 shipping apps** (unified `flutter_user` + `flutter_admin`) after push config, deep links, and the web-version override conflict are fixed — the hedge already exists (`flutter_user` embeds the three role apps).

---

## 5. Prioritized parity recommendations

1. **Hostel (parent + admin)** — the single biggest confirmed gap; classic Nepal boarding-school need; 12 backend rules already exist, zero clients. Build parent "child's room/warden" + admin occupancy first.
2. **AI pillar mobile face** — wire `ai_tutor.py` session endpoints into the student app (the stateless single-shot tutor wastes a built backend), and a teacher AI-tools surface beyond the 4 generate-tools; admin at-risk list from `ai_suite`.
3. **Teacher content library** — surface `teaching_content.py` / the nepal_textbooks corpus in the teacher app (the moat is invisible to the audience it was built for; supporting report found zero books ingested — fix ingestion first or the mobile screen has nothing to show).
4. **Global search** — one backend rule (`search.py`), no client; Spotlight proves the pattern works on web.
5. **Staff directory + leave approve/reject** — admin app HR depth.
6. **Biometric app-unlock** — table-stakes mobile feature that also justifies the plugin's name; device-sync UI can stay web.
7. **Disaster management alerts** — parent/student push for drills (Nepal-specific differentiator).
8. **Multi-branch switcher** — only if/when chain schools are a target segment (needs-product-decision).
9. **Custom-fields rendering in mobile forms** — otherwise web-collected data is invisible/inconsistent on mobile.
10. **Thin-depth lifts** (exams tabulation view, library scan/holds, transport admin reports) — each is a small screen over existing endpoints.
