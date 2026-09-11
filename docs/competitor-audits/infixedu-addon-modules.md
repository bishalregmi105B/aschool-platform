# Competitor Audit — InfixEdu Add-On Modules (4 packages)

Audited: 2026-09-12. Source: `/home/bishal-regmi/Desktop/ASchool/Other Projects/InfixEdu School Modules/InfixEdu School Modules/` (inner module zips extracted to `/tmp/audit/` for reading; originals are `jitsi-meet-infixedu-module-1.4_extracted`, `razorpay-payment-gateway-for-infixedu-2.0_extracted`, `infixedu-zoom-live-class-module-2.0_extracted`, `parent-student-registration-for-infixedu-1.0.0_extracted`).

All four are nwidart/laravel-modules packages sold on the InfixEdu marketplace. Each ships `module.json` (service providers) plus a `{Module}.json` install manifest (marketplace `item_id`, explicit migration-file map, owned table `names`, `versions`, support `url`, `notes`). Compare against ASchool's manifest.yaml plugin system (`/home/bishal-regmi/Desktop/ASchool/backend/app/plugins/`).

---

## 1. Per-module findings

### 1.1 Jitsi Meet module v1.4 (marketplace item_id 32973934)

Files: `/tmp/audit/jitsi/Jitsi/` (from `Jitsi_Meet_Package_InfixEdu/Jitsi_module_infixedu/Jitsi_v1.4.zip`).

**What it does.** Two live-class concepts: standalone *meetings* (invite participants by role) and *virtual classes* (scoped to host class+section, up to 2 co-teachers), plus class/meeting reports and a one-field settings page. Rooms are opened inline via `JitsiMeetExternalAPI` (`Resources/views/meeting/start.blade.php` loads `{{setting->jitsi_server}}external_api.js`).

**Host integration (hook points).**
- `Providers/JitsiServiceProvider.php`: standard registerConfig/views/translations + `loadMigrationsFrom`. Routes via `Providers/RouteServiceProvider.php` (web + api groups).
- `Database/Migrations/2021_03_29_070403_create_jitsi_settings_table.php` is really an *installer*: creates `jitsi_settings`, then (a) rewrites routes in host `InfixModuleStudentParentInfo` rows, (b) bulk-inserts `InfixPermissionAssign` rows per role (admin 5, teacher 4, receptionist 7, librarian 8, driver 9, accountant 6, student 2, parent 3) using hard-coded host permission IDs `[816..832]`, (c) inserts ~30 `SmLanguagePhrase` rows (en/es/bn/fr incl. Bengali), (d) creates `Sidebar` rows, (e) branches on `moduleStatusCheck('SaasRolePermission')`.
- `documentation.txt` documents **manual** host edits: paste `@include('jitsi::menu.jitsi_sidebar')` guarded by `moduleStatusCheck('Jitsi')` into host `sidebar`/`parent_sidebar`/`student_sidebar` blades, run the module-info SQL inserts by hand, and create `public/uploads/jitsi-meeting`.
- Uninstall = drop the five tables listed in `Jitsi.json` (`jitsi_settings`, `jitsi_meetings`, `jitsi_virtual_classes`, `jitsi_virtual_class_teachers`, `jitsi_meeting_users`); the sidebar/permission/language rows are never cleaned up.

**Room naming / auth / recording.**
- Room id = `date('ymdhmi')` for meetings and `date('ymd' . rand(0,100))` for classes (`Http/Controllers/JitsiMeetingController.php` `store()`, `JitsiVirtualClassController.php` `store()`). Numeric, guessable, collision-prone (rand 0–100!), no school prefix.
- **No JWT anywhere.** Rooms are open; `userInfo` (email, displayName, avatar) is injected from Blade on the client and trivially spoofable. Moderator = whoever joins first (Jitsi default), not role-based.
- **No recording handling at all.** Status gating is a time window: `started`/`waiting`/`closed` derived from `start_time` minus `time_start_before` minutes.
- Notifications: direct inserts into host `SmNotification` for participants *and their parents* on create/update (`setNotificaiton()`).

**Settings surface.** One field only: `jitsi_server` (default `https://meet.jit.si/`, lowercased on save) — so self-hosted Jitsi is supported by URL swap, but there is no app-id/secret, no room-prefix per school, no per-tenant isolation. The settings controller (`JitsiSettingController.php`) is 42 lines; `updateOrCreate(id=1)` makes the row global.

**Routes** (`Routes/web.php`): `jitsi/meetings` CRUD, `jitsi/virtual-class` CRUD, `virtual-class/child/{id}` (parent view), `meeting-room/{id}` / `virtual-class-room/{id}` join routes, `user-list-user-type-wise` (AJAX participant picker), `virtual-class-reports`, `meeting-reports`, `settings`. API routes cover the same set for the mobile app.

**Quality.** Functional but sloppy: near-duplicate meeting/class controllers, missing `DB::beginTransaction` (commit without begin), unbracketed `orWhere` scoping bugs (teachers can see all meetings), typo-ridden notifications ("Jtis virtual class room details udpated"), empty catch blocks in `JitsiReportController`.

### 1.2 Zoom Live Class module v2.0 (item_id 27623128)

Files: `/home/bishal-regmi/Desktop/ASchool/Other Projects/InfixEdu School Modules/InfixEdu School Modules/infixedu-zoom-live-class-module-2.0_extracted/Zoom/`.

**What it does.** Same meetings + virtual classes duality as Jitsi but backed by real Zoom meetings via the `macsidigital/laravel-zoom` SDK (`MacsiDigital\Zoom` facade; `Config/config.php`: `baseUrl https://api.zoom.us/v2/`, `authentication_method: jwt`, `token_life` 1 week). Adds per-user Zoom credentials, recurring meetings, and a manual recording-upload flow.

**Integration details worth noting.**
- `zoom_settings` table (migration `2020_06_16_051034_create_zoom_settings_table.php`) stores defaults: `host_video`, `participant_video`, `join_before_host`, `audio`, `auto_recording (local|cloud|none)`, `approval_type`, `mute_upon_entry`, `waiting_room`, `api_use_for`, `api_key`, `secret_key`. The migration **seeds a hard-coded API key/secret** (`GsF_U_fzQyuqQ7bMDWBL9A` / `l0B0jsyfAXSTAVkYIBF3Jg0DLhZG247ybhOG`) into every install.
- `Http/Controllers/SettingController.php`: admin settings save keys both to `zoom_settings` **and** to the host `.env` (`ZOOM_CLIENT_KEY`/`ZOOM_CLIENT_SECRET`) via `putEnvConfigration()` (`file_put_contents` + `str_replace`) followed by `Artisan::call('config:clear')`. Per-teacher credentials: `2021_06_30_044055_zoom_update.php` alters the **host** `users` table with `zoom_api_key_of_user` / `zoom_api_serect_of_user` (typo in schema), and also injects a `zoom_order` column into host `sm_weekends`; the `ind/settings` route lets each teacher connect a personal Zoom account (`api_use_for` flag chooses system vs personal).
- License gate: every controller action calls `User::checkPermission('Zoom') != 100` → redirect to host `Moduleverify` route; `about()` reads host `InfixModuleManager`.
- API surface mirrors the web one for the mobile app (`Routes/api.php`, `auth:api` + `XSS` + `json.response` middleware).

**Meeting creation UX (the good parts).** `Http/Controllers/ZoomApiController.php::zoomStoreMeeting()`:
- Validates the full Zoom options payload; maps `is_recurring` → Zoom meeting `type 8` with `recurrence()` (type, repeat_interval, end_date_time).
- **Conflict detection**: `isTimeAvailableForMeeting()` rejects a slot if any participant already has a meeting overlapping on that date.
- **API-quota guard**: refuses the 101st meeting created that day (`ZoomMeeting::whereDate('created_at', now())->count() >= 100`).
- Pulls the first active Zoom user as host (`Zoom::user()->...->get()['data'][0]`) — single-host limitation; creates the meeting remotely, then locally stores `meeting_id`, `password`, `start_time`, `end_time`, attaches participants, and bulk-inserts notification rows.
- Join: redirect to `https://zoom.us/wc/{meeting_id}/start` (creator/admin) or `/join`; `currentStatus` accessor implements the same started/waiting/closed window with `time_before_start` (default 10 min).

**Recording handling.** No webhooks, no cloud-recording sync. Post-class, a teacher can attach a recording manually: `VirtualClassController::updateVedio()` accepts an uploaded file **or** an external link (`vedio_link`, i.e., YouTube), stored under `public/uploads/zoom-meeting/` (`Resources/views/recorder_file_upload.blade.php`). So "cloud recording" setting exists only as a Zoom-side flag; nothing is ever downloaded.

**Routes** (`Routes/web.php`, all under `middleware('subscriptionAccessUrl')` and `userRolePermission:{id}`):
- Meetings: `zoom/meetings` CRUD (`userRolePermission:560/556/562/563`), `meetings/parent` variant (`:103`).
- Virtual classes: `zoom/virtual-class` CRUD (`:555/561`), parent child view (`:101`).
- Reports: `virtual-class-reports` (`:565`), `meeting-reports` (`:567`); settings `:569`.
- Recording upload: `POST upload_document` → `VirtualClassController@updateVedio`; upload pages `virtual-upload-vedio-file/{id}`, `meeting-upload-vedio-file/{id}`.
- API mirror for the mobile app (`Routes/api.php`, `auth:api` + `XSS` + `json.response`): `zoom-make-meeting/user_id/{id}`, `zoom-store-meeting`, `zoom-update-meeting`, `zoom-delete-meeting/meeting_id/{meeting_id}/user_id/{user_id}`, `zoom-class-room/...` — same flows as web, separately maintained.

**Quality.** Most complete of the four, but ~1,000 lines duplicated between `ZoomApiController`, `MeetingController`, `VirtualClassController`; the host-account picker always uses user[0]; scoping bugs (`orWhere('created_by', ...)` unbracketed in teacher queries); `meetingStart()` has broken guard logic (`if (!$meeting->currentStatus == 'started')` — always true-ish, so the "closed" branch is unreachable); SQL to views shows `$results['join_url']` from API responses.

### 1.3 RazorPay Payment Gateway module v2.0 (item_id 27721206)

Files: `/tmp/audit/razorpay/RazorPay/` (from `RazorPay_InfixEdu_Package/03_RazorPay_Module_v2.0/RazorPay.zip`), docs in `razorpay-payment-gateway-for-infixedu-2.0_extracted/RazorPay_InfixEdu_Package/01_help/`.

**What it does.** Adds RazorPay as a fee-payment method for students/parents (SaaS and non-SaaS), using the official `razorpay/api` PHP SDK (vendor bundled in the zip).

**Integration.** The migration `Database/Migrations/2020_07_05_125524_create_razor_pays_table.php` is the installer: when Saas is enabled it loops `SmSchool::all()` and registers `SmPaymentMethhod(method='RazorPay', type='Module')` plus a `SmPaymentGatewaySetting(gateway_name='RazorPay', gateway_username='demo@gmail.com', gateway_password='123456')` **per school**, seeding demo credentials. Keys are then expected in host settings UI (help screenshots `UpdateRazorPay.png`, `RazorPay Enable.png`) and two `.env` vars (`RAZORPAY_KEY`, `RAZORPAY_SECRET`) per `01_help/RazorPay Secreet Key.txt`. License gate identical to Zoom (`User::checkPermission('RazorPay')` → `Moduleverify`).

**Routes** (`Routes/web.php`, no extra middleware beyond the controller's `auth`+`PM`): `razorpay/` (marketing), `about`, `pay` (the demo blade), `POST dopayment`, `POST get-order-id`. `Routes/api.php` is an empty stub — **no mobile-app flow exists**, meaning student/parent app payments for RazorPay were never built (fee-panel checkout is host web code). Help folder confirms manual steps: `Online Doc Link.txt` points to the vendor helpdesk; `RazorPay Secreet Key.txt` instructs adding `RAZORPAY_KEY`/`RAZORPAY_SECRET` to `.env`.

**Security findings (all verified in `Http/Controllers/RazorPayController.php`).**
- `getOrderId()` creates a Razorpay order server-side using per-school `gateway_publisher_key`/`gateway_secret_key` — then returns `response()->json($order + ['user'=>..., 'secretKey'=>$razorPayDetails, 'role'=>...])`: **the secret key is sent to the browser**.
- `dopayment()` records an `SmFeesPayment` (mode `RP`) and decrements `SmFeesAssign->fees_amount` based entirely on client-submitted `amount`, with **no `verifyPaymentSignature`** — payments are trusted client-side.
- `dopayment()` ends with `print_r($input); exit;` — debug code shipped in the payment path.
- `Resources/views/abc.blade.php` is a leftover Razorpay demo page: Amazon affiliate link, hardcoded "Price: 2,475 INR", a TVS-keyboard image, and `key: "{{ env('RAZORPAY_KEY') }}"` rendered client-side.
- The real fee-panel checkout lives in host files (host template edits), which is why the help folder ships phpMyAdmin screenshots (`Database phpMyadmin Screnshot/delete selected table form database.png`) for manual uninstall surgery.

**Quality.** Worst of the four. The module-specific endpoints are unsafe; only `getOrderId` follows the correct order-based flow, and even that leaks credentials.

### 1.4 Parent-Student Registration module v1.0.0

Files: `/tmp/audit/parentreg/ParentRegistration/` (from `ParentRegistration.zip`), plus `Update Files in infix Edu v.4.5/sql/imported.sql` (a full phpMyAdmin dump of host `infix_module_infos` for "upgrading" to InfixEdu v4.5 — upgrades are manual DB imports).

**What it does.** Public, no-auth registration form → staging table → admin review/approve → full account provisioning.

**Flow.**
- Public form `Routes/web.php::/parentregistration/registration` → `Http/Controllers/ParentRegistrationController.php::studentStore()`. Fields: first/last name, class+section (chained AJAX `get-section`/`getClasses`/`get-class-academicyear`, SaaS school picker), DOB+age, gender (host `SmBaseSetup`), student email+mobile, guardian name+relation (`F|M|O`)+email+mobile, and a `how_do_know_us` marketing-source field.
- Optional Google reCAPTCHA (`g-recaptcha-response => required|captcha`) toggled in settings.
- Stored in `sm_student_registrations` (migration `2020_04_27_061914_...`) — no accounts created yet.
- Duplicate pre-checks: `check-student-email|mobile`, `check-guardian-email|mobile` compare against `User` + staging table (return `1/0`; enumerable, unthrottled).
- Acknowledgment email (`new_reg_email`) to student+guardian if `registration_after_mail` enabled.
- Admin reviews `studentList` / `saasStudentList` (institution filter), views a record, then `studentApprove()` in one DB transaction: creates student `User` (role 2, `username = admission_no` = max+1 school-wide, `password = Hash::make(123456)`), parent `User` (role 3, `username = guardian email`, same `123456`), `SmParent`, `SmStudent` (`admission_date = today`, `roll_no` = per class-section max+1), deletes the staging row, and emails credentials (`approve_email`) if `approve_after_mail` enabled.

**Settings** (`sm_registration_settings`, migration `2020_04_27_061915_...`): `registration_permission` on/off, `position` (1=header / 2=footer / 0=hide — controls where the registration widget renders on the login page), both mail toggles, reCAPTCHA keys. `Updatesettings()` dual-writes reCAPTCHA keys into `.env` (`NOCAPTCHA_SITEKEY`/`NOCAPTCHA_SECRET`) via the same `.env` str_replace pattern. Settings are global (`SmRegistrationSetting::find(1)`) despite per-school columns.

**No payment at registration**, no document upload, no email/SMS verification of the applicant. The constructor contains disabled phone-home telemetry (commented-out Guzzle POST of `User`/`SmGeneralSettings`/`SmUserLog` JSON to the vendor API) — worth knowing who you buy from.

**Routes** (`Routes/web.php`): public `GET /parentregistration` (marketing page), `GET /registration` (form), `POST /student-store`; admin `GET/POST /student-list` + `/saas-student-list` (search), `POST student-approve`, `POST student-delete`, `GET student-view/{id}`; the four `check-*` uniqueness endpoints; `GET/POST settings`. Note the admin routes sit in the same unauthenticated group — only the constructor's `auth` + `PM` middleware separates admin actions from public ones, and `studentApprove` reads `id` straight from a POST body.

**Data model** (`Database/Migrations/2020_04_27_061914_create_sm_student_registrations_table.php`): staging row keeps `first_name/last_name`, `class_id`/`section_id` (FK into host `sm_classes`/`sm_sections` with `onDelete cascade`), `date_of_birth` + string `age`, `gender_id` (FK `sm_base_setups`), student email/mobile, guardian name/mobile/email/relation (`F|M|O` comment), `how_do_know_us`, plus `school_id`/`academic_id` for SaaS. `sm_registration_settings` adds `position`, `registration_permission`, `registration_after_mail`, `approve_after_mail`, `recaptcha` + `nocaptcha_sitekey/secret`, seeded with reCAPTCHA off.

**Quality.** The most product-sensible module of the four; the approve→provision pipeline is genuinely useful. Weak spots: fixed `123456` passwords, no verification challenge, enumerable uniqueness endpoints, single global settings row (`find(1)` ignores its own per-school columns), `guardian_email 'different:student_email'` is the only cross-field sanity check, and approval emails ship credentials even when mail sending fails silently (the catch block still toasts success).

---

## 2. Add-on engineering lessons vs ASchool's manifest.yaml system

| Concern | InfixEdu modules | ASchool (`backend/app/plugins/`) |
|---|---|---|
| Packaging | Self-contained folder: routes, controllers, migrations, views, config per module (`Modules/{Name}/`) | Manifest + central code (`modules/{slug}/manifest.yaml`, code in `app/api/v1/`, `app/models/`, `app/services/`) |
| Install | `{Module}.json` migration-file map + host file edits + sometimes manual SQL (`parent-registration .../Update Files/sql/imported.sql`) | `POST /plugins/install` → `install_plugin()` + WP-style `activate` hook (`app/api/v1/plugins.py::install`, `_run_plugin_hook`) |
| Uninstall | Drop tables listed in `{Module}.json` `names`; sidebar/permission/language rows leak forever | `uninstall` hook removes only config rows, keeps data tables (documented in `plugins.py::uninstall`) |
| Upgrade | Version bumps in `{Module}.json` + manual SQL dumps | `schema_version` 1→2 normalization in `loader.py::_normalize_manifest`; `/plugins/<slug>/migrate-config` runner |
| Settings | Ad-hoc table + hand-built Blade page; secrets re-rendered, `.env` writes | Declarative `config_schema.yaml` (18 types, `visible_when`, redaction, migrations) in `config_schema.py` |
| Licensing | `item_id` + per-controller `User::checkPermission($module)` gate + `Moduleverify` route | Entitlement at request layer (`@plugin_required` decorator, `entitlements.py`, `billing.py` trials/subscribe) |
| Dependencies | `requires: []` always empty; migrations reach into host tables (`users`, `sm_weekends`) | `depends_on`/`conflicts_with` enforced in install (`install()` returns 409 on dependency/conflict) |
| Events | None; direct `SmNotification` inserts | `events.py` pub/sub with per-school gating; manifests declare `emits/listens` |

Lessons, concretely:

1. **The `{Module}.json` migration map is a genuinely good idea** — an explicit, machine-readable list of migrations the installer must run and tables the uninstaller may drop. ASchool's manifests have `owns_tables` (v2) but no explicit ordered migration list; adopt the idea under a `migrations:` key if we ever support data-bearing third-party add-ons.
2. **Self-containment is what makes something sellable as an "add-on"** — InfixEdu modules can be zipped, bought, and dropped in. ASchool "plugins" are compile-time modules of one app; that's fine for first-party (50 plugins) but blocks any third-party marketplace. See §5.
3. **Licensing gates must live in one place.** InfixEdu repeats `User::checkPermission(...)` in every action and still leaks (RazorPay endpoints aren't uniformly gated). ASchool's decorator approach is correct — keep secrets/config out of controllers entirely.
4. **Migrations must never mutate host tables or seed demo credentials.** InfixEdu adds columns to `users`/`sm_weekends`, seeds Zoom keys and `demo@gmail.com/123456` payment rows. Our equivalent rule: plugins own only `owns_tables` + config rows.
5. **Uninstall must be reversible.** InfixEdu leaves permission/language/sidebar rows orphaned; RazorPay's documented uninstall is phpMyAdmin. Our config-row-only uninstall is better but should be explicit about retention (see §5).
6. **Shipping quality is part of the product**: RazorPay's `abc.blade.php` demo page and `print_r($input); exit;` in the payment path shipped to paying customers. Review gates for add-ons matter.

---

## 3. Specific features worth stealing

**From Zoom module (highest value):**
- **Per-user gateway credentials**: teacher-owned Zoom accounts (`zoom_api_key_of_user`, `api_use_for` flag) — maps to per-school (or per-teacher) eSewa/Khalti merchant credentials, which we already do (`fee_config`-supplied, see `app/services/payments/esewa_gateway.py` header comment). The steal is the *flag* letting a school say "use system account vs personal".
- **Scheduling conflict detection**: `isTimeAvailableForMeeting()` refuses slots overlapping a participant's existing meeting (`ZoomApiController.php` lines ~85–118). Our `VideoService.create_live_class()` (`backend/app/services/lms/video_service.py:14-44`) does no overlap check — wire it to timetable.
- **Recurring meeting support** (type, interval, end date) for weekly class schedules.
- **API-quota guard** (100 meetings/24h) — we should have a per-school quota guard on live-class creation.
- **Manual recording attach**: end-of-class "upload video or paste link" attached to the meeting record (`VirtualClassController::updateVedio`). Our `Lesson.video_url` exists but is disconnected from `LiveClass`; adding a "attach recording" action after `end_class()` closes the loop for our "Recordings" tabs (lms manifest `mobile.teacher.tabs`).

**From Jitsi module:**
- **Early-join window + derived status** (`time_start_before`, started/waiting/closed): students can join N minutes before; status needs no explicit `start_class` call. We require manual `start_class()`/`end_class()` today.
- **Parent notification fan-out** on class create/update (participants + their parents, with "updated by X with you" wording).
- **Granular per-action permissions** (add/edit/delete/**start class**/search as separate permission rows) — a teacher's ability to *start* a class being its own permission is a nice touch.
- Counter-lesson: their open rooms + client-injected identity show exactly what *not* to do; we should leapfrog with **Jitsi JWT tokens** (moderator claim for teacher) — see §4.

**From Parent-Student Registration module:**
- **Staging table → approve → provision pipeline**: `sm_student_registrations` + `studentApprove()` transaction creating User+Parent+Student with auto `admission_no` (max+1) and per-section `roll_no`, then credential email. Our public admission inquiry (`app/api/v1/website.py:537-575`) stops at a 4-field inquiry row with no conversion to an application/account.
- **Form enable/disable + placement** (`position`: header/footer of login page, 0=hide) as a settings switch — an in-marketplace-config-friendly pattern.
- **Duplicate pre-check endpoints** (email/mobile already known?) with inline AJAX feedback on the form.
- **`how_do_know_us` source field** feeding admission funnel analytics (our admission manifest already emits `admission.lead_created`; we lack the source field on the public form).
- **reCAPTCHA toggle with key management in the module's own settings** — our public form has rate limiting (`@limiter.limit("5/hour;20/day")`, `website.py:538`) which is better enforcement, but no bot-challenge option.

---

## 4. What ASchool lacks vs these modules (with evidence)

1. **No Jitsi authentication or moderation.** `video_service.py` only computes `room_id = f"aschool-{school_id[:8]}-{uuid.uuid4().hex[:8]}"` and a `join_url`; `app/api/v1/lms.py:251` returns `jitsi_room_id`. There is no JWT signing, no moderator/vs-attendee distinction, no identity binding. InfixEdu is equally open (§1.1) — but room naming is the only thing they get right that we do too; everything else they lose on, and we can win on with a `POST /lms/live-classes/<id>/token` endpoint issuing Jitsi JWTs (moderator for teacher, attendee for students, room-scoped, expiring).
2. **No scheduling-conflict detection for live classes.** `create_live_class()` accepts any `scheduled_at`. InfixEdu checks participant overlap across existing meetings (§3).
3. **No early-join window or derived status.** Our status moves only via explicit `start_class`/`end_class` calls; no "students may join 10 minutes early" concept.
4. **No recording round-trip.** `end_class()` sets `status="completed"` and that's it — no upload/link attach, no Zoom cloud-recording webhook sync (InfixEdu doesn't have webhooks either; the Zoom module proves manual attach is the minimum, and this is a differentiator opportunity for us).
5. **No public self-registration → enrollment pipeline.** `auth.py /register` (line 419) registers *schools*; the only public admission surface is the 4-field inquiry (`website.py:537-575`: student_name, guardian_name, phone, class_applied). Missing vs InfixEdu: class/section/DOB/gender/guardian-relation fields, duplicate pre-checks, acknowledgment + approval emails, and the approve→account-provision step with auto admission numbers.
6. **No recurring live classes** (Zoom recurrence model) — weekly timetabled classes must be created one by one.
7. **No per-school live-class quota guard** (InfixEdu: 100/day API-protection limit).
8. **No zip-upload sideload in the marketplace.** `app/api/v1/plugins.py` has install/uninstall/activate/config-schema/migrate-config but nothing accepts an uploaded package; the catalog is strictly the on-disk `modules/` directory (`loader.py` docstring: "the plugins DIRECTORY is the catalog source of truth").
9. **Manifest-only modules carry no migration story.** `owns_tables` exists in v2 manifests, but there is no explicit per-plugin migration map analogous to `{Module}.json`, and the uninstall hook deliberately keeps data with no retention policy option.

---

## 5. How our marketplace could adopt the best bits

1. **Zip sideload (guarded).** Add `POST /plugins/registry/sideload` (admin-only) accepting a zip: validate `manifest.yaml` at archive root via the existing `validator.py`, require `owns_tables`, `schema_version: 2`, a sha256 + size cap, and (for third-party) an Ed25519 signature verified against a pinned publisher key. Extract to `modules/{slug}/` and reuse `PluginLoader` discovery unchanged. This adopts InfixEdu's "drop-in module" model without their host-file edits.
2. **Versioned add-on schema = our manifest v2 + a migration contract.** Add optional `migrations:` (ordered file list) and `data_retention: keep|purge` to the manifest; the `uninstall` hook then either keeps tables (current behavior, documented) or drops exactly `owns_tables`. This is InfixEdu's `{Module}.json` idea folded into YAML, with none of the host-table mutation.
3. **In-marketplace config is already 80% there.** We have `GET/PUT /plugins/<slug>/config`, `/config-schema`, `/migrate-config` (`app/api/v1/plugins.py:826-1042`) and an 18-type schema dialect with secret redaction (`config_schema.py`). Adopt InfixEdu's UX idea: a "Configure" CTA directly on the marketplace card after install (their Zoom/RazorPay settings pages are separate, and Zoom's re-renders `secret_key` in HTML — our redaction already beats this). Add a "test connection" action per plugin (RazorPay's order-creation flow shows why: config is useless until proven).
4. **Keep billing-based entitlement; add an offline key fallback.** InfixEdu's `item_id` + `Moduleverify` + repeated `checkPermission` shows what happens when licensing is scattered; ours is centralized. For self-hosted deployments, accept a signed license key that maps to entitled slugs — same decorator, different resolver.
5. **Marketplace listing metadata**: InfixEdu's `{Module}.json` carries `versions`, support `url`, and release `notes`. Our manifests have `description`/`price` but no changelog URL or screenshots; add `changelog_url`, `screenshots`, `publisher` to the marketplace payload (`_catalog_entries()` in `plugins.py`).
6. **Advertise the event system to add-on authors.** `events.py` per-school gated pub/sub + declared `emits/listens` is strictly better than InfixEdu's notification inserts — make it a documented extension contract (one reason to prefer our marketplace over InfixEdu's).
7. **Ship the live-class gap closers as lms plugin config, not new plugins**: conflict detection, early-join window, recording attach, Jitsi JWT — all fit `backend/app/services/lms/video_service.py` + the lms `config_schema.yaml` (which doesn't exist yet; only attendance/library/fees/hr_payroll/ai_teacher have one).

---

## 6. Cross-module security scorecard (what a vetting process would catch)

| Module | Critical | High | Notable |
|---|---|---|---|
| Jitsi 1.4 | Open rooms, no auth | Client-injected identity | Collision-prone room ids, orphaned install rows |
| Zoom 2.0 | Hard-coded API keys in migration | `.env` writes from HTTP requests; host-table mutation | Secret re-rendered in settings HTML; broken status guards |
| RazorPay 2.0 | Secret key returned to browser; unverified payment capture | Debug `print_r/exit` in prod path; demo page shipped | No mobile API; manual DB uninstall |
| ParentReg 1.0.0 | Fixed `123456` passwords at provisioning | Enumerable existence checks; no verification challenge | Commented-out vendor telemetry; global settings row |

Takeaway: none of the four would pass a basic marketplace review. The engineering bar for ASchool's marketplace should be (a) signed packages, (b) declarative settings with redaction, (c) no host-table writes, (d) verified payment callbacks — we already enforce (b) partially and (d) fully in first-party gateways (`app/services/payments/*`), so codifying it as published review criteria is cheap.

---

## Appendix: evidence index

- Jitsi room naming: `/tmp/audit/jitsi/Jitsi/Http/Controllers/JitsiMeetingController.php` (`'meeting_id' => date('ymdhmi')`), `JitsiVirtualClassController.php` (`date('ymd' . rand(0,100))`).
- Jitsi no-JWT embed: `/tmp/audit/jitsi/Jitsi/Resources/views/meeting/start.blade.php`.
- Jitsi installer-migration: `/tmp/audit/jitsi/Jitsi/Database/Migrations/2021_03_29_070403_create_jitsi_settings_table.php`; manual steps: `/tmp/audit/jitsi/Jitsi/documentation.txt`.
- Zoom settings/`.env`/per-user keys: `.../Zoom/Http/Controllers/SettingController.php`, `.../Zoom/Database/Migrations/2021_06_30_044055_zoom_update.php`, seeded keys in `2020_06_16_051034_create_zoom_settings_table.php`.
- Zoom conflict check + quota: `.../Zoom/Http/Controllers/ZoomApiController.php`.
- Zoom manual recording upload: `.../Zoom/Http/Controllers/VirtualClassController.php::updateVedio`, `.../Zoom/Resources/views/recorder_file_upload.blade.php`.
- RazorPay secret leak / unverified payment / debug print: `/tmp/audit/razorpay/RazorPay/Http/Controllers/RazorPayController.php`.
- RazorPay installer migration: `/tmp/audit/razorpay/RazorPay/Database/Migrations/2020_07_05_125524_create_razor_pays_table.php`; demo page: `/tmp/audit/razorpay/RazorPay/Resources/views/abc.blade.php`.
- Parent registration pipeline: `/tmp/audit/parentreg/ParentRegistration/Http/Controllers/ParentRegistrationController.php` (`studentStore`, `studentApprove`, `Updatesettings`); migrations `2020_04_27_061914/061915_*.php`; manual upgrade SQL: `.../parent-student-registration-for-infixedu-1.0.0_extracted/Update Files in infix Edu v.4.5/sql/imported.sql`.
- ASchool counterparts: `backend/app/services/lms/video_service.py`, `backend/app/api/v1/lms.py:251`, `backend/app/api/v1/plugins.py`, `backend/app/plugins/loader.py`, `backend/app/plugins/config_schema.py`, `backend/app/plugins/events.py`, `backend/app/services/payments/{esewa,khalti,fonepay}_gateway.py`, `backend/app/api/v1/website.py:537-575`, `backend/app/api/v1/auth.py:419`, `backend/app/plugins/modules/{lms,admission,conferences}/manifest.yaml`.
