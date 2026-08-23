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

- [ ] Trace template→binding→render→export pipeline; bulk batches 50/200/500
- [ ] Nepal fields render check (Devanagari names, BS dates, NEB marks/GPA, logo placement)
- [ ] QR code on ID/admit cards decision logged (implement if feasible)
- [ ] Edge cases: no photo / long name / missing fields / duplicate roll / mid-year transfer
- [ ] Template-editing UI usability + print-preview fidelity
- [ ] Regenerate sample docs vs download.pdf/image.png, then move artifacts to docs/samples/

## Phase 4 — Feature-by-feature E2E QA

- [ ] Auth flow combined (OTP+lockout+MFA+revocation)
- [ ] Tenant scoping gaps closed: Hostel/HostelRoom/HostelAllocation, FAQ, DesignerTemplate → SchoolModel scoping
- [ ] Attendance constraint + listener regression check
- [ ] NEB grading edge cases (boundary marks, absent, re-exam)
- [ ] Fees: full payment→webhook→receipt loop ×3 gateways incl. refund + idempotent replay (+ PAN/VAT)
- [ ] Timetable/Library/Hostel/HR/Inventory/LMS core-flow walk
- [ ] WhatsApp Cloud keys: fix or gate cleanly (no KeyError)
- [ ] Marketplace billing/trial endpoints; website-builder honest empty states (no fake teachers/stats)
- [ ] AI wired tools produce useful output (Groq/Claude via hub)

## Phase 5 — UI/UX pass

- [ ] Eliminate 15 "Section Ready" portal stubs + 8+ redirect-only pages (real screens or removed nav entries)
- [ ] Loading/empty/error states on all list views
- [ ] Design-system consistency sweep (web + ASchoolTheme)
- [ ] Form validation/in-flight/disabled/destructive-confirm patterns
- [ ] Nav dead-ends & URL-only screens fixed
- [ ] Bilingual consistency (BS dates/Devanagari everywhere applicable)
- [ ] flutter_user parity polish
- [ ] Runtime permission pre-prompts with rationale
- [ ] Role journey click-throughs; cut unnecessary steps

## Phase 6 — Nepal-focus correctness

- [ ] IRD PAN/VAT receipts (with tests)
- [ ] Disability + mother-tongue student fields
- [ ] Real SMS delivery enforced for production env (no silent console-mode OTPs)
- [ ] Devanagari numerals/BS dates/NEB grades consistent everywhere
- [ ] ConnectIPS explicit implement-or-skip decision recorded

## Phase 7 — Security & config hardening

- [ ] TLS posture documented/tightened (Cloudflare edge, origin HTTP)
- [ ] Parent-consent / student-data privacy flow
- [ ] Backup restore tested + retention documented

## Phase 8 — Infra & deploy

- [ ] Redis DB numbering dev/prod aligned
- [ ] Dev respects POSTGRES_PASSWORD
- [ ] Healthchecks flask/celery×2/nextjs/flower
- [ ] Makefile seed target works (real CLI or corrected target)
- [ ] Env cleanup: drop dead PUSH_PROVIDER; R2_BUCKET→R2_BUCKET_NAME single name; add missing vars to .env.example (FONEPAY_ENVIRONMENT, GROQ_MODEL_*, CELERY_TIMEZONE, FIREBASE_SERVER_KEY, CLAMAV_*, CLAUDE_QUALITY_MODEL, DB_BACKUP_DEST, LAST_DB_BACKUP_AT, MAX_FILE_SIZE_MB, ISR_REVALIDATE_SECRET)
- [ ] CI matrix includes flutter_user

## Phase 9 — Hygiene & dead code

- [ ] Build logs ×4 removed/gitignored
- [ ] download.pdf/image.png → docs/samples/ after Phase 3 regeneration check
- [ ] scratch_*.py ×4 + fix_nginx.py/fix_server.py removed once folded in
- [ ] url_map.txt regenerated or deleted
- [ ] Delete tasks/lms_video_processor.py + unreachable auth.py:465-484 body
- [ ] De-duplicate double-registered blueprints (~10)
- [ ] Hoist duplicated screens (holiday ×4, emergency ×4, gallery ×3) to flutter_shared; resolve student_diary filename collision
- [ ] flutter_shared folder/package naming unified

## Phase 10 — Full verification

- [ ] All suites green for right reasons; no baseline regressions
- [ ] docker-compose.prod boots clean; next build ok; release builds signed
- [ ] Role journeys walked end-to-end
- [ ] README/docs updated to match reality
- [ ] Honest closing summary below

---

## Closing summary

_(filled at end of pass — see Phase 10)_
