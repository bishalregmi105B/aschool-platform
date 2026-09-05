# W3-A1c — FK Map, Cross-Tenant Edges & Data-Model Defects

Sections 3 and 4 of the W3-A1 audit. Paths relative to `backend/app/models/`
unless stated. 196 tables, catalogued in A1b.

## 3.1 Hub tables and their fan-in

Two tables are referenced by nearly everything:

| hub | inbound FK count | notes |
|---|---|---|
| `users.id` | ~120 FK columns across 60+ tables | every actor column (`created_by_id`, `approved_by_id`, `teacher_id`, `reported_by_id`, …) |
| `students.id` | ~45 FK columns | attendance, fees, marks, health, portfolio, AI |
| `schools.id` | 196-minus-10 (via SchoolModel + own columns) | tenant root |
| `classes.id` | ~20 | academics fan-out |
| `subjects.id` | ~12 | academics fan-out |

`users` is a single-table-for-all-roles design (`user.py:26-38`, enum
`user_role`: superadmin, school_admin, accountant, teacher, staff, parent,
student). Consequence: **no FK can express "must be a teacher"** — e.g.
`assignments.teacher_id` (assignment.py:28), `courses.teacher_id` (lms.py:27),
`timetable_periods.teacher_id` (timetable.py:40) all accept a parent's id.

`quiz_attempts.student_id` (lms.py:152) and `enrollments.student_id`
(lms.py:166) FK **users.id**, while `student_progress.student_id` (lms.py:118)
FKs **students.id** — the LMS module is internally inconsistent about what a
"student id" means, so joining progress to attempts requires a users↔students
hop that no column expresses.

## 3.2 Cross-domain FK edges (selected, all verified)

| from | to | crosses | path:line |
|---|---|---|---|
| `students.admission_application_id` | admission_applications | students ← admission | student.py:34-37 |
| `students.bus_stop_id` | bus_stops | students ← transport | student.py:88 |
| `biometric_punches.attendance_id` | attendance | biometric → attendance | biometric.py:114 |
| `biometric_punches.mapped_student_id` | students | biometric → students | biometric.py:113 |
| `ai_teacher_lessons.section_id` | teaching_sections | ai_teacher → content | ai_teacher.py:87-89 |
| `ai_teacher_lessons.content_snapshot_id` | **teaching_section_versions** | ai_teacher → content | ai_teacher.py:90-92 |
| `ai_teacher_mastery.outcome_id` | learning_outcomes | ai_teacher → curriculum | ai_teacher.py:252 |
| `teaching_sections.unit_id` | curriculum_units | content → curriculum | teaching_content.py:52 |
| `teaching_sections.lms_topic_id` | topics | content → LMS | teaching_content.py:59 |
| `teaching_section_versions.ai_generation_id` | ai_generations | content → workbench | teaching_content.py:166-168 |
| `teaching_media.file_id` | managed_files | content → file storage | teaching_content.py:597 |
| `teaching_exam_tips.subject_offering_id` | subject_offerings | content → curriculum | teaching_content.py:519-521 |
| `ai_content_library_items.generation_id` | ai_generations | workbench internal | ai_workbench.py:170 |
| `tutor_messages.generation_id` | ai_generations | workbench internal | ai_workbench.py:220 |
| `fee_structure_items.fee_type_id` | fee_types | money → fees | money.py:79 |
| `section_subject_teachers.class_subject_id` | class_subjects | money internal | money.py:53-55 |
| `hostel_allocations.student_id` | students **CASCADE** | hostel → students | hostel.py:61 |
| `school_chain_members.chain_id` | school_chains | multi_branch internal | school_chain.py:67-72 |
| `website_pages.school_id_override` | schools | **second** school FK on one row | website.py:12-14 |
## 3.3 Self-referential FKs and cycles

| edge | path:line | cycle? |
|---|---|---|
| `file_folders.parent_id → file_folders.id` (CASCADE) | file.py:15-19 | self-loop; **no depth cap**, a cycle inserted by API creates an infinite `to_dict` traversal via `files.count()` |
| `teaching_sections.overrides_section_id → teaching_sections.id` | teaching_content.py:56-58 | self-loop, guarded by `ck_teaching_sections_override_scope` (`:91-94`) requiring school_id NOT NULL — but **nothing prevents A overrides B overrides A** |
| `teaching_section_versions.supersedes_id → teaching_section_versions.id` | teaching_content.py:158-160 | self-loop, version chain; no cycle guard |
| `schools.owner_id → users.id` **and** `users.school_id → schools.id` | school.py:47 + user.py:25 | **true 2-table FK cycle**. Both are nullable so inserts work, but `DELETE FROM schools` can never satisfy both directions without a two-phase update, and Alembic must create one FK after the other |

The schools↔users cycle is the only real referential cycle in the schema. There
is no `ON DELETE` on either side, so a hard school delete raises
`ForeignKeyViolation` from ~190 tables — deletion is soft-only in practice
(`is_deleted`), which is consistent but never stated as an invariant anywhere.

## 3.4 Cascade posture

Only **26 FK columns** declare `ondelete` at all (grep over `app/models/`); the
other ~600 use PostgreSQL's default `NO ACTION`.

Declared cascades:
- `faqs.school_id` → CASCADE (faq.py:12)
- `hostels.school_id`, `hostel_rooms.school_id`, `hostel_rooms.hostel_id`,
  `hostel_allocations.school_id`, `hostel_allocations.room_id`,
  `hostel_allocations.student_id` → all CASCADE (hostel.py:13,32,33,59,60,61)
- `teaching_*` → CASCADE on version/section/unit/outcome parents
  (teaching_content.py:52,152,286,292,320,366,421,468,507,554,592,672)
- `ai_teacher_lesson_chapters/messages/learning_events.lesson_id` → CASCADE
  (ai_teacher.py:185,226,294)
- `biometric_punches.device_id` → CASCADE (biometric.py:103);
  `biometric_sync_logs.device_id` → SET NULL (biometric.py:142)
- `file_folders.parent_id` → CASCADE (file.py:17);
  `managed_files.folder_id` → SET NULL (file.py:63)

**The inconsistency that matters**: `faqs` and the four hostel tables CASCADE on
`school_id`, so a hard `DELETE FROM schools` silently destroys hostel
allocations and FAQs while every other table blocks the delete. And they carry
`is_deleted` too — so the same data has two contradictory deletion stories.

`teaching_sections.unit_id ON DELETE CASCADE` (teaching_content.py:52) means
deleting a platform `curriculum_units` row **hard-deletes every school's
teaching sections, versions and content blocks** under it, bypassing
`is_deleted` entirely. `curriculum_units` is written by the boot seed
(`app/services/ai/curriculum_seed.py`), and `CurriculumFramework.units` also
declares ORM `cascade="all, delete-orphan"` (curriculum.py:28), so an ORM
framework delete propagates all the way to teaching content.

`teaching_section_outcomes.outcome_id ON DELETE CASCADE`
(teaching_content.py:292) has the same shape: re-seeding curriculum outcomes
would silently drop outcome links from published versions.
## 3.5 FKs that cross tenant boundaries (no composite school_id guard)

The schema has **zero composite `(school_id, x_id)` foreign keys**. Every child
row carries its own `school_id` *and* a bare `child.parent_id → parent.id`, so
nothing at the DB level stops a row in school A pointing at a parent in school B.
Confirmed by grep: no `ForeignKeyConstraint([...])` multi-column declaration
exists in `app/models/`.

Highest-impact examples (a bad `*_id` in a request body is enough):

| child (school-scoped) | FK to | consequence if crossed | path:line |
|---|---|---|---|
| `marks.student_id` | students.id | grade written into another school's student | exam.py:86 |
| `fee_collections.student_id` | students.id | money booked against a foreign student | fee.py:45-47 |
| `fee_receipts.collection_id` | fee_collections.id | receipt for a foreign collection | fee.py:97-99 |
| `attendance.student_id` | students.id | attendance for a foreign student (the UQ is `school+student+date`, so this *creates* a valid-looking row) | attendance.py:18 |
| `hostel_allocations.student_id` | students.id | + CASCADE | hostel.py:61 |
| `chat_messages.receiver_id` | users.id | cross-tenant DM | chat.py:34 |
| `conference_slots.parent_id` | users.id | foreign parent booked | conference.py:35 |
| `ai_teacher_lessons.student_id` | students.id | AI lesson attributed cross-tenant | ai_teacher.py:84 |
| `ai_teacher_mastery.student_id` | students.id | + UQ is `(student_id, concept_key)` **without school_id** (ai_teacher.py:269) | ai_teacher.py:248 |
| `tutor_session_plans.student_id` | students.id | tutor plan for foreign student | ai_workbench.py:179 |
| `guardian_ai_consents.student_id/guardian_user_id` | students/users | consent granted by foreign guardian; UQ omits school_id (ai_workbench.py:257) | ai_workbench.py:249-250 |
| `biometric_punches.mapped_student_id` | students.id | device maps to foreign student | biometric.py:113 |
| `teaching_sections.unit_id` | curriculum_units.id | intentional (platform units) | teaching_content.py:52 |

Two unique constraints are **globally scoped where they should be per-school**:
- `ai_teacher_mastery` UQ `(student_id, concept_key)` — ai_teacher.py:269
- `guardian_ai_consents` UQ `(student_id, guardian_user_id, scope)` —
  ai_workbench.py:257-258

Those two are actually safe-by-accident (student ids are globally unique UUIDs),
but they diverge from the `school_id`-first convention used by
`mastery_records` (adaptive_learning.py:105) and `student_ai_profiles`
(ai_workbench.py:309), so a future school-move breaks them differently.

`assets.asset_code` is `unique=True` **globally** (inventory.py:13) — school A
registering `LAB-001` blocks school B. That is a live cross-tenant collision, not
a theoretical one.

## 3.6 Tables lacking school scoping that need it

| table | path:line | current tenancy | what it needs |
|---|---|---|---|
| `teacher_pd_progress` | `app/services/ai/extensions.py:120-125` | **none at all** | school_id + model + migration |
| `teaching_section_outcomes` | teaching_content.py:282 | via version | fine if every read joins; no route-level guard exists |
| `teaching_notes/examples/misconceptions/formulas/exam_tips/key_terms/media` | teaching_content.py:316,362,417,464,503,550,588 | via version | same — 7 tables readable by version_id alone |
| `curriculum_units` / `learning_outcomes` | curriculum.py:48,75 | via framework | a school-authored framework's units are reachable by unit_id from any tenant |
| `designer_templates` | designer_template.py:17 | nullable school_id, **no ForeignKey to schools** | add FK; orphan school_ids cannot be detected |
| `ai_nutrition_facts`, `ai_tool_registry` | ai_workbench.py:54,86 | platform-global by design | fine |
| `plugins`, `schools`, `revoked_tokens`, `system_settings` | plugin.py:26, school.py:24, revoked_token.py:21, system.py:13 | platform-global by design | fine |
## 4. Data-model defects

### 4.1 Duplicate / overlapping tables — verdicts

**health_records vs student_health_records → ALREADY RESOLVED.**
`student_health_records` no longer exists in `app/models/`. Migration
`c7d2e9f4a8b3_w0_retire_student_health_records.py` copies legacy rows into
`health_profiles` then drops the table; the header states the grep found zero
readers/writers. Canonical set is `health_profiles` / `medical_visits` /
`immunizations` (health_records.py:18,39,57). No action needed. Note the
migration is the newest head (`down_revision = e8b1c4d6a9f2`), so any
environment that has not run it still carries the dead table.

**hr.py vs hr_payroll.py → NOT a duplicate; hr.py is a 5-line alias.**
`hr.py:3` re-exports `StaffPayroll/StaffLeave/StaffAppraisal` from
`hr_payroll.py`. One table set (`staff_payroll`, `staff_leaves`,
`staff_appraisals`). Verdict: delete `hr.py` and the
`from app.models.hr import StaffPayroll as HRPayrollAlias` line in
`models/__init__.py:57`. Real overlap is elsewhere:
`staff_leaves` (hr_payroll.py:31) vs `leave_requests` (attendance.py:62) —
**two leave tables, both keyed to users.id, both with pending/approved/rejected
status and approved_by_id**. `leave_requests` has no `days` column;
`staff_leaves` has no `rejection_reason`. Both are live models.

**staff.py vs hr → staff.py is `Staff = User` (staff.py:5-6).**
There is no `staff` table. The `/staff` blueprint (`app/api/v1/staff.py:13`)
operates on `users` filtered by role. Verdict: harmless alias, but it hides the
fact that staff-specific fields (designation, joining date, qualification, salary
grade) have **nowhere to live** — they end up in `users.permissions` JSONB or in
`staff_payroll` rows. This is a modelling gap, not a duplicate.

**designer.py vs designer_template.py → designer.py is an alias (designer.py:3-5).**
Real tables: `designer_templates` (designer_template.py:12),
`designer_documents` (designer_document.py:13),
`designer_document_revisions` (designer_document_revision.py:15).
Overlap that *is* real: `designer_templates` (school-scoped, JSONB `canvas_json` +
`writer_json` + `fields` + `extra_config`) vs `website_themes` (website.py:31,
`config_schema` + `default_config`) — two template/theme stores with the same
shape for two different editors. Also `designer_templates.school_id` is nullable
with **no FK** (designer_template.py:17) while `designer_documents` inherits
SchoolModel — inconsistent tenancy in one feature.

**digital_content.py → NOT dead.** `DigitalBook`/`PastPaper`/`OERResource` are
read and written by `app/api/v1/elibrary.py:6,20,43,63,83,103,126` and read by
`app/api/v1/parent_app.py:1103-1117`. Verdict: live. The real defect is
marketplace duplication: `elibrary/manifest.yaml:11` and
`library_management/manifest.yaml:11` **both point `api_blueprint` at
`app.api.v1.library`**, while `elibrary/manifest.yaml:12` declares
`models_module: app.models.digital_content` — so the `elibrary` SKU's models are
served by a blueprint that does not touch them (`app/api/v1/library.py:8` imports
only `Book, BookIssue`). The actual elibrary routes live in
`app/api/v1/elibrary.py` and are mounted **statically**
(`app/api/v1/__init__.py:103`), not via its manifest.

**incident.py vs incident_management.py → correct two-tier split, one leak.**
`incidents`/`witness_statements`/`incident_actions` (incident.py:19,69,83) are the
base tier; `incident_escalations`/`incident_workflow_events`
(incident_management.py:31,57) add the workflow. The leak: the management tier's
columns were added **onto the base `incidents` table** — `assigned_to_id`,
`escalated_at`, `escalated_to_id`, `parent_notified`, `conference_scheduled`,
`conference_scheduled_at` (incident.py:53-59) — and `conference_scheduled` +
`conference_scheduled_at` are duplicated on `incident_escalations`
(incident_management.py:45-46). Two writable copies of the same fact.

**ai_insight.py vs ai_workbench.py → different concerns, but analytics.py
aliases both.** `ai_insight.py` = weekly/daily/risk report artifacts
(`weekly_insight_reports`, `daily_briefs`, `risk_alerts`). `ai_workbench.py` =
generic tool runtime + provenance. No table overlap. The overlap is in
*provenance*: `ai_usage_logs` (ai_token.py:34) and `ai_generations`
(ai_workbench.py:28) both record provider/model/tokens/cost/latency/status per
AI call — two ledgers for one event, and `ai_generations.feature` is explicitly
labelled "legacy AITokenHub feature tag" (ai_workbench.py:33), confirming the
duplication is known.
### 4.2 Additional duplicate table pairs found (not in the brief)

| pair | verdict | path:line |
|---|---|---|
| `book_transactions` vs `book_issues` | **`book_transactions` is dead** — grep finds zero consumers outside `models/library.py` and `models/__init__.py:26`; `app/api/v1/library.py:8` uses `BookIssue` only. Two near-identical issue tables; `book_transactions` has `fine_amount`/`fine_paid` that `book_issues` lacks | library.py:37 vs :58 |
| `mood_checkins` vs `mood_entries` | both live-ish: `MoodEntry` has 3 consumers, `MoodCheckin` has **0**. `mood_checkins` uses a PG enum `mood_type`, `mood_entries` a free String + `energy_level` | wellbeing.py:19 vs :84 |
| `counselor_sessions` vs `counselor_notes` | `CounselorSession` has **0** consumers; `CounselorNote` has 2. Sessions carry scheduling, notes carry content — the scheduling half is unused | wellbeing.py:62 vs :97 |
| `timetables`+`timetable_periods` vs `timetable_slots` | **two timetable models**. `TimetableSlot` has 6 consumers; `TimetablePeriod` has 0 and `Substitution` (which FKs `timetable_periods.id`, timetable.py:52-54) also has 0 → the substitution feature is wired to the dead half | timetable.py:17,30,73 |
| `online_exams` vs `quizzes` | both store `questions` JSONB with attempts tables (`online_exam_attempts` exam.py:194, `quiz_attempts` lms.py:149); `online_exam_attempts.student_id`→students, `quiz_attempts.student_id`→users | exam.py:169 vs lms.py:134 |
| `admission_leads` vs `admission_inquiries` | `AdmissionLead` has **0** consumers, `AdmissionInquiry` has 3. Same shape (source/phone/status/follow_up_date/assigned_to); leads adds `ai_score` | admission.py:84 vs :105 |
| `weekly_insight_reports` × 2 names | one table, aliased as `AnalyticsInsightReport` in `models/__init__.py:58` | ai_insight.py:10 |
| `notices` vs `events` vs `alumni_events` | three event-ish tables; `events` and `alumni_events` share title/description/date/type with no shared base | notice.py:45, alumni.py:32 |
| `student_progress` vs `enrollments.completed_lessons` | two LMS progress stores | lms.py:116 vs :168 |
| `staff_leaves` vs `leave_requests` | two leave stores (see 4.1) | hr_payroll.py:31 vs attendance.py:62 |
| `school_websites` vs `website_pages`/`website_themes` | `school_websites` holds `theme_slug` + `customizations` + `draft_config` JSONB while `website_themes` is a table of themes — theme selection is a string, not an FK | school.py:196 vs website.py:31 |

### 4.3 Models never imported in `models/__init__.py`

Verified by AST-ish scan of all 199 classes against the names in
`models/__init__.py`:

| class | table | file:line | consequence |
|---|---|---|---|
| `ExpenseCategory` | `expense_categories` | hr_payroll.py:67 | **not in `db.metadata` unless hr_payroll is imported another way** → Alembic autogenerate can emit a DROP for a live table |
| `Expense` | `expenses` | hr_payroll.py:74 | same |
| `InAppNotification` | `in_app_notifications` | notification.py:107 | same |

All three are *transitively* imported because `models/__init__.py:49` imports
`from app.models.hr_payroll import StaffPayroll, …` and `:29` imports from
`app.models.notification` — importing the module registers every class in it. So
the tables ARE in metadata. The defect is narrower but real: the file-level
comment at `models/__init__.py:86-88` says missing entries caused exactly this
class of bug (D-01) for `faqs`/`hostel`, and these three are relying on an
implicit side effect rather than the explicit contract. `SchoolIsolationError`
(base.py:78) is an exception class, correctly absent.

`app/models/hostel.py` and `app/models/faq.py` are now imported
(`models/__init__.py:89,112`), so the D-01 class of bug is closed for them.
### 4.4 Enum defects

58 distinct PG enum type names are declared across `app/models/`. **No type-name
collisions** — every `name="…"` is unique, and `ai_workbench.py:199-203` documents
a deliberate rename (`tutor_session_status`) precisely to avoid colliding with
`session_status` already owned by conferences (wellbeing.py:76). That discipline
holds.

The remaining enum defects are *semantic duplication* — same value set, four
different PG types, so no shared casting/validation:

| value set | type names (file:line) |
|---|---|
| low/medium/high/critical | `moderation_severity` ai_workbench.py:271, `incident_severity` incident.py:37, `risk_level` student.py:111 |
| present/absent/late/half_day/leave | `attendance_status` attendance.py:26, `teacher_att_status` attendance.py:51 |
| issued/returned/overdue/lost | `book_tx_status` library.py:46, `book_issue_status` library.py:68 |
| male/female/other | `student_gender` student.py:44, `gender_type` user.py:47 |

Second enum problem: **status columns are split between PG enums and free
Strings** with no consistency. PG enum: `exams.status` (exam.py:64),
`incidents.status` (incident.py:44), `admission_applications.status`
(admission.py:57). Free String with a comment listing the values:
`online_exams.status` (exam.py:182), `courses.status` (lms.py:31),
`payment_initiations.status` (fee.py:180), `disaster_drills.status`
(disaster_management.py:45), `hostel_allocations.status` (hostel.py:64),
`ai_teacher_lessons.status` (ai_teacher.py:100 — but *with* a CheckConstraint,
ai_teacher.py:132-136). Only `ai_teacher.py` and `teaching_content.py` back their
String statuses with CHECK constraints; every other free-String status can hold
arbitrary text.

Third: the two comments at `fee.py:61-63` and `fee.py:75-77` document that the
DB enum drifted ahead of the model twice (`qr_pay` added by `e4f5a6b7c8d9`,
`refunded` by `f8c2a9d4e1b7`) and that reading an unmapped value raises
`LookupError` / `DataError` **after the gateway moved the money**. Same drift
class can recur on any of the 58 enums; there is no test that asserts
model-enum ⊇ DB-enum.

### 4.5 Naive-datetime residue

`BaseModel.created_at/updated_at` are TIMESTAMPTZ (base.py:23-31), and D-03 is
declared done. But of the domain datetime columns:

- **82** are bare `Column(DateTime)` — naive `TIMESTAMP WITHOUT TIME ZONE`
- **15** more are `Column(DateTime, …)` with args but still naive
- **23** are `DateTime(timezone=True)` — only in `ai_teacher.py` (8),
  `ai_workbench.py` (6), `hostel.py` (3), `contact.py` (2), `faq.py` (2),
  `base.py` (2)

So ~97 naive datetime columns remain. The ones with correctness consequences:

| column | path:line | why it matters |
|---|---|---|
| `revoked_tokens.expires_at` | revoked_token.py:29 | comment at `:27-28` admits the naive choice; `_naive_utc` normalisation (`:35-40`) is the workaround. A session `timezone` change shifts revocation windows |
| `users.otp_expires_at`, `locked_until`, `tokens_invalid_before` | user.py:55,61,65 | OTP validity, brute-force lockout, and global token invalidation all compared against naive values; `app/__init__.py:165` has to patch tzinfo at read time |
| `school_plugins.trial_ends_at` | plugin.py:102 | `_trial_expired` in `app/__init__.py:499-504` must `replace(tzinfo=utc)` before comparing — a trial's exact expiry depends on server TZ |
| `fee_collections.collected_at`, `last_reminder_sent_at` | fee.py:70,88 | the 72h reminder dedupe window drifts |
| `exams.*` 12 naive cols | exam.py | result-publish timing |
| `gps_logs.timestamp` | transport.py:77 | NOT NULL naive timestamp on the highest-volume table |

Because `CELERY_TIMEZONE=Asia/Kathmandu` with `enable_utc=False`
(`backend/config.py:202`, `app/__init__.py:288`), Celery-written naive datetimes
are **NPT** while web-written ones follow the DB session — the two writers of
`fee_collections.last_reminder_sent_at` (`app/tasks/fee_reminders.py`) and the
web fee routes can disagree by 5h45m.
<!--APPEND-->
