# Main-agent direct findings (2026-09-02)

Measured, not inferred. Every number below came from a command in this session.

## Scale (verified counts)

| Thing | Count | How measured |
|---|---|---|
| Backend route decorators | 681 | `grep -rn "@.*_bp.route" backend/app` |
| Blueprints | 69 | `grep -rn "Blueprint("` |
| Model classes (`class ` in models/) | 161 | `grep -rhn "^class " backend/app/models/*.py` |
| Model files | 60 | `ls backend/app/models` |
| Alembic migrations | 33 | `ls backend/migrations/versions` |
| Plugin module dirs | 53 | `ls backend/app/plugins/modules` |
| Legacy manifests (yaml) | 8 | `ls backend/app/plugins/manifests/*.yaml` |
| Module manifests | 57 | find under modules/ |
| Next.js `page.tsx` | 222 | find |
| Next.js `layout.tsx` | 10 | find |
| Files with `use client` | 266 | grep -rl |
| Designer templates on disk | 40 | `ls backend/app/templates/designer` |
| Backend app+tests+migrations LOC | 79,115 | wc -l |
| Frontend ts/tsx LOC | 71,549 | wc -l |
| Backend test files | 50 | ls |
| Frontend test files | 9 | ls |
| Tracked files in git | 1,739 | git ls-files |
| Working-tree size | 12 GB | du (mostly Flutter build dirs + 2 vendored PHP ERPs) |

## P0/P1 findings I verified myself

### F-01 (P0) No `error.tsx`, `loading.tsx`, or `not-found.tsx` anywhere in 222 pages
`find frontend/app -name "error.tsx" -o -name "loading.tsx" -o -name "not-found.tsx"` → **empty**.
Any render-time throw in a server component produces the default Next.js error screen with
no branding and no retry. There is no route-level suspense boundary, so every navigation is
a blocking wait with no skeleton.
Fix: add `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, plus per-segment
`loading.tsx` for `dashboard/`, `school/[slug]/`, and each portal.

### F-02 (P0) Three role portals are 18 hardcoded "Coming soon" pages
`frontend/lib/portal-route-meta.ts:15-112` is a static map of 6 parent + 6 student + 6 teacher
routes; `components/portal/portal-section-page.tsx:29` renders `<CardTitle>Coming soon</CardTitle>`
for every one of them. The only real portal pages are `app/student/homework`,
`app/teacher/assignments`, `app/teacher/marks`. So the product ships a student portal where
timetable, results, library, LMS, and AI tutor are all placeholder cards.

### F-03 (P0) `.env` / `.env.example` / code are three different sets of keys
- 15 keys are read by code but absent from `.env.example`:
  `FILE_ALLOWED_EXTENSIONS, FILE_STORAGE_BACKEND, LOCAL_UPLOAD_DIR, MAIL_TIMEOUT,
  NEXTJS_INTERNAL_URL, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, PEXELS_API_KEY,
  PLATFORM_IP, PLUGIN_FREE_TIERS, PLUGIN_TRIAL_DAYS, SMS_CONSOLE_MODE,
  SOCKET_MESSAGE_QUEUE, STRIPE_WEBHOOK_SECRET, UNSPLASH_ACCESS_KEY`
- 26 keys in `.env.example` are missing from the live `.env`, including `COOKIE_SECURE`,
  `COOKIE_DOMAIN`, `ISR_REVALIDATE_SECRET`, `CLAMAV_*`, `GROQ_API_KEY`, `CELERY_TIMEZONE`,
  `SENTRY_DSN`.
- `.env.example` has duplicate lines (`AI_DEFAULT_DAILY_LIMIT`, `API_URL`, `GROQ_API_KEY`,
  `NEXT_PUBLIC_API_URL`, `SENTRY_DSN` each appear twice).
`SOCKET_MESSAGE_QUEUE` being undocumented matters: without it, Socket.IO across 4 gunicorn
workers silently drops events to clients attached to a different worker.

### F-04 (P0) `ProductionConfig.validate()` checks 4 things out of ~20 that matter
`backend/config.py:200-230` validates SECRET_KEY, JWT_SECRET_KEY, DATABASE_URL, SMS token.
Not validated: `ISR_REVALIDATE_SECRET` (empty → ISR revalidation silently unauthenticated
or dead), `STRIPE_WEBHOOK_SECRET` (empty → every Stripe webhook 400s), `COOKIE_SECURE`,
`SOCKET_MESSAGE_QUEUE` (multi-worker correctness), `R2_*` when `FILE_STORAGE_BACKEND=r2`,
`SENTRY_DSN`, secret **length** (a 4-char SECRET_KEY passes today).

### F-05 (P1) `JWT_COOKIE_CSRF_PROTECT = False` with `SAMESITE = "Lax"`
`backend/config.py:57-58`. Lax blocks cross-site POST from a form/fetch but *not* top-level
GET navigation, and any state-changing GET route is then CSRF-able. Combined with
`JWT_TOKEN_LOCATION = ["headers", "cookies"]` (line 53) the API accepts cookie auth on every
route. The comment claims "SameSite=Lax is enough" — that is true only if no GET mutates and
no subdomain is attacker-controllable. With `COOKIE_DOMAIN=".brighternepal.com"` and
per-school subdomains where schools inject custom CSS/HTML, a compromised school site is
same-site with the dashboard. Fix: enable CSRF double-submit for cookie transport, or scope
cookies to the app host only.

### F-06 (P1) Rate limiter falls open on Redis failure and is per-window, not token-bucket
`backend/app/utils/rate_limiter.py:59-61` returns `True` on any exception, and line 33
returns `True` when Redis is absent. The docstring says "token-bucket" but the implementation
is a fixed window (`int(now // window)`), which allows 2× burst at the boundary. Also
`from extensions import redis_client` at line 21 is a lazy import of a module-level singleton
— fine, but it means the limiter is silently a no-op in any process where `init_redis`
was not called.

### F-07 (P1) `nepali_date.py` has no error handling and no BS validation
`backend/app/utils/nepali_date.py:16-18` does `bs_str.split("-")` then `int(parts[N])`
with no length check, no try/except, and no range validation. Any malformed BS string
from a client raises `IndexError`/`ValueError` → 500. `nepali_datetime` also has a bounded
year range (roughly 1975–2100 BS); dates outside it raise. There is a
`validate_bs_date()` in `validators.py:33` but it is regex-only (accepts day 32) and is not
called from `bs_to_ad`.

### F-08 (P1) NEB grading: `calculate_gpa` marks a student "fail" on any NG but still returns
the aggregate letter grade
`backend/app/utils/nepal_grading.py:124-133`: `status` becomes "fail" when any subject is NG,
but `grade`/`description` still come from `calculate_grade(overall_pct)`. A transcript will
print "Grade: B+ / Status: fail", which is internally contradictory and not how NEB reports.
Also `PASS_PERCENTAGE = 35` and the D band at 35 are hardcoded module constants — a school
on a different board (CBSE-affiliated, or the basic-level non-graded scheme) cannot
configure boundaries. Grade scales must be per-school data, not Python constants.
Also `calculate_grade` returns the first band where `percentage >= min_pct`, so a percentage
above 100 (possible with grace marks) silently maps to A+ without a bounds error.

### F-09 (P1) Money-typed inputs flow into float math in the grading utility
`nepal_grading.py:56-61` divides floats for percentages — acceptable for grades, but
`calculate_subject_grade` accepts `theory_obtained: float`. Marks that come from a Numeric
DB column arrive as `Decimal`, and `Decimal / float` raises `TypeError`. Whether this fires
depends on the column type in `models/exam.py` — needs the model audit to confirm.

### F-10 (P1) Tenant resolution runs 3–4 DB queries on *every* request, uncached
`backend/app/__init__.py:326-355`: `_resolve_jwt_user()` does a `User.query` on every request,
then subdomain resolution does a `School.query`, then plugin resolution may do a
`SchoolPlugin.query`. The plugin list is cached 300 s but the school row and user row are
not. At 100 req/s that is 200+ redundant queries/s. Fix: cache school-by-slug and
user-by-id in Redis with short TTL and explicit invalidation on write.

### F-11 (P1) Plugin cache TTL of 300 s means entitlement changes take up to 5 minutes
`app/__init__.py:391` `cache.set(cache_key, plugins, timeout=300)`. Uninstall/deactivate
must invalidate; the audit docs say `_invalidate_plugin_cache` exists, but any path that
mutates `SchoolPlugin` without calling it leaves a school with access for 5 more minutes.
Worse: the trial-expiry defense at lines 371-384 is evaluated **at cache-fill time**, so a
trial that expires 10 seconds after a cache fill keeps working for the rest of the TTL.

### F-12 (P1) `_check_quota` blocks-by-default but `AI_QUOTA_ENFORCEMENT` short-circuits everything
`token_hub.py:233-234`: when `AI_QUOTA_ENFORCEMENT` is false, quota is skipped entirely —
no per-user limit, no per-feature limit, no spend cap. In dev that is intended; but the flag
comes from env with default `"true"`, and `docker-compose.prod.yml` passes
`AI_QUOTA_ENFORCEMENT=${AI_QUOTA_ENFORCEMENT:-true}` — one typo in `.env` (`AI_QUOTA_ENFORCEMENT=True`
would work, but `=1` would not, since the code compares to the literal string `"true"`)
silently disables all AI cost control in production.

### F-13 (P1) AI quota is counted in tokens, not money, and has no per-user or per-feature limit
`token_hub.py:245-248` compares summed `total_tokens` against a per-school daily/monthly
limit. Consequences:
- Groq tokens and Anthropic tokens are counted identically despite ~50× cost difference.
- One teacher can burn the whole school's daily quota.
- There is no cost column anywhere (`AIUsageLog` has token counts, no `cost_usd`).
- `_get_usage_today` sums the whole `ai_usage_logs` table per call with no index hint —
  an unindexed `WHERE school_id AND status AND created_at >=` aggregate on every AI request.

### F-14 (P1) AI provider fallback is one-shot with no retry, no timeout, no circuit breaker
`token_hub.py:376-429`: primary → fallback → raise. No `timeout=` passed to either client
(both SDKs default to 600 s for Anthropic, 60 s+ for Groq), no retry on 429/5xx, no
exponential backoff, no jitter, no circuit breaker. A Groq outage means every request pays
the full Groq timeout before trying Anthropic. Under gunicorn with 4 eventlet workers this
will exhaust the worker pool.

### F-15 (P1) No structured output enforcement anywhere in the AI layer
`question_paper.py:104-109` does `text.index("{")` / `text.rindex("}")` then `json.loads`,
and on failure returns `{"error": "Failed to generate paper. Please try again."}` — the
model's work is discarded with no repair attempt, no schema validation, and no logging of
what was actually returned. Every AI service in the codebase repeats this pattern. Neither
Groq's nor Anthropic's structured-output/tool-forcing modes are used.

### F-16 (P1) The AI question-paper prompt has no curriculum grounding and no marks arithmetic guarantee
`question_paper.py:38-96`. The prompt says "Follow Nepal's CDC guidelines" and gives a fixed
Bloom's split as a *string*, then asks the model to make totals add up. There is:
- no CDC specification grid (the actual per-unit question/mark table NEB publishes),
- no retrieval of the school's syllabus, chapters, or past papers,
- no post-generation validation that section marks sum to `total_marks`,
- no Nepali-language prompt variant (`language` is interpolated but the instructions
  stay English, so Nepali output quality is left to the model),
- no dedupe against previously generated papers,
- no answer-key/marking-scheme separation as a distinct artifact,
- no diagram support, no math typesetting instruction,
- `temperature=1.0` with the comment "matches the previous direct Anthropic default",
  which maximizes variance in a task that needs determinism.
This is the single feature the user called out ("ai qun paper genrator") and it is currently
a one-shot free-text prompt with a JSON-substring parse.

### F-17 (P2) `AIUsageLog` write is committed inside the request transaction
`token_hub.py:283-288` calls `db.session.commit()` to persist the usage row. That commits
whatever else the request had staged. An AI call in the middle of a business transaction
will partially commit it. Fix: separate session/`nested` transaction or defer to a queue.

### F-18 (P2) i18n is a 90-key Python dict; the frontend has no i18n at all
`backend/app/utils/i18n.py` hardcodes ~90 Nepali strings and derives English by
`key.replace("_"," ").title()`. There is no i18n library, no locale negotiation, no
pluralization, no date/number locale, and the 222-page frontend has zero translation
infrastructure (no next-intl / react-i18next / message catalog). A bilingual product
for Nepal cannot ship on this.

### F-19 (P2) 423 hardcoded hex colors in `frontend/app` + `frontend/components`
Despite a real token system in `tailwind.config.js` (ocean/mint/sun/fog/ink + CSS vars),
`grep -Eno "#[0-9a-fA-F]{6}"` finds 423 literal hex values. Dark mode is class-based
(`darkMode: ["class"]`) so every hardcoded color is a dark-mode bug.

### F-20 (P2) 11 `dangerouslySetInnerHTML` sites, 6 `Math.random()` sites in frontend
Needs per-site review: `sanitize.ts` exists (isomorphic-dompurify) but I have not verified
each of the 11 call sites routes through it. `Math.random()` in a school ERP frontend is
either fake data or a non-deterministic key.

### F-21 (P2) 10 temp/probe scripts are committed to git
`backend/_probe_campus_ops.py`, `probe_phase2_tmp.py`, `tmp_comms_verify.py`,
`tmp_fees_simulation.py`, `tmp_phase2_verify.py`, `tmp_probe_e24_batch.py`,
`tmp_wp_catalog_proof.py`, `tests/_dbg6_patch.py`, `tests/test_dbg_login5.py`,
`tests/test_dbg_tmp.py`. Two of those are `test_*.py` files pytest will collect and run.
Also tracked: `frontend/tsconfig.tsbuildinfo` (build artifact, changes every build — it is
in the current uncommitted diff), `class_scoped.pdf` at repo root.

### F-22 (P2) Docker containers write root-owned files into the mounted source tree
`backend/uploads`, `backend/__pycache__`, `backend/.pytest_cache`, `backend/celerybeat-schedule`,
`app/__pycache__`, `migrations/alembic_fixed.ini` are all owned by root. The dev bind-mount
runs as root; developers then cannot clean their own tree. Fix: run the container as the
host UID, or move uploads/beat-schedule to a named volume (compose already has
`uploads_data` for prod but dev mounts source).

### F-23 (P2) `migrations/alembic_fixed.ini` — an unexplained second alembic config, root-owned
Two alembic configs is how you get a migration applied against the wrong metadata.

### F-24 (P2) CI runs `flutter test ... || true` for all 6 Flutter packages
`.github/workflows/deploy.yml`: `run: flutter test --coverage || true`. Mobile tests can
never fail the build. `flutter analyze --no-fatal-infos` also downgrades info-level lints.

### F-25 (P2) Deploy job runs `git reset --hard origin/main` on the production server
`.github/workflows/deploy.yml` deploy step. Any operator hotfix on the server is destroyed
without warning, and there is no backup-before-reset. Also: migrations run *after*
`up -d nextjs flask`, so the new code serves traffic against the old schema for the length
of the migration; and there is no rollback path if `flask db upgrade` fails — the health
check at the end is the only gate, and by then the new image is already live.

### F-26 (P2) Health check is `curl -f http://localhost/health` only
No readiness gate on DB/Redis in the deploy script (a `/ready` route exists per the README
but is not used), no smoke test of a real authenticated route, no automatic rollback.

### F-27 (P3) `frontend/Dockerfile` is a single-stage `node:20-alpine` that ships dev deps
No multi-stage build, no `next build --output standalone`, runs as root, no `NODE_ENV`
pinning before install, `npm ci || npm install` masks lockfile drift permanently. Image is
far larger than needed and contains the full source + node_modules.

### F-28 (P3) `backend/Dockerfile` runs as root, installs `build-essential` into the runtime image
No multi-stage, no non-root user, no pinned base digest.

### F-29 (P3) Nginx: no TLS server block anywhere in the repo
`nginx/nginx.conf` has `listen 80` only; `docker-compose.prod.yml` maps `8080:80`. TLS is
presumably terminated by a host nginx (`host_nginx_aschool.conf`) — that file is 1.1 KB and
also has no certificate directives visible in the tree. Rate-limit zones exist
(60r/m api, 10r/m auth) but there is no `limit_req` on `/uploads/`, and `/uploads/` is
proxied with `expires 7d` and **no authentication** — confirmed by the prior audit as a
platform-wide open decision.

### F-30 (P3) Vendored competitor source (1.1 GB) sits in the working tree
`eSchool SaaS v1.8.0 Nulled/` (806 MB, 28.5k PHP files) and `Mighty School Pro v1.6/`
(337 MB). Both are gitignored, so not in history, but they are "Nulled" (pirated)
commercial products. Keeping them on a dev machine that also builds the product is a
legal and supply-chain hazard. They *are* useful as a feature checklist — extract the
module list to a doc and delete the code.

## Feature checklist harvested from the two vendored ERPs

These are features those products ship that ASchool should be measured against.

**eSchool SaaS (Laravel, 74 controllers, ~100 models):**
`AssignElectiveSubject`, `ClassGroup`, `Medium` (medium of instruction), `Semester`,
`SessionYear` + `SessionYearsTracking`, `Shift`, `Stream`, `FormFields` (custom fields!),
`CompulsoryFee` vs `OptionalFee`, `FeesInstallment`, `FeesAdvance`, `Guidance` (counselling),
`LeaveMaster` + `LeaveDetail`, `Lesson` + `LessonTopic`, `OnlineExam` with
`QuestionChoice`/`QuestionOption`/`StudentAnswer`, `PromoteStudent`, `CertificateTemplate`,
`DatabaseBackup`, `SystemUpdate`, `WizardSettings`, `Addon` + `AddonSubscription`,
`Package` + `PackageFeature`, `TransportationFee` + `TransportationExpense` +
`TransportationRequest`, `ExtraStudentData` / `ExtraSchoolData`.

**Mighty School Pro (Laravel modules):**
`Accounting` (full double-entry: Ledgers, Groups, Categories, Funds, AccountReport),
`Payroll` (SalaryHead, PayrollReport), `QuestionBank` (a dedicated module — ASchool has none),
`LayoutCert` (certificate layouts), `Elearning` (Chapter-based), `Frontend` (CMS),
`Gateways` (18 payment gateways incl. Paystack, RazorPay, SslCommerz, Flutterwave, Paymob,
Paytabs, bKash, PayPal, LiqPay, MercadoPago, Paytm, SenangPay, Pvit), `Hostel` with
`Meal`/`MealPlan`/`MealEntry`/`HostelBill`, `ParentModule`, `SystemConfiguration` with
`UserLogs`.

**Concrete gaps this implies for ASchool** (to be confirmed by the model-audit agent):
1. No `QuestionBank` module — there is no reusable item bank, so every AI-generated paper is
   throwaway. This is the highest-leverage missing thing for the question-paper feature.
2. No double-entry accounting / ledger / chart of accounts / fund accounting. `fees.py` is
   2,838 lines of collection logic with no general ledger behind it.
3. No `Medium` (medium of instruction), `Shift`, `Semester`, `Stream`, `ClassGroup`,
   `ElectiveSubjectGroup` — all needed for grades 11–12 and for English/Nepali-medium schools.
4. No `FormFields` equivalent — schools cannot add custom student/staff fields without a
   code change.
5. No `FeesInstallment` / `FeesAdvance` / `CompulsoryFee` vs `OptionalFee` distinction.
6. No hostel mess/meal billing.
7. No transport fee auto-billing (already logged as absent in the prior audit).
8. No certificate *template* model driven by the designer (templates are files on disk).
9. Only 3 payment gateways + Stripe; no ConnectIPS, no IME Pay, no bank transfer
   reconciliation.

## Things that are genuinely well built (do not rewrite)

- `plugin_required` alias expansion is deliberately **single-hop and non-transitive**
  (`app/plugins/decorators.py:_acceptable_plugin_slugs`) with the reasoning written down.
  That is a real security fix, correctly implemented.
- The trial-expiry defense-in-depth at cache-fill time (`app/__init__.py:371-384`) is a
  good belt-and-braces pattern even though the TTL weakens it.
- `nepal_grading.calculate_gpa` handles `credit_hours=None` vs `0` distinctly and documents
  why — that is careful work.
- JWT blocklist with a per-user `tokens_invalid_before` cutoff (`app/__init__.py:60-95`)
  is the right design for "log out everywhere".
- `frontend/lib/api.ts` single-flight refresh with an explicit "not in auth area" bypass
  is correct and well-commented; the failure modes it guards against are real ones.
- `middleware.ts` treating refresh-cookie presence as "maybe authenticated" for *routing
  only*, with the comment explaining that every API route still verifies server-side.
- `Dockerfile` installs Devanagari fonts system-wide and runs `fc-cache` so Pango can
  shape Nepali in WeasyPrint. Most teams get this wrong.
- `JSON_ENSURE_ASCII = False` so Nepali comes back as UTF-8, not `\uXXXX`.
- `CELERY_TIMEZONE = "Asia/Kathmandu"` is set (UTC+5:45 is a classic trap).
- The audit trail in `audits/` is unusually disciplined — numbered findings (E1–E230,
  G1–G2, M1–M12) with runtime evidence and honest "not verified" markers.
