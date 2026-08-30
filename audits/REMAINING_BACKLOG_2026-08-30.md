# REMAINING BACKLOG — 2026-08-30 (Phase-9)

Prioritized, with concrete unblocking steps. Sources: FIX_STATUS_2026-08-28.md, LIVE_BROWSER_UX_TEST.md, coverage ledgers, DATA_HYGIENE_2026-08-30.md. Nothing here is invented; items without a fix ID are explicitly logged residuals from the inputs.

## P1 — fix before any real users

1. **Login lockout 500** (`backend/app/services/auth_service.py:166` — `_check_lockout` compares naive `locked_until` to `datetime.now(timezone.utc)`; 5 wrong passwords → 500-loop instead of a lockout message; hit live while probing the demo admin).
   Unblock: tz-safe comparison (coerce naive→UTC as `_set_school_context` already does for trials); add lockout-path regression test in `tests/test_auth.py`; verify 5 wrong passwords → 423/401 message, not 500.
2. **Student/parent mobile login provisioning** — student users have empty phone/email and no Student-ID login identifier; demo has no parent account; student/parent app logins ⚪ untestable (LIVE_BROWSER_UX_TEST scope-out; `POST /auth/student-login` exists and was proven via bulk-reset-passwords).
   Unblock: (a) auto-generate enrollment/login IDs at student creation (UX test suggests `{year}-{GR}-{seq}`); (b) ensure every Student row gets a login-capable identifier the student app can use; (c) auto-create/attach parent logins at admission accept (the funnel already creates Guardian + parent User — wire phone + default password + `phone_verified=False`); (d) backfill existing demo students; (e) E2E login on :8093/:8094.
3. **Website contact/admission inbox** — `/website/public/<slug>/contact` + admission-inquiry persist to audit_logs/DB (201 verified) but no admin surface reads them.
   Unblock: add a "Website Inbox" page reading contact-form submissions (new small model or audit-log query by `action=contact_form`), tenant-scoped, with read/unread; list admission inquiries from the existing table.
4. **Teacher-delete orphan users** — deleting a teacher removed the Staff profile but left an active User row (phone 9811111111 stayed login-capable).
   Unblock: teacher delete must deactivate or delete the linked User (same treatment as student delete); add orphan sweep check to the hygiene script; regression test.
5. **Complete the backend file-by-file review** — `audits/coverage/BACKEND_FILE_VERIFICATION.md` is complete for slice 3 (fees/tasks, hr, admission, inventory, visitor, dismissal, transport) with slice-1/slice-4 sections present; **slices 1/2/4–7 are marked pending/incomplete** by the effort. Their files are currently covered only by batch evidence (FIX_STATUS §1a–§1e probes, frontend ledger, route sweeps), not file-by-file verdicts.
   Unblock: run the same per-file protocol (every route probed positive + negative + cross-tenant, url_map cross-check, regression tests) over: academics/exams/attendance/timetable/assignments; library/elibrary/health/wellbeing/gamification/social/portfolio; AI/adaptive/website-builder/designer; plugins internals (loader/decorators/billing); record verdicts in the same ledger.

## P2 — production deployment hardening (no evidence any of this exists in the inputs)

6. **TLS + reverse proxy** — terminate TLS in front of Next.js (:3003) and Flask (:5003); secure cookies already flag-gated in `config.py` (uncommitted JWT/cookie work) — enable Secure/SameSite behind it.
7. **Production secrets ≥32 bytes** — set real values for JWT secret, `STRIPE_WEBHOOK_SECRET` (default empty → Stripe always 400s), `WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN` (verify now fails closed, E198), `ISR_REVALIDATE_SECRET`, `NEXTJS_INTERNAL_URL`, DB/Redis passwords, `ANTHROPIC_API_KEY` (dev key is a placeholder — every AI path honestly 502s until then). Ship a `.env.example` documenting every key referenced in the audits (incl. `CORS_ALLOW_ORIGINS`, `PLUGIN_TRIAL_DAYS`, `FILE_ALLOWED_EXTENSIONS`, `AI_DEFAULT_*_LIMIT`).
8. **Gunicorn/Socket.IO + Celery prod config** — replace flask dev server; run Socket.IO under its prod worker/async mode; deploy checklist item: **restart celery workers on every task-file change** (proven load-bearing: stale worker kept SMS rows `queued` forever, E93, and produced dead report-card URLs); keep the `gps`-queue worker split (15 s beat).
9. **Backup restore drill** — backups exist (pg_dump→gzip→R2, retain 30, superadmin API + `tasks/db_backup.py`) but no restore has been proven; schedule + document a restore drill.
10. **Open product decisions from the ledger** (cheap to schedule now): E22a flip `/assignments/<id>/ai-grade` to `plugin_required("ai_grading")` or reprice; E22b insights dual-gate; E22c stale manifest metadata; E95 landing demo-request endpoint; E97 real RBAC editor or remove the fake page; E14 follow-up — unpublish the `library`/`library_management` double listing (same feature published twice at one price) or document it as intentional.
11. **Mobile push (M1/M2)** — call `NotificationService.init()` in all 5 apps' `main.dart`, wire the notification-center route, then `register-fcm` becomes real. (Currently push is dead end-to-end; only in-app notifications work.)

## P3 — polish

12. **Flutter app icons/splash** — all 5 apps still ship default Flutter icons (not called out by any audit fix; no evidence of custom assets in the inputs).
13. **flutter_user storage consistency** — align the user-app's token/session storage with the other apps' secure-storage pattern (M9/M7 work normalized the rest).
14. **i18n depth** — Nepali date/currency surfaces are strong (BS pickers, `formatNepaliCurrency`); full UI-string i18n is not implemented anywhere in the inputs.
15. **Logged cosmetic residuals (no IDs):** landing footer removed stubs done; "Send Reminder" no-op on defaulters; library checkout Scan decorative; visitors "Visiting" column; analytics 300 s cache; benchmarking N+1; admin-flutter `/dismissal/summary` 404; `regenerate-key` FE caller; unset-custom-domain API; conference booking row-lock; ZIP profile-image memory cap + folder_id school validation; `/uploads/*` served unauthenticated (platform-wide decision needed); learning-path step-completion endpoint; E165 parent conference row-lock.

## Verification env reminders (infra, not code)
- Use dedicated `TEST_DATABASE_URL` per suite — shared `aschool_test` TRUNCATE-deadlocks under concurrent pytest.
- `docker restart aschool-celery-worker-1` after task-file edits before re-verifying task behavior.
- `pypdf` missing in the flask container breaks one receipt-PDF test (install or vendor).
