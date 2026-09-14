# Wave I — Portals, Auth, Landing & Public Site (rewrite report)

Scope executed: `app/teacher/**`, `app/parent/**`, `app/student/**`, `app/(auth)/**`, `app/page.tsx`, `app/school/**`, `components/website/**` (+ new helpers in `components/portal/`, the established portal-helper folder — `lib/`, `components/ui/`, `components/aos/` untouched).
Process: every screen researched → 2-line notes written in the file header → rewritten in the A-archetype grammar → tsc filtered to scope after each batch. **Final tsc: 0 errors in all Wave-I paths** (one unrelated in-progress error exists in `app/dashboard/analytics/financial` — another wave's file).

## Research notes (per screen, before writing)

| Screen | Sources consulted this pass | The two lines that shaped the design |
|---|---|---|
| OTP login / verify | MDN `autocomplete` doc; NN/g passcode practice | The standard autofill token is `one-time-code` on a named input inside a form with a submit button — so the 6-box UI keeps a hidden autofill receiver and mirrors it. Auto-advance + paste + Backspace-to-prev; auto-submit only on the completed code. |
| Reset password | usable-password guidance (show rules early, real-time feedback) | Strength meter + criteria checklist visible BEFORE typing; match indicator on confirm; client gate mirrors backend policy (8+, upper+lower+digit). |
| Portal chrome (T/P/S) | NN/g hamburger-menu study; WCAG 2.5.8 | Hidden nav halves discoverability → desktop nav always visible at lg+, mobile drawer only for overflow, every row ≥44px, current section highlighted with aria-current. One shared `PortalChrome` for all three portals (was 3 drifted layouts, none with any mobile nav). |
| Parent portal | Part 44.2 + banking-app profile-switcher convention | The switcher must be the first control and every child page inherits its choice — implemented as a persisted pub/sub store; all child-scoped endpoints already accept `student_id` server-side (verified in `parent_app.py`), so nothing is cosmetic. |
| Student portal | task-first M1/A7 home grammar | Today's timetable with the current period highlighted is the focal point; the existing real-data home is kept and unified into the shared chrome. |
| School public site | audit §8.4 null-rendering bug | Missing metadata must render NOTHING — placeholders like "Contact Number" / "Established: –" are fabricated trust; fixed in the live SectionRenderer path (builder *preview* keeps its placeholder guidance on purpose). |
| Admission funnel (guest) | GOV.UK "check answers" pattern + NN/g long-form research | ≤7 required fields per step, review screen before commit, Back never loses answers; the review lists everything with section grouping. 3-step wizard via `ui/wizard`. |
| Landing honesty | Part 19.3 (honesty is the brand) | No verifiable public platform-stats endpoint exists anywhere in `app/api` (Next) or backend `meta.py` (only /time) → fabricated bands REMOVED rather than replaced: the 400+/50K+/10+/ISO stat row, the fake-client "Trusted by" strip, the invented hero dashboard numbers (96% / 2.8M / 148), ISO 27001 + IRD footer badges, "2 minutes / 24-hour guarantee" claims, and placeholder phone/WhatsApp numbers. |

## Auth (A9)

- **login** — kept the two-column form + product-truth pane (the pane's feature bullets are all real platform capabilities); removed "Trusted by 400+ Schools / ISO 27001" footer claim → factual capability line; OTP mode now uses the 6-box `OtpInput` (auto-advance, paste, `one-time-code` autofill receiver, auto-verify on complete); softened "2 minutes" register callout.
- **verify-otp** — rewritten: 6-box auto-advance input, honest guard when `phone` param is missing (Go to Register instead of a broken submit), resend countdown kept, success screen grammar matches reset.
- **reset-password** — added live strength meter + criteria checklist + confirm-match indicator + policy gate before submit; `autoComplete="new-password"`.
- **register** — already a genuine multi-step wizard; only the fabricated footer claim ("256-Bit SSL · Zero Data Loss Guarantee" → "Per-school data isolation · Secure cookie sessions" — both verifiable in the codebase) was changed.
- NOT done (flagged): the MFA/TOTP challenge screen (45.1) — backend `/auth/totp/verify` exists but wiring it needs the login-flow contract change other waves depend on; left for the auth-security wave.

## Teacher portal (7+ routes, all de-re-exported)

- **layout** → `PortalChrome` (responsive nav incl. mobile drawer, user chip, BS-date chip, sign-out — none of which existed).
- **home (A7-tailored)** — GET `/teacher/dashboard`: today's periods timeline is the FOCAL card with a live "Now" badge (client-clock compare), per-slot attendance Marked/Mark affordance, MetricCards (classes today / attendance pending / my assignments / my classes), My Classes list (GET `/teacher/my-classes`, marked-today chip), recent notices. (Was: KPI cards over `/analytics/teacher-dashboard` with no timeline.)
- **attendance** — scoped page replacing the admin-hub re-export: class picker from MY classes (?class_id= deeplinkable from home), BS date picker, roster via GET `/attendance/students/<class_id>` (already teacher-gated server-side), 44px status buttons (P/A/L/H/Leave), All-Present behind `useConfirm`, save → POST `/attendance/mark` (teacher-allowed; server restricts to assigned classes), sticky Save gated on full sheet.
- **marks** — scoped grid replacing the admin re-export: exam picker filtered to my classes (+ school-wide exams), subject picker from GET `/exams/<id>/subjects`, roster+existing-marks via GET `/exams/<id>/marks?class_id=&subject_id=`, theory/practical inputs honoring per-subject full/pass config, save → POST `/exams/<id>/marks` (teacher role verified), server errors (marks lock) surfaced verbatim, grades shown via Badge.
- **assignments** — GET/POST `/teacher/assignments` (teacher-scoped endpoints that existed and were unused by the web portal!): DataTable with progress bar (submitted/total), status chip, create Dialog (class→subject cascade via GET `/academics/subjects?class_id=`), submissions Dialog with per-student grade form → POST `/assignments/<id>/submissions/<id>/grade` (teacher role verified).
- **timetable** — GET `/teacher/timetable` (grouped by day) rendered as day cards, today column ringed + badge; replaces admin any-teacher viewer.
- **notices** — GET `/notices` feed (audience chips, author, BS dates, pin marker) + create/edit Dialog (POST/PUT `/notices` allow teacher — verified). No delete affordance rendered (DELETE is school_admin-only server-side — no fake buttons).
- **attendance/leave-requests** — repurposed honestly as **My Leave** (its old re-export showed the ADMIN student-leave approval queue to teachers): GET `/hr-payroll/leave?user_id=<me>` list with StatusTimeline (submitted→approved / decision) + Apply dialog POST `/hr-payroll/leave`. When the HR plugin is absent (404) → dependency empty-state, not a spinner trap.
- **ai-tools** — intentionally kept as the admin hub re-export (verified: it is the teacher tool workspace, not admin data); now reachable from the nav.
- **[slug]** — honest 404 kept.

## Parent portal (10 routes)

- **layout** → `PortalChrome`; the old nav was `hidden md:flex` with NO mobile alternative (phones are the primary parent device).
- **home** — rewritten per 44.2: `ChildSwitcher` (persona chips, persisted via a same-tab pub/sub store — every child-scoped page on the portal shares the selection) + Today card for the selected child (attendance chip, attendance %, dues tile flagged when non-zero) + honest tile links carrying `?student_id=` + notices + quick actions. Removed the fake "Bus Status: Live" KPI (value was a hardcoded string).
- **attendance / results / fees / health / wellbeing / bus** — each now sends `student_id=<selection>` (verified: ALL these endpoints accept it via `_pick_students` in `parent_app.py` — previously the web silently used children[0]) and render the switcher at top.
- **chat / conferences / notices / [slug]** — already real data pages; kept (conferences booking flow is solid, chat has thread+send).
- NOT added: hostel/portfolio pages — 44.2 "adds" are gated on `/parent/portfolio` (exists) but hostel data isn't; skipped per "endpoints must exist & no gold-plating".

## Student portal (8 routes)

- **layout** → `PortalChrome` (replaced the violet one-off header — third paradigm — and its missing mobile nav).
- **home** — verified already task-correct (real `/student/dashboard`: today's classes w/ current-period highlight, pending homework, results, notices, attendance); kept, accent unified to tokens.
- **timetable / homework / results / library / elibrary / lms / ai-tutor** — real useQuery pages, kept as-is (PortalHeader + Empty/Error states present).
- Flagged: 4.4 tree wants "next exam" on the student home — `/student/dashboard` returns no upcoming-exam data; not fabricated.

## Landing (`app/page.tsx`)

- REMOVED: trustStats band (400+/50K+/10+/ISO), the invented "Trusted by" institution strip, fabricated hero dashboard numbers (96% / NPR 2.8M / 148), ISO/IRD footer badges, "2 minutes"/"24-hour guaranteed"/"free training" promises, placeholder phone+WhatsApp lines.
- REPLACED with provable product truth: capability row (Dual BS/AD calendars · IEMIS import · eSewa/Khalti/Fonepay · NEB grade scales — all verified in backend), an honest "60 modules" preview card (module map, live subdomain example), "Per-school isolated data" (tenancy audit §2.5), Bilingual-by-design line, real contact set (mailto + web app).
- FIXED dead contact form: it never had a handler (submit was theatre) → `DemoInquiryForm` (new, `components/website/`) composes a mailto from the fields, clearly labelled; no platform-level demo/lead endpoint exists (checked: contact POSTs are school-scoped only).
- CTAs: Book Free Demo → #contact (matches what it actually is), Start Free → /register, App/View Dashboard links kept.

## Public site (`app/school/**` + `components/website/**`)

- **Admission funnel — the headline item.** The audit's "admission page = contact form" gap is closed end-to-end: the public registration backend EXISTS (`POST /website/public/<slug>/admission/registration` → staging row with `registration_number` + `verification_token`; `GET .../registration/<id>?token=` for status; service `submit_public_registration` verified in `app/services/admission_funnel.py`). `ApplyForm` rewritten as a **3-step guest wizard** on `ui/wizard`: ① student details (names/BS DOB/gender/previous school) → ② guardian + DOCUMENT CHECKLIST → ③ school custom questions (GET `/custom-fields/defs/public/<slug>/student_registration`) + GOV.UK-style review → submit. Success screen shows registration number, a StatusTimeline of what happens next, and the private bookmarkable tracking link; `TrackApplication` upgraded to StatusTimeline grammar. Legacy quick-inquiry form kept in `<details>` (posts to the other real endpoint `/admission-inquiry`).
- **Document upload flag:** guests CANNOT upload files — `POST /files/upload` is `jwt_required` — so step 2 records documents (name + certificate number) into the registration's real `documents` JSONB, shaped `{label}` to match the admin review drawer's renderer, with an explicit "bring originals to the office" note. No fake progress bars.
- **Class picker gap (flagged):** the wizard cannot offer a class dropdown — no public classes endpoint (academics is JWT-gated). `applied_class_id` is accepted by the service but unreachable by guests; schools needing it should add a custom-field (the funnel already renders school-defined questions).
- **Results page** — kept the proven `ResultsChecker` (GET `/website/public/<slug>/results`) and ADDED `CertificateVerify` — the EduEx public-verify steal backed by the REAL public endpoint GET `/students/exit-documents/verify?number=` (exact-match, minimal PII, revoked state). It rides both the classic and builder-designed results pages. Flag: verify is globally scoped by document number (backend design), not per-school.
- **Null-safe metadata** — `SectionRenderer` AboutSection (dropped "Location"/"Contact Number"/"Established: –" placeholder rows — missing values render nothing) and ContactSection (dropped "+977-XX-XXXXXXX"/"info@school.edu.np" fallbacks; tel:/mailto: links only when present). SchoolNavbar/layout footer were already filter(Boolean)-guarded in an earlier wave — verified, not re-touched. `EditorSectionRenderer` placeholders left as-is intentionally: that's the builder preview where "fill me" guidance helps the author (audit's own builder section).
- Untouched (verified healthy): pay flow (guest payments/lookup is a real A-22 feature), events/facilities/news/alumni/notices/teachers/gallery/contact pages, sitemap/robots, ISR + E201 publish guard.

## Endpoints verified to exist (used only these)

`/teacher/dashboard` `/teacher/my-classes` `/teacher/timetable` `/teacher/assignments` (GET+POST) · `/attendance/students/<id>` `/attendance/mark` (teacher role confirmed) · `/exams` `/exams/<id>/subjects` `/exams/<id>/marks` (GET+POST, teacher confirmed) · `/notices` GET+POST+PUT (teacher confirmed; DELETE admin-only) · `/hr-payroll/leave` GET+POST · `/assignments/<id>/submissions` GET + `/…/grade` POST (teacher confirmed) · `/academics/subjects?class_id=` `/academics/classes` · `/parent/dashboard` + `/parent/{child-attendance,child-results,outstanding-fees,child-health,child-wellbeing,bus-info,bus-location,chat-*,conferences*}` all accepting `student_id` · `/student/dashboard` (+ student_app routes) · `/auth/{send-otp,verify-otp,forgot-password,reset-password}` · `/custom-fields/defs/public/<slug>/student_registration` · `/website/public/<slug>/admission/registration` (+ status GET) · `/website/public/<slug>/{results,contact,admission-inquiry}` · `/students/exit-documents/verify` (public). Gaps found by grep, not built on: no public files upload; no public class list; no public platform stats.

## Files changed

New: `components/portal/otp-input.tsx` · `components/portal/portal-chrome.tsx` · `components/portal/child-switcher.tsx` · `components/website/DemoInquiryForm.tsx` · `app/school/[slug]/results/CertificateVerify.tsx`
Rewritten: `app/(auth)/verify-otp/page.tsx` · `app/teacher/{layout,page,attendance/page,marks/page,assignments/page,timetable/page,notices/page,attendance/leave-requests/page}.tsx` · `app/parent/layout.tsx` · `app/parent/page.tsx` · `app/student/layout.tsx` · `app/school/[slug]/admission/ApplyForm.tsx`
Edited: `app/(auth)/login/page.tsx` · `app/(auth)/reset-password/page.tsx` · `app/(auth)/register/page.tsx` · `app/parent/{attendance,fees,results,health,wellbeing,bus}/page.tsx` · `app/page.tsx` · `app/student/page.tsx` (accent only) · `app/student/homework/page.tsx` (accent only) · `app/school/[slug]/results/page.tsx` · `components/website/SectionRenderer.tsx`

## Residual flags for other waves

1. Teacher/parent/student portals remain outside the AOS shell (5.7 in-shell move is a shell-wave decision; the shared grammar is now identical, so the move is cheap).
2. Bilingual chrome (EN/ने pill) absent in portals — the i18n context isn't mounted on these routes; nav labels are English-only today (PortalChrome accepts `labelNe` per item).
3. MFA TOTP screen (6.1/#17) not built.
4. `/downloads/*.apk` landing links target files not present in the repo `public/` (pre-existing; likely nginx-provided) — untested.
5. Certificate verify endpoint has no rate limiter on the route (unlike the website public forms which do) — worth a backend pass.
6. Parent conferences/booking doesn't pass `student_id` yet (endpoints accept it) — one-line change when the booking UI adds a child context.
