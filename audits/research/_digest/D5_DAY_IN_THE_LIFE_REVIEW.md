# D5 — Day-in-the-Life Scenario Review (web, per role)

Date: 2026-09-05. Method: click-by-click trace through the actual frontend routes
(verified against the running code, not memory) and the `/api/v1/*` endpoints each
page calls. Mobile findings come from the code state (0 .arb, 0
google-services.json, `setOnTapCallback` defined but never called — verified today
by grep), not device testing.

Legend: **BLOCKER** = a real user cannot complete the task · **FRICTION** =
possible but confusing/slow · **MOCK** = screen renders fabricated data · **OK**.

---

## Scenario 1 — TEACHER: plan and deliver a lesson, take attendance, assign homework

| Step | Where the user goes | What actually happens | Verdict |
|---|---|---|---|
| Log in → land on /dashboard | dashboard/page.tsx | Real data (uses api) | OK |
| Check today's timetable | /dashboard/timetable or /timetable/teacher | Raw table, hover-only delete, raw `<select>` for day | FRICTION (no colors, no conflict highlight, no today-column) |
| Prepare AI lesson plan | /dashboard/ai-tools/lesson-plan | Form works, output rendered as `whitespace-pre-wrap` plain text — no markdown, no KaTeX, no docx/pdf export wired | FRICTION (output unusable for printing without copy-paste) |
| Teach with AI Teacher | — | **No AI Teacher exists yet** (the whole point of W3). Teacher falls back to chat-style tools | BLOCKER (by design, pending build) |
| Take attendance | /dashboard/attendance/mark | Works; keyboard marking absent; after editing an earlier day the "N unmarked" state silently assumes all-present defaults | FRICTION |
| Mark absent → notify parent | backend listener | Now wired (listeners.py:69) — push+SMS+in-app fire | OK (backend); no UI feedback on marking page that alert was sent |
| Approve a student leave | — | `/attendance/leave-requests` endpoints exist; **zero UI anywhere** (grep verified) | BLOCKER for the workflow |
| Assign homework | /dashboard/assignments | Create dialog + attachment upload with progress; instructions are a plain Textarea (no rich text); due date not BS | FRICTION |
| Enter marks | /dashboard/exams/marks | Spreadsheet grid with live total/grade preview — good; but no Enter-to-next-row, no Excel paste, no undo | FRICTION (this is THE daily flow; keyboard = 1) |
| Message a parent | /dashboard/communications | Broadcast exists; two-way chat is parent-app-only (chat-threads live in parent_app.py) | FRICTION |

Day-in-the-life verdict: a teacher can survive the day, but the two marquee
flows (lesson prep output formatting; marks keyboard entry) are the slowest
parts, and the AI Teacher — the differentiator — is absent pending W3.

## Scenario 2 — STUDENT: attend class, check homework, submit, review results, study

| Step | Route | What happens | Verdict |
|---|---|---|---|
| Open student portal | /student | **MOCK.** The page is hardcoded: "Hey, Student! 🎓", "Class 10A • Roll No. 15", fake streak "12 Day", fake XP, fake timetable with "Mr. Sharma", fake homework list, fake achievement banner. Zero API calls (grep: 0 hits). Any real student sees a stranger's life | **BLOCKER** |
| Homework list | /student/homework | Real (useQuery, student_app.py /assignments) | OK |
| Submit homework | backend `POST /student/assignments/<id>/submit` | The API accepts a submission; portal has no submit form wired on web (app-only); the Flutter app's submit is paste-a-URL (per widget audit; upload fix pending) | BLOCKER on web |
| Check results | /student → PortalSectionPage | "Results — coming soon" card (portal-route-meta.ts:59-63) | BLOCKER |
| Timetable | /student → PortalSectionPage | Coming-soon card | BLOCKER |
| Library | /student → PortalSectionPage | Coming-soon card despite /student/library + /library/request endpoints existing (student_app.py:417,455) | BLOCKER (endpoint exists, UI refuses) |
| LMS | /student → PortalSectionPage | Coming-soon; /student/lms exists (student_app.py:494) | BLOCKER |
| AI Tutor | /student → PortalSectionPage | Coming-soon; tutor engine + consent gates exist backend-side | BLOCKER |
| Study with spaced repetition | — | No student-facing surface on web; SM-2 lands with D3 scope | BLOCKER (pending) |

Day-in-the-life verdict: the student portal is a facade. The /student/[slug]
catch-all turns every real feature into "coming soon" while the underlying API
is live. This is the single worst surface in the product: a parent opens it
once, sees fake data with a stranger's name, and trust is gone.

## Scenario 3 — PARENT: pay fees, check attendance/results, track the bus, chat a teacher

| Step | Route | What happens | Verdict |
|---|---|---|---|
| Open parent portal | /parent | Real data (useQuery) — child selection, dashboard | OK |
| Pay a fee | /parent → fees card → PortalSectionPage | **"Fees — coming soon"** on web; the mobile app covers payment; parent_app.py has /outstanding-fees (read-only). Web payment = impossible | **BLOCKER** |
| Check attendance | /parent → PortalSectionPage | Coming-soon card; /parent/child-attendance endpoint exists (parent_app.py:218) | BLOCKER |
| Check results | /parent → PortalSectionPage | Coming-soon; /parent/child-results exists (parent_app.py:340) | BLOCKER |
| Track bus | /parent → PortalSectionPage | Coming-soon; /parent/bus-info + /bus-location/<id> exist (parent_app.py:567,645) | BLOCKER |
| Chat a teacher | /parent → PortalSectionPage | Coming-soon; chat-threads GET/POST exist (parent_app.py:701-764) | BLOCKER |
| Book a PT conference | /parent → PortalSectionPage | Coming-soon; conferences endpoints exist (parent_app.py:809,867) | BLOCKER |
| Health records | /parent/[slug] catch-all → coming-soon | /parent/child-health exists (parent_app.py:932) | BLOCKER |

Day-in-the-life verdict: the parent portal lands on one working dashboard page
and then "coming soon" for every daily task, while 19 real endpoints sit
unconsumed. Meanwhile the pattern to fix it is already in the codebase —
teacher/marks and teacher/assignments are one-line re-exports of dashboard
pages, proving the portal pages are trivial to wire.

## Scenario 4 — ADMIN: onboard a new class, enroll students, publish notices, bill fees

| Step | Route | What happens | Verdict |
|---|---|---|---|
| Create academic year/class/section/subjects | /dashboard/academics/* | Full CRUD, real API | OK |
| Add students | /dashboard/students/new | Works; guardian create only (edit/delete endpoints still missing — confirmed today) | FRICTION |
| Bulk import | /dashboard/students/bulk-import + /bulk-uploads/iemis | Works | OK |
| Assign class teacher | /dashboard/academics/class-teachers | Works | OK |
| Generate timetable | /dashboard/timetable/generate | The "AI solver" is the greedy stub (ignores teacher qualifications, `conflicts: []` placeholder — re-confirmed in D1 digest D-findings); no conflict report | FRICTION |
| Publish a notice | /dashboard/notices | Works; audience targeting, rich text, bilingual bodies absent (tiptap installed but unused here) | FRICTION |
| Set up fee structure | /dashboard/fees/structure | Works; no dry-run preview of apply | FRICTION |
| Bill a class | /dashboard/fees (batch monthly) | Works | OK |
| Send absent alerts | automatic | Listener fires push+SMS+in-app (verified today) | OK |
| Configure a plugin | /dashboard/plugins/[slug]/settings | Schema-driven form works — but only 6 of 43 plugins ship config_schema.yaml | FRICTION |
| Check what changed in school data | audit logs | /compliance/audit-logs endpoint is flutter-only; no admin UI | FRICTION |

Day-in-the-life verdict: the admin surface is genuinely strong — the completeness
audit's "~92% backend" holds in practice. The daily pains are timetable quality,
notice targeting, and the missing guardian edit.

---

## Cross-cutting findings

1. **The portals are the #1 user-facing defect.** 18 of 24 portal routes render
   `PortalSectionPage`'s "Coming soon" card while their endpoints exist and work
   (verified per-route above). Two one-line re-export pages prove the fix pattern.
2. **The /student landing page shows fabricated personal data** — worse than a
   blank page. MOCK findings are release blockers.
3. **AI outputs are plain-text rendered.** Every ai-tools page prints
   `whitespace-pre-wrap`; no markdown/KaTeX; no docx/pdf export of outputs
   (pptxgenjs+docx are already installed but unwired for this).
4. **Keyboard-less high-frequency flows.** Marks entry and fees POS — the two
   pages staff live in all day — have zero keyboard accelerators.
5. **Backend > UI everywhere.** Leave requests, visitor appointments, procurement,
   headcount, donations, IEP, moderation, QTI, transfers list: implemented,
   orphaned (backend completeness audit §4; spot-re-confirmed today).
6. **No `DataTable`/`Skeleton`/`ConfirmDialog`/`Sheet`/`EmptyState` primitives**
   exist (components/ui inventory re-verified today) — every list page
   re-implements pagination and every delete uses `window.confirm`.
7. **Mobile release-blocking state** (unchanged): 0 .arb localization, 0
   google-services.json (push dead), `setOnTapCallback` never invoked, 105
   hardcoded `Colors.white`.

## Fix order that falls out of this review

1. Portals: wire the 18 coming-soon routes to their live endpoints (re-export
   pattern where a dashboard page exists; dedicated pages for
   attendance/results/fees/chat/bus). Kill the mock /student page first.
2. Tier-1 widgets (DataTable, ConfirmDialog+undo, Skeleton, EmptyState, Sheet,
   FilterBar) — unblocks every page upgrade after it.
3. Marks + fees + attendance keyboard flows; AI output markdown/KaTeX + export.
4. Then W3 AI Teacher (the differentiator), which this review confirms is the
   highest-value missing capability for the teacher persona.
