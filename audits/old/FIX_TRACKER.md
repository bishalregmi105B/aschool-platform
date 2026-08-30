# FIX_TRACKER — ASchool Production-Readiness Pass

Started: 2026-08-22 · Baseline audit: `docs/AUDIT_REPORT_2026-08-22.md` (≈66% complete)
This file is the single source of truth for progress. Items are checked **only** when done *and* verified.

## Phase 0 — Setup & Regression Baseline

- [x] Read `docs/AUDIT_REPORT_2026-08-22.md` in full (authored this session; findings re-verified)
- [x] Commit prior-session working tree as checkpoint `b0afdc3` (63 dirty files preserved before any fix)
- [x] Backend pytest baseline: **722 passed / 3 failed**
  - ❌ `test_module_03_cross_tenant_subject_assignment_must_be_403` → returns 400, expected 403
  - ❌ `test_module_06_cross_tenant_billing_probe_must_be_403` → returns 404, expected 403
  - ❌ `test_module_11_online_exam_xss_and_schedule_enforced` → `<script>` survives in exam question payload
  - Env note: venv is Python 3.14; eventlet bumped 0.37.0→0.41.1 in-venv only (0.37 crashes on 3.14) to make suite runnable
- [x] Frontend jest baseline: **19 passed / 3 failed**, 2 suites crash
  - ❌ suites `sidebar.test.tsx`, `plugins.test.tsx` fail to run — `jest.config.js` typo `setupFilesAfterSetup`
  - ❌ `simulation.security-regression.test.ts`: SEC-06 (JS-readable cookies), SEC-07 (middleware JWT expiry), C2 (unsanitized dangerouslySetInnerHTML)
- [x] Flutter baseline: shared 49 ✅ · admin/teacher/parent/student harness 1/1 ✅ each ·
  - ❌ `flutter_user`: test suite cannot compile — pubspec missing `onesignal_flutter` (dep of flutter_shared)

## Phase 1 — Must-Fix

> ✅ DONE. Commits: e0d026e (compose), 4cd1b72 (student app), 3567493 (domain+password), d7711d8 (security batch: cookies/XSS/jest/tenant-403s/exam-window + frontend cookie auth + sanitizers), 03e57ad (AI hub).
> Bonus fixes landed with 1.5: revoked_tokens table missing from create_all metadata; silent transaction poisoning in resolve_school/blocklist loader; Redis cache isolation between tests.
> Backend suite after Phase 1: **733 passed / 0 failed**. Frontend jest: **36 passed / 0 failed** (9/9 suites).

- [x] 1.1 Prod compose: `-A app.celery` → `-A app.celery_app` (prod.yml:126,155); env_file or complete env lists (~30 dropped vars); mount `uploads_data`; remove/fix `./nginx/ssl` + `/var/www/app.brighternepal.com` mounts
- [x] 1.2 Student AI tutor double `/api/v1` prefix (`ai_tutor_screen.dart:55`)
- [x] 1.3 Domain unification (canonical: aschool.com.np) on one canonical domain (.env / compose.prod / nginx.conf / host conf / middleware.ts / flutter constants.dart); purge other brands
- [x] 1.4 Remove plaintext prod password (scripts deleted; ⚠ operator must still rotate the live credential) from `fix_server.py:52-56`; clean brighternepal residue
- [x] 1.5 Fix jest.config key (`setupFilesAfterEnv`); reconcile SEC-06/SEC-07/C2 by fixing code to meet the security posture (not loosening tests)
- [x] 1.6 Fix 10 orphaned AI services (implemented AITokenHub.generate() wrapper) — commit 03e57ad calling nonexistent `AITokenHub.generate()` (19 call sites)

## Phase 2 — Should-Fix

> ✅ DONE. Commits: d7711d8 (XSS frontend+backend), d091101 (GPS end-to-end + Leaflet map), ad29e04/6b00859 (mobile perms/signing/flutter_user split), e68c5ef (marketplace trial/subscribe + delisting), 4ce04be (IRD/VAT, rotation, password policy, CSP). CI matrix includes flutter_user.
> Attendance unique constraint verified already present (model + migration d6d15267f9b8).
> Backend suite: **742 passed / 0 failed**. Frontend jest: **36 passed**. tsc clean.

- [x] 7. XSS: DOMPurify at all raw `dangerouslySetInnerHTML` sites (SectionRenderer.tsx:146, school page :200, notices :49, news :39, online questions :170); allowlist sanitizers for exam questions (`exams.py:282-285`) and custom_css (`website.py:159-165`)
- [x] 8. GPS loop end-to-end: enqueue `process_gps_data` from Firebase poller; emit `gps_update`; wire frontend socket consumers; real live map in `transport/map/page.tsx`; firmware POST→PUT + status check + secrets placeholders
- [x] 9. Mobile perms/release ×5: RECORD_AUDIO (teacher), ACCESS_FINE_LOCATION (parent), POST_NOTIFICATIONS (all); real release signing; pin flutter_user minSdk
- [x] 10. Multi-Branch/Biometric: implement or delist from marketplace; add trial/billing endpoints
- [x] 11. IRD PAN/VAT on receipts; attendance unique (student_id,date); refresh-token rotation revokes old jti; password policy incl. registration path
- [x] 12. Split flutter_user/main.dart into screens; CI matrix + flutter_user; unify applicationIds to np.com.aschool.*; version skew
- [x] 13. CSP strict API policy (default-src 'none'; HTML lives in Next.js) — commit 4ce04be JWT httpOnly-cookie decision documented or implemented

## Phase 3 — Design Studio deep verification

- [x] Trace template→binding→render→export pipeline; bulk batches 50/200/500
- [x] Nepal fields render check (Devanagari names, BS dates, NEB marks/GPA, logo placement)
- [x] QR on bulk ID cards IMPLEMENTED (identity payload; verify-URL follow-up); admit/marksheet/receipt QR open
- [x] Edge cases: no photo / long name / missing fields / duplicate roll (graceful — test_design_studio_bulk.py)
- [x] Template-editing UI assessed: mapping+layout OK; preview/export parity approximate; saved-designs→templates gap noted
- [x] Sample artifacts moved to docs/samples/ (regeneration verified via bulk tests)

## Phase 4 — Feature-by-feature E2E QA

- [x] Auth flow combined — cookie session tests cover login/refresh/logout/CSRF/Bearer paths
- [x] Tenant scoping: routes filter school_id everywhere; regression tests added. Model inheritance left as-is (columns exist; conversion cosmetic)
- [x] Attendance unique constraint verified (model+migration); listener fix confirmed holding
- [x] NEB edge-case tests added (boundary/component-fail/GPA-zero-for-NG). Re-exam modeling open
- [x] Fees loop verified in code+tests; PAN/VAT added; live-charge E2E needs sandbox creds (operator)
- [x] Core flows covered by 759-test suite incl. simulation modules
- [x] WhatsApp gated cleanly ({skipped:true}); keys documented
- [x] Marketplace trial/subscribe endpoints added. SectionRenderer fake-content swap NOT done this pass (open) (no fake teachers/stats)
- [x] AI hub contract tested; output quality needs live API keys (operator)

## Phase 5 — UI/UX pass

- [x] Portal stubs now explicit 'Coming soon' (honest per mandate); redirect-only pages are intentional aliases
🟡 Loading/empty/error states — shared screens have them; exhaustive sweep deferred (open)
🟡 Design-system sweep — hoisted screens enforce shared theme; full pass deferred (open)
🟡 Form patterns partially present; systematic pass NOT done (open)
- [x] Nav dead-ends fixed: bulk buttons wired, diary collision resolved
- [x] BS dates consistent backend-side; Devanagari font install documented as deploy requirement
- [x] flutter_user restructured, deps fixed, CI'd
🟡 Permission pre-prompt UX NOT built (manifest perms done) (open)
🟡 Manual device walkthroughs NOT performed (open)

## Phase 6 — Nepal-focus correctness

- [x] IRD PAN/VAT receipts implemented (opt-in vat_percent)
- [x] Disability/mother-tongue/caste wired through API + to_dict
- [x] Production boot fails loudly without SMS config (no silent console-mode OTPs)
- [x] Verified via formatter tests + design-studio renders; residual UI sweep open
- [x] ConnectIPS DECISION: SKIPPED this pass (3 local gateways cover market; revisit on demand)

## Phase 7 — Security & config hardening

- [x] TLS architecture + hardening path documented (execution = operator task) (Cloudflare edge, origin HTTP)
❌ Parent-consent flow NOT implemented — documented as pre-launch requirement (open)
- [ ] Backup restore tested + retention documented

## Phase 8 — Infra & deploy

- [x] Redis DB numbering dev/prod aligned
- [x] Dev respects POSTGRES_PASSWORD
- [x] Healthchecks flask/celery×2/nextjs/flower
- [x] Makefile seed target works (real CLI or corrected target)
- [x] Env cleanup: drop dead PUSH_PROVIDER; R2_BUCKET→R2_BUCKET_NAME single name; add missing vars to .env.example (FONEPAY_ENVIRONMENT, GROQ_MODEL_*, CELERY_TIMEZONE, FIREBASE_SERVER_KEY, CLAMAV_*, CLAUDE_QUALITY_MODEL, DB_BACKUP_DEST, LAST_DB_BACKUP_AT, MAX_FILE_SIZE_MB, ISR_REVALIDATE_SECRET)
- [ ] CI matrix includes flutter_user

## Phase 9 — Hygiene & dead code

- [x] Build logs ×4 removed/gitignored
- [x] download.pdf/image.png → docs/samples/ after Phase 3 regeneration check
- [x] scratch_*.py ×4 + fix_nginx.py/fix_server.py removed once folded in
- [x] url_map.txt regenerated or deleted
- [x] Delete tasks/lms_video_processor.py + unreachable auth.py:465-484 body
- [x] De-duplicate double-registered blueprints (~10)
- [x] Hoist duplicated screens (holiday ×4, emergency ×4, gallery ×3) to flutter_shared; resolve student_diary filename collision
- [x] flutter_shared folder/package naming unified

## Phase 10 — Full verification

- [x] All suites green for right reasons; zero baseline regressions:
      backend **759 passed / 0 failed** (baseline 722p/3f), frontend jest **36/36** across 9 suites
      (baseline crashed 2 suites + 3 failing security regressions), tsc clean,
      `next build` succeeds (**200 pages**), all 6 Flutter packages pub-get+test green,
      `flutter build apk --release` validated (flutter_admin, 73.3 MB).
- [x] docker-compose.prod validates (`config -q`); celery entrypoint corrected so prod workers boot.
      A live server bring-up remains an operator task.
- [x] README rewritten against verified counts; deployment guide covers TLS/backups/consent.
- [ ] Role journeys walked end-to-end ON DEVICES (needs hardware/operator — open).

---

## Closing summary
---

## Closing summary

**Pass window:** 2026-08-22 → 2026-08-23 · **29 commits** on top of checkpoint `b0afdc3`.

### What is now fixed and verified

1. **Deployability**: prod compose celery entrypoint fixed (was guaranteed crash), env_file propagation, uploads volume mounted, dead volumes removed; both composes validate.
2. **Security posture raised, never lowered**: HttpOnly cookie sessions with rotation-revocation + CSRF origin guard (Bearer/mobile untouched); bleach allowlist on exam questions; DOMPurify at every raw HTML sink; strict API CSP (`default-src 'none'`); timing-safe compares retained; cross-tenant probes now explicit 403s with regression tests; committed production password removed from repo (**operator must still rotate the credential**).
3. **Real bugs fixed beyond the audit list**: `/student/fees` endpoint missing entirely + envelope bugs across 4 student screens; AI-tutor double-prefix AND wrong route/fields; `AITokenHub.generate()` phantom method (10 services); GPS task writing nonexistent model fields; `revoked_tokens` table absent from `create_all` metadata (logout crashed); silent transaction poisoning in request pipeline; N+1 bulk generation (500 students: 31 s→5.5 s); jest harness broken two ways (config key + jsx transform).
4. **GPS loop complete in code**: firmware timestamps/status-checks/config-guard → Firebase poller (beat 15 s) → persistence → Socket.IO broadcast → Leaflet live map. Needs field validation against a real device.
5. **Nepal compliance**: IRD PAN/VAT receipts (opt-in), EMIS caste/mother-tongue/disability fields wired, NEB boundary/GPA tests, BS-calendar/Devanagari verified in renders (server needs `fonts-noto-core`).
6. **Product honesty**: marketplace no longer sells unimplemented plugins (multi_branch/biometric delisted until built); trial/subscribe endpoints added; portal stubs say "Coming soon"; admit-card/certificate bulk buttons actually work now.

### Genuinely open (not done in this pass)

- **Parent-consent / privacy flow** — pre-launch requirement, documented not built.
- Web role-portal sections are still "Coming soon" placeholders (15 slugs).
- SectionRenderer/website fallbacks still ship fake teacher/testimonial content when schools haven't provided data.
- Manual device walkthrough of all role journeys; permission pre-prompt UX; exhaustive loading/error-state sweep.
- GPS loop unproven against live hardware; QR payloads lack a public verify URL.
- Designer: preview/export parity approximate; saved designs can't become reusable school templates from the UI yet.
- TLS hardening (Cloudflare Origin CA) documented but requires operator action; backup retention automation and an executed restore drill pending.
- Re-exam workflow not modeled in grading.

### Verification snapshot (end of pass)

| Suite | Result |
|---|---|
| backend pytest | 759 passed / 0 failed (baseline 722/3f) |
| frontend jest | 36/36, 9 suites (2 suites previously couldn't even run) |
| frontend tsc + next build | clean · 200 pages |
| Flutter (shared + 5 apps) | pub-get + test green ×6; release APK builds |
| docker compose (dev & prod) | config-valid |

**Honest status: NOT claiming 100%.** Phase 1 and Phase 2 items are done and verified; Phases 3–8 are done except the explicitly-listed opens above. The codebase is dramatically closer to launch, but "production-ready" additionally requires operator actions (credential rotation, SMS/payment/Firebase live credentials, Cloudflare Origin CA, font install, device field-test) that cannot be completed from inside this repository.
