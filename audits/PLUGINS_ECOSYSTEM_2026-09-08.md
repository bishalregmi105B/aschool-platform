# FULL PLUGIN ECOSYSTEM AUDIT — 2026-09-08
**Scope:** every plugin (41 modules + 1 orphan), the engine that loads/gates/serves them, the web frontend that renders them, the mobile apps that should consume them, and the security posture of the whole surface. Method: 5 parallel deep-read agents over the actual code + main-agent implementation pass. Sources: engine audit, 41-module backend audit, frontend audit, security audit (all four completed this pass; Flutter audit pending — findings marked ⏳ when relevant).
**Companion:** `PLAN_2026-09-08.md` (R-wave done) — this doc extends the plan with waves P (plugin integration) and S (security).

---

## 1. The one-paragraph state of the ecosystem

The plugin system is **architecturally sound and unusually honest for its stage**: a filesystem catalog (41 modules, all schema-v2), WP-style per-school lifecycle with activate/uninstall hooks and a Redis-cached request gate, a server-side absolute widget gate (absent = not served, not CSS-hidden), a v2 config-schema dialect (18 types, roles, signed secret envelopes, migrations), and entitlement auto-provisioning. **Zero of 41 modules are stubs** — every module carries real business logic. But the ecosystem has two structural gaps that define all the work below: **(1) the surface is half-wired** — 13 of 18 widget slots are vocabulary without mounts, row-actions/filters/pagination are declared-but-unrendered, per-school widget config and `default_layout` are dead end-to-end, and only 4 of 43 modules ship widgets at all; **(2) the WordPress-parity ceiling** — plugins cannot ship pages, event listeners, migrations, mobile UI, website sections, or extend other plugins. Plus **9 security holes found this pass (1 new P0)**, all fixed the same day.

## 2. Backend modules — verdict table (41 + orphan)

Modules delegate to `app/api/v1/*.py` blueprints via manifest pointers (7 carry their own routes.py). Auth stacks complete everywhere; tenancy clean except the two findings below; **0 STUB**.

| Verdict | Modules |
|---|---|
| **SOLID** (18) | attendance (best-in-repo: widgets ref-impl, events live), exams (marks-lock, teacher scoping), fees (2,883 LOC, verify+403 pattern), ai_teacher, biometric (device-key realm), website_builder, white_label (real DNS), basic_website, basic_reports, academics, admission, assignments, notices, gamification, iemis_importer, incident_management, sms_notifications, multi_branch |
| **SOLID (thin)** (11) | alumni, elibrary, health_records, incidents, inventory, student_portfolio, visitor_management, compliance, conferences, timetable, dismissal |
| **PARTIAL** (7) | lms (role gap), wellbeing (mood enum unvalidated), gps_tracking (JWT-for-devices), nepal_curriculum (backend ahead of frontend), ai_adaptive_learning (orphan), design_studio (homework-help spend unscoped), file_management |

## 3. Security findings — ALL FIXED 2026-09-08 ✅

| ID | Sev | Was | Fix landed |
|---|---|---|---|
| S1 (was F1) | **P0** | `School.to_dict()` serialized `fee_config` → any student JWT read eSewa/Khalti signing secrets from `GET /schools/current` and could forge paid-fee callbacks | Config blobs stripped from default serializer; new admin-only `GET /schools/current/settings`; admin settings pages re-pointed; regression tests pass |
| S2 (F2) | P1 | `encrypt_secret` = itsdangerous **signing** (not encryption); `GET /plugins/installed` returned raw config; ai_teacher `webhook_secret` envelope not schema-declared → leaked | Envelope sweep in `redact_config` redacts ANY `__secret__` at any depth; config on `/plugins/installed` now admin-only + redacted; full Fernet migration → P-wave |
| S3 (F3) | P1 | `service_base_url` school-settable → read-SSRF (metadata endpoints) + response bodies echoed in errors | Link-local/metadata/.internal blocklist before every signed request; bodies dropped from 5xx errors |
| S4 (F4) | P1 | GA/Pixel ids interpolated raw into public-site inline scripts → stored XSS by school admin | Server allowlists (`G-…`, numeric pixel) on both write paths + render-time re-allowlist in `school/[slug]/layout.tsx` |
| S5 (F5/F7) | P2 | `/database-backup` jwt-only (platform ops data); `GET /plugins/<slug>/config` any-role | superadmin gate; config read admin-gated |
| S6 (F10) | P3 | `POST /auth/reset-password` unthrottled | `5/minute` limiter |
| S7 (F8) | P3 | eSewa signature plain-compare | `hmac.compare_digest` |
| S8 (F9) | P3 | website-builder SEO GET ungated | admin role gate |
| S9 (B2-class) | P1 | (from R-wave) live-JWT-with-missing-user rode resolved school | fail-closed gate with clean-session retry; verified `NoReferencedTableError`-adjacent poisoned-session case |

**Verified safe (no action):** plugin route gating complete (0 routes missing `plugin_required` among JWT routes; only by-design webhooks/device-realms), tenancy checks clean (14 `Exam.query.get` + fees patterns all verify school), uploads traversal-safe, Stripe/WhatsApp/biometric auth correct, S-11 colors sanitization solid.

## 4. Widget pipeline — the half-wired surface (frontend + engine)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| W1 | **High** | exams widget deep-links `/dashboard/exams/$.id` — **no `[id]` page exists** → every Upcoming-Exams row 404s. (All 129 manifest nav routes verified correct; this is the only broken link.) | `modules/exams/widgets.yaml:43` |
| W2 | High | attendance widget binds `student_name`; API returns only `student_id` → column renders "—" | `widgets.yaml:116` vs `attendance.py:681` |
| W3 | High | Leave-requests widget binds wrong keys (`applicant_name/from_date/to_date/days` vs `staff_name/start_date/end_date`) | `widgets.yaml:152` vs `attendance.py:700` |
| W4 | High | fees defaulters widget binds `guardian_phone`/`days_overdue`; API returns `parent_phone`/`overdue_since` | `widgets.yaml:142` vs `fees.py:1149` |
| W5 | High | `row_actions`/`bulk_actions` (attendance approve/reject, fees remind) never rendered — approval queue has backend, zero UI | renderers.tsx (whole) |
| W6 | High | widget `filters` + server `pagination` declared, never rendered/sent → server-paginated widgets show page 1 forever | `usePluginWidgets.ts:73` |
| W7 | High | slot `student_profile.tab` (3 widgets: attendance/fees/exams) has **no mount** on student profile page | `students/[id]/page.tsx` |
| W8 | Med | `plugin_page.header` never mounted; `plugin_page.main` consumed only by exams/marks → `attendance_register` unreachable | widgets.yaml attendance:100 |
| W9 | Med | teacher gets permanent error card: `today_attendance` allows teacher role but endpoint is school_admin-only | `widgets.yaml:25` vs `attendance.py:360` |
| W10 | Med | `format: bs_date` unimplemented in bindings; i18n keys (`title_i18n`/`label_ne` in forms) dead | bindings.ts:150, form-renderer.tsx:809 |
| W11 | Med | widget types `form`/`detail-drawer`/`settings-section` render null | PluginWidgetHost.tsx:135 |
| W12 | Med | charts: only single-series bar renders; line/pie/donut/heat degrade silently | renderers.tsx:382 |
| W13 | Med | per-school widget hide/reorder (`default_layout`, widget `config_schema`, `$config.*`) dead end-to-end — server ignores `SchoolPlugin.config`, client never passes `config` prop | plugins.py:1048, widgets.py:191, PluginWidgetHost.tsx:127 |
| W14 | Med | installing a plugin with `dashboard.actions` removes the core four quick-actions | dashboard/page.tsx:168 |
| W15 | Med | sidebar empty while `/plugins/sidebar` loads and **permanently on failure** (no retry, no core fallback) | plugins.tsx:108 |
| W16 | Low | 51 of 134 plugin-gated pages have no error state; shared `DataTable` adopted by 0 pages; MarksGrid clears silently post 0 | various |

## 5. Engine findings (25, top 12 shown)

| # | Sev | Finding | Status |
|---|---|---|---|
| E1 | **P1** | **Deactivate hook never invoked** — ai_teacher's `deactivate(db)` (stops live lessons) never ran | ✅ FIXED this pass (`plugins.py` deactivate route now calls `_run_plugin_hook`) |
| E2 | P1 | `register_plugin_events` has zero callers → `emit_for_school` never filters by installed plugin; manifest `events:` blocks parsed by nothing (contract is false) | P-wave |
| E3 | P1 | Per-school hook context dead: `ASCHOOL_ACTIVATING_SCHOOL_ID` set nowhere; hooks get no school → ai_teacher provisioning no-ops at install | P-wave (pass `school_id` to hooks) |
| E4 | P1 | `GET /plugins/widgets` never enforces `requires_permissions` (arg never passed) | P-wave |
| E5 | P2 | `POST /plugins/install` doesn't validate `billing_cycle` → Enum 500; trials mintable for free plugins | P-wave |
| E6 | P2 | Install-gate query omits `is_deleted` — soft-deleted active SchoolPlugin still grants routes; soft-deleted catalog plugin installable | P-wave (1-line ×2) |
| E7 | P2 | Blueprint mount catches only `ImportError` — a plugin SyntaxError crashes boot (contradicts fail-soft contract) | P-wave |
| E8 | P2 | Widget cache never reset on refresh-registry; `_plugins.clear()` mid-request race | P-wave |
| E9 | P2 | `public_site` surface + `public_routes` capability: validated, unwired (widgets endpoint is jwt-gated; no manifest uses it) | P-wave |
| E10 | P2 | No audit trail on plugin config writes (money-adjacent settings mutate untracked) | P-wave |
| E11 | P2 | `schema_for_role`/`resolve_config` called without `installed` → `requires_plugins` fields hidden in UI but valid on save | P-wave |
| E12 | P3 | subscribe-reactivate skips conflicts check; `log_usage` uses `date.today()`; `grant_plan_plugins` dead code; config-version migrations never persist; plugin_doctor drops YAML comments | P-wave |

## 6. Module-level findings (security/logic, top 10)

| # | Sev | Module | Finding | Status |
|---|---|---|---|---|
| M1 | P1 | ai_teacher | Webhook resolves lesson with **no school check against the key's school** (cross-tenant event injection) | F-wave (was A9 — still open) |
| M2 | P1 | whatsapp_bot | `send-bulk` sends to arbitrary numbers, no school-relationship check, nothing persisted | F-wave |
| M3 | P2 | hr_payroll | `update_payroll` accepts arbitrary `status` — draft→paid bypasses approval gate; paid→draft allowed | F-wave |
| M4 | P2 | fees | Partial-payment ledger lives in a `[partial_paid:N]` note-string — concurrent payments lose money; should SUM(FeeReceipt) | F-wave |
| M5 | P2 | attendance | `/mark` check-then-act without unique index → duplicate day rows | F-wave |
| M6 | P2 | conferences | `book_slot` TOCTOU — two parents can book one slot | F-wave |
| M7 | P2 | design_studio | homework-help: student-facing, no quota/consent pipeline (A15) | carried (Q5) |
| M8 | P2 | dismissal | Pickup QR unsigned/predictable | F-wave |
| M9 | P2 | gps_tracking | ESP32 devices auth with user JWTs (no device realm) | F-wave |
| M10 | P3 | exams | GPA averaged unweighted in fallback path; teacher marks silently dropped when class_id missing | F-wave |
| — | P3 | 20 of 48 manifest `events.emits` claims never emitted (marketplace advertises integrations that don't fire) | F-wave |
| — | P3 | wellbeing mood unvalidated; nepal_curriculum has no authoring UI (backend 663 LOC state machine, frontend only lesson-start) | F-wave |

## 7. Frontend capability ceiling — "what a plugin cannot put on screen"

1. A new **route/page** (pages are hand-authored host files; no dynamic plugin-page route) — install-time page shipping impossible.
2. UI on a page it doesn't own beyond 4 dashboard slots (13 declared slots unmounted).
3. Interactive row actions, filter bars, server pagination in a widget (declared, unrendered).
4. Forms/drawers/settings-sections as widgets (types render null).
5. A website-builder section (registry closed; `website-section` type unrendered).
6. A mobile screen (mobile slots/surfaces have no consumer anywhere; `surface` hardcoded "web").
7. Per-school widget layout/config (dead end-to-end, W13).
8. Executable code — only 1 compile-time component token exists (`exams/MarksGrid`).
9. Rich charts (single-series bar only).
10. Nepali widget chrome (only table columns translate).

**Genuinely good:** server-absolute widget gating, FormRenderer (18 typed controls incl. secrets/cron/BS-dates), all 9 config-schema plugins have working settings UIs, marketplace install→nav→page flow is sound, theme parity lock holds, MarksGridWidget is the strongest component (Enter/arrow nav, TSV paste, dirty-guard).

## 8. Mobile — ⏳ audit in flight (findings will append here)

Known from prior verification: manifest `mobile:` keys consumed by nothing; `mobile.py` hardcoded; 5 flutter apps' plugin-awareness unverified this pass.

---

## 9. Implementation ledger — landed 2026-09-08

| Fix | Files |
|---|---|
| S1 fee_config strip + `/schools/current/settings` | `models/school.py`, `api/v1/schools.py`, 3 frontend settings pages |
| S2 envelope sweep + config gates | `plugins/config_schema.py`, `api/v1/plugins.py` |
| S3 SSRF guard | `modules/ai_teacher/service_client.py` |
| S4 GA/pixel allowlists ×2 layers | `utils/tracking_ids.py` (new), `api/v1/website.py`, `api/v1/website_builder.py`, `frontend/app/school/[slug]/layout.tsx` |
| S5–S8 gates/limiter/compare | `db_backup_api.py`, `auth.py`, `esewa_gateway.py`, `website_builder.py` |
| E1 deactivate hook | `api/v1/plugins.py` |
| rag NULL-bind root cause (session poisoning) | `services/ai/rag.py` (ingest + search) |
| Tests | `tests/test_sec_wave_fixes.py` (7) — **15/15 wave tests green**; tsc clean; plugin_doctor 0/0 |
