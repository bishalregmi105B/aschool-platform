# Data model audit — condensed evidence

Source: Explore agent, read all 61 files in `backend/app/models/` (158 declared `__tablename__` classes, **154 in SQLAlchemy metadata**) + all 32 migrations (157 `create_table` calls). Verified by loading `db.metadata` read-only in the project venv.

## Base convention
`BaseModel` (base.py:10): UUID PK (`default=uuid.uuid4`, **no server_default**), `created_at`/`updated_at` with `server_default=func.now()`, `is_deleted` NOT NULL (Python default only, **no server_default**).
`SchoolModel` (base.py:32): adds `school_id` FK NOT NULL `index=True`; `for_school()` raises on `None`.
148 of 158 classes inherit `SchoolModel`; 6 inherit `BaseModel`; **4 inherit raw `db.Model`** (`FAQ`, `Hostel`, `HostelRoom`, `HostelAllocation`).

## P0 — data loss, money integrity, tenant leakage, deploy breakage

**P0-1 `student_scholarships` has NO MIGRATION AT ALL.** `models/fee.py:142` declares it; `grep -rn student_scholarships migrations/` → nothing. Any DB built by `flask db upgrade` lacks the table. The code already knows: `fees.py:2380` wraps the lookup in `db.session.begin_nested()` commenting "e.g. table missing in an un-migrated DB", and `GET/POST /fees/scholarships` (fees.py:796,834) **500s outright**. Same class of bug that migration `d5a9e7c1b3f2` was written to fix for `fee_types` — repeated.

**P0-2 Four models are invisible to Alembic autogenerate.** `models/__init__.py` (the only import surface, used by `migrations/env.py:15`) never imports `faq.py` or `hostel.py`. Metadata holds 154 tables; 158 are declared. `faqs`, `hostels`, `hostel_rooms`, `hostel_allocations` exist only because of hand-written migrations. Every future autogenerate ignores them and **may emit `op.drop_table` for them**.

**P0-3 No unique constraint on `marks`.** `exam.py:80-98` — nothing prevents two rows for `(exam_id, student_id, subject_id)`. Any retry, double-submit, or concurrent teacher entry silently doubles a student's total, and every aggregate (report card total, GPA, rank) is then wrong with no way to detect it.

**P0-4 Receipt numbers are not unique.** `fee.py:87` `receipt_number String(50) NOT NULL` with no UQ; `fee_collections.receipt_number` (`:63`) likewise. Generation at `fees.py:2679-2688` **counts existing receipts per collection** and formats `RCPT-{prefix}-{n:02d}` — count-based with no DB guard, so two concurrent prints produce the same number. For an IRD-registered school (`schools.irb_number`) duplicate receipt numbers are a tax-compliance failure.

**P0-5 `students` has no uniqueness on any identity column.** `student.py:50` `student_id`, `:51` `roll_number`, `:62` `admission_number` — all plain nullable. `services/student_numbers.py` does careful `SELECT … FOR UPDATE` on the School row, but that's application-level only; the IEMIS importer, seeders, and direct SQL bypass it.

**P0-6 `payment_method` enum drift.** Migration `e4f5a6b7c8d9` adds `qr_pay` to the PG type; `fee.py:51-61` still lists 6 values; `fees.py:120` offers `qr_pay` as a method key. SQLAlchemy validates client-side → **`LookupError` on read-back**.

**P0-7 `website_pages.school_id_override` is a second tenant key.** `website.py:12-14` — a `SchoolModel` subclass with an extra nullable FK to `schools.id`. Two competing tenant keys on one table.

**P0-8 `designer_templates.school_id` is nullable with NO FK.** `designer_template.py:17` — the only table in the schema whose `school_id` lacks a FK. NULL = platform template (deliberate), but the UQ `(school_id, template_key)` does not dedupe platform rows because Postgres treats NULLs as distinct.

**P0-9 `enrollments.student_id` and `quiz_attempts.student_id` point at `users.id`, not `students.id`.** `lms.py:168` and `:154`. Any join to `students` (roll, class, section) silently returns nothing; passing a real `students.id` violates the FK.

**P0-10 391 of 395 FKs have no `ondelete`, and there is no soft-delete propagation.** Only 4 declare it. `BaseModel.soft_delete()` flips one row and commits — soft-deleting a Student leaves visible `marks`, `attendance`, `fee_collections`, `guardians`, `book_transactions`, `hostel_allocations` rows. Every child list endpoint still shows them and revenue/attendance reports still count them.

## P1 — correctness and performance at 2000 students

**P1-11 411 `DateTime` columns, ZERO with `timezone=True`.** Only the 4 non-conforming raw-`db.Model` classes use `DateTime(timezone=True)`. Nepal is UTC+05:45; `CELERY_TIMEZONE="Asia/Kathmandu"` while the DB stores naive values, and there are **41 `datetime.utcnow()` call sites**. Attendance cut-offs, exam windows, and late-fee day boundaries are off by 5h45m in whichever direction the writer used.

**P1-12 226 FK columns have no index.** The daily-pain list: `marks.exam_id/student_id/subject_id`, `attendance.student_id/class_id/section_id`, `fee_collections.student_id`, `fee_receipts.collection_id/student_id`, `report_cards.student_id/exam_id`, `students.class_id/section_id/academic_year_id`, `guardians.student_id`, `timetable_periods.timetable_id/teacher_id`, `gps_logs.bus_id`, `book_transactions.book_id/student_id`, `staff_payroll.user_id`. At 2000 students × 12 subjects × 6 exams ≈ **144k marks rows, every marksheet load is a sequential scan**.

**P1-13 Only 4 composite indexes exist in the whole model layer**, and `created_at` is indexed **nowhere** despite being the default sort on virtually every list endpoint. Recommended:
```
ix_attendance_school_class_date        (school_id, class_id, date)
ix_attendance_school_student_date      (school_id, student_id, date)
ix_marks_school_exam_class             (school_id, exam_id, class_id)
ix_marks_school_student                (school_id, student_id)
ix_fee_collections_school_student_year (school_id, student_id, academic_year)
ix_fee_collections_school_status_date  (school_id, payment_status, collected_at)
ix_students_school_year_class_section  (school_id, academic_year_id, class_id, section_id)
ix_students_school_status              (school_id, status)
ix_gps_logs_bus_ts                     (school_id, bus_id, timestamp DESC)
ix_audit_logs_school_created           (school_id, created_at DESC)
ix_sms_logs_school_created             (school_id, created_at DESC)
ix_notices_school_published            (school_id, published_at DESC)
```

**P1-14 Missing unique constraints — 22 tables.** Beyond P0-3/4/5: `academic_years(school,name)` + partial UQ on `is_current`; `classes(school,year,name)`; `sections(school,class,name)`; `subjects(school,code)`; `report_cards(school,student,exam)`; `staff_payroll(school,user,month)` — **double payroll possible**; `fee_structures(school,class,year)`; `fee_types(school,name)`; `books.accession_number`; `buses(school,vehicle_number)`; `hostel_rooms(school,hostel,room_number)`; `hostel_allocations` partial UQ where status='active'; `houses(school,name)`; `student_badges(school,student,badge)`; `enrollments(school,course,student)`; `student_progress(school,student,lesson)`; `immunizations(school,student,vaccine,dose)`; `hub_group_members` **missing school_id in its existing UQ**; `payment_initiations(school,gateway,gateway_ref)`; `timetable_periods(timetable,day,period)` + exclusion on teacher/time; `timetable_slots(school,class,section,day,period)`; `assets` — replace **globally unique** `asset_code` with `(school_id, asset_code)`.

**P1-15 Statuses are free-text `String` on 60+ columns, with ZERO `CheckConstraint` anywhere** (grep → 0 hits in models and migrations). The schema is split-brained: 48 columns use PG enums, adjacent ones use bare strings with the vocabulary only in a comment. Worst inconsistencies: `attendance.status` and `teacher_attendance.status` have **different value sets and order**; `admission_inquiries.status` (String) has the **same vocabulary as the `lead_status` enum next door**; `mood_entries.mood` (String) duplicates the `mood_type` enum; `leave_requests.leave_type` (sick/casual/earned/maternity) vs `staff_leaves.leave_type` (casual/sick/maternity/unpaid) — **different sets for the same concept**. Highest-priority money/lifecycle strings: `staff_payroll.status`, `payment_initiations.status`, `procurement_requests.status`, `alumni_donations.status`, `hostel_allocations.status`, `student_transfers.transfer_type`.

**P1-16 Money is `Numeric` almost everywhere — good — but 3 real defects remain.** All 24 currency columns are `Numeric` with sane precision; **no Float money column exists**. However:
- **`fee_structures.fee_items` JSONB (fee.py:33) holds the amounts that actually get billed**, and `fees.py:2099-2103` coerces them with `round(float(value or 0), 2)` — every generated fee passes through binary float. This is money-in-float in practice.
- **`Float` on grading/scoring columns**: `admission_applications.test_score` + `.interview_score` (drive `merit_rank` — **admission merit lists decided by float comparison are contestable**), `QuizAttempt.score`, `StudentProgress.progress_pct`, `Enrollment.progress_percentage`, `MasteryRecord.avg_score`, `students.risk_score`, `AdmissionLead.ai_score`, `SocialMessage.ai_confidence`.
- Inconsistent precision pair: `fee_structures.total_annual` Numeric(12,2) vs `fee_collections.amount` Numeric(10,2).

**P1-17 Nullable/default defects.** `attendance.section_id` nullable while `class_id` is NN → section registers untrustworthy. `students.class_id/section_id/academic_year_id` **all nullable** → a student enrolled in nothing. `fee_collections.academic_year` and `collected_at` nullable → a paid collection with no payment timestamp. `marks.total_marks/full_marks/pass_marks` all nullable with no defaults → a mark row grading against nothing. `users.email` and `password_hash` nullable **with no UQ** → duplicate and password-less accounts are legal. `guardians.phone` nullable → the entire parent-SMS layer silently no-ops.
**`is_deleted` re-declared NULLABLE in 6 subclasses**, shadowing the NOT NULL base (`website.py:20`, `lms.py:31`, `lms.py:58`, `social.py:196,208,222`); migration `c1f55f2f9905:1084` confirms `courses.is_deleted` was created `nullable=True`. **A NULL there fails `is_deleted == False` filters, so those rows vanish from every list.**
`is_deleted` has **no `server_default` anywhere** (96 `nullable=False` with zero server_default) and `id` has **no `server_default`** in the initial migration (102 plain UUID columns, unlike later migrations which use `gen_random_uuid()`) — any raw INSERT outside the ORM fails.
`hostels`/`hostel_rooms`/`hostel_allocations` have **no `updated_at` at all**.

**P1-18 Model/migration divergence.** Single head `c7d9e1f3a5b2`, 32 revisions, single base — but **not linear**: 3 merge points, 2 of them empty no-ops, and `f2d4c7a9b001` is a merge that **also carries schema changes** (creates LMS tables), which is hard to bisect. Concrete mismatches: (1) `student_scholarships` model-only; (2) `faqs`+3 hostel tables migration-only; (3) **`designer_document_revisions.is_deleted` is in the model but NOT created by `c7d9e1f3a5b2`** → runtime `UndefinedColumn` on every insert; (4) `qr_pay` enum drift; (5) `online_exam_attempts` and `student_scholarships` have `school_id index=True` in the model with no `create_index` in any migration; (6) `students.embedding` is conditional on the pgvector import while the migration creates it unconditionally → if pgvector is missing the column exists in the DB but not the mapper.

**P1-19 Academic-year scoping — the fatal flaw, confirmed.** Only **4 tables** carry `academic_year_id` (`classes`, `exams`, `semesters`, `students`). Six more carry a **free-text `academic_year String(10)` with no FK** (`admission_forms`, `compliance_reports`, `emis_exports`, `fee_collections`, `fee_structures`, `timetables`). **144 tables have neither.**
Year-critical tables with no year dimension: `marks`, `report_cards`, `attendance`, `teacher_attendance`, `fee_receipts`, `sections`, `subjects`, `timetable_periods`, `timetable_slots`, `substitutions`, `assignments`, `assignment_submissions`, `book_transactions`, `book_issues`, `staff_payroll`, `leave_requests`, `student_progress`, `enrollments`, `quizzes`, `quiz_attempts`, `online_exams`, `online_exam_attempts`, `points_logs`, `student_badges`, `houses`, `student_transfers`, `expenses`, `incidents`, `pt_conferences`, `conference_slots`, `health_profiles`, `learning_paths`, `mastery_records`, `alumni`.
Concrete year-2 consequences: `subjects` is global per school, so grade-9 Science in 2081 and the revised 2082 syllabus are the **same row** — editing marks config rewrites history. `sections` are not year-scoped, so "Grade 10 A" is one row forever and promotion orphans last year's roll numbers. Attendance percentage over a student's life mixes years. Fee dues carry across years via a **string**, so `'2081-82'` vs `'2081/82'` vs `'2081-2082'` silently split a student's ledger. `students.academic_year` (String) coexists with `students.academic_year_id` (FK) — two sources of truth on one row.

**P1-20 Audit trail is a stub.** `audit_logs` exists (`compliance.py:35-47`) and is written from **exactly one place** — `website.py:408`, only for public contact-form submissions. Mark entry, fee collection, result publication, payroll approval, scholarship grants, and student deletion write nothing. **Zero tables have an `updated_by` column.** `marks` has `teacher_id`+`entered_by` but no `updated_by`/actor — **a changed grade is untraceable**. Missing `created_by` entirely on: `report_cards`, `fee_receipts`, `fee_structures`, `student_scholarships`, `fee_types`, `teacher_attendance`, `students`, `assets`, `alumni_donations`, `hostel_allocations`.

## P2 — normalization

**P2-21 ARRAY(UUID) as many-to-many — 31 columns, unjoinable and unenforceable.** The structurally wrong ones: **`subjects.class_ids` + `subjects.teacher_ids` (academic.py:118-119) are the entire subject↔class and subject↔teacher mapping** — no FK, no per-section teacher, no answer to "who teaches 10-B Maths". Also `streams.class_ids`, `exams.class_ids`/`subject_ids`, `notices.target_class_ids`, `bus_stops.student_ids`, `incidents.involved_student_ids`, `emergency_headcounts.missing_student_ids`, `drill_participations.missing_student_ids`.

**P2-22 87 JSONB columns; the ones that must be normalized:**
`fee_structures.fee_items` (the actual billable money, no FK to fee_types, cannot be aggregated in SQL) · `staff_payroll.allowances`/`deductions` (statutory PF/SSF/tax must be auditable line items) · `schools.{settings,website_config,ai_config,fee_config,exam_config,notification_config,social_ai_config,gamification_config,admission_config}` — **9 untyped config blobs on one row** · `online_exams.questions`/`quizzes.questions` (**correct answers in JSONB served to clients**; no per-question analytics) · attempt `answers` (no item analysis) · `admission_applications.form_data`/`documents` · `student_health_records.vaccination_records` (**duplicate of the `immunizations` table**) · `procurement_requests.items` (money again) · `scheme_grades.ranges` (**NEB grade boundaries drive every report card**) · `hub_posts.likes` (unbounded array, no per-user index) · `enrollments.completed_lessons` (duplicate of `student_progress`) · `users.permissions` (security-relevant, unvalidated) · `staff_appraisals.scores`/`goals`.
Genuinely document-shaped and fine as-is: designer canvas JSON, website page content/sections, biometric raw payloads, audit_log old/new values, AI metadata, import errors, learning-path steps, media_urls, tags.

**P2-23 Duplicate/competing table pairs — pick one.** `book_transactions` vs `book_issues` (circulation state split across two live tables with separate enums) · `mood_checkins` (PG enum) vs `mood_entries` (String) · `student_health_records` vs `health_profiles` · **`timetable_periods` vs `timetable_slots`** — two grids, and `substitutions.period_id` points only at the former **so substitutions are invisible to whichever surface reads slots** · `counselor_sessions` vs `counselor_notes` · `admission_leads` (enum) vs `admission_inquiries` (String) · `emergency_alerts(alert_type='drill')` vs `disaster_drills` · `incidents.escalated_*` columns duplicate `incident_escalations` with no invariant tying them.

**P2-24 Legacy alias columns with no CHECK keeping them consistent.** `exams.start_date`/`end_date` beside `start_date_ad`/`bs`; `exams.full_marks` "alias for total_marks"; `marks.obtained_marks` "Legacy"; `report_cards.percentage` + `rank` aliases; `lessons.duration_mins` AND `duration_minutes`; `courses.teacher_id` (NN) + `instructor_id`; `managed_files.folder` (String) + `folder_id` (FK). Every reader must guess which is authoritative.

**P2-25 UUID columns with no FK:** `ai_usage_logs.user_id`, `designer_document_revisions.document_id` (model has no FK; only the migration adds one), `designer_document_revisions.created_by_id`, `designer_documents.created_by_id` (**NOT NULL pointing nowhere**), `designer_templates.school_id`, `iemis_import_logs.imported_by`, `school_websites.active_theme_version_id`.

**P2-26** `wellbeing.py:110-111` declares `counselor = relationship("User")` **twice** — the second silently overwrites the first.

**P2-27 Denormalized counters with no invariant or recompute job:** `schools.{total_students,total_staff,total_revenue_ytd,fee_collection_rate}`, `books.available_copies`, `hub_groups.member_count`, `admission_forms.filled_seats`, `courses.total_lessons`, `houses.total_points`, `students.{total_points,current_streak}`, `website_forms.submissions_count`. The `GroupMember` docstring explicitly records that `member_count` was "a dead counter nothing incremented" before E195 — the others were never audited.

**P3-29** `plugin_usage_logs.usage_date` uses `func.current_date()` — server-side but timezone-naive against Asia/Kathmandu, so usage crossing 18:15 UTC lands in the wrong Nepali day.
**P3-30** `social_accounts.access_token` and 5 `schools.*_token` columns are plaintext `Text`.
**P3-32** `substitutions.date = Column(String(10))` — a date stored as text, unrangeable.

## Domain gaps (C-series) — what a real Nepali school needs and does not have

### P0 — cannot operate a full year without these
**C-1 Term/exam weighting.** `semesters` exists but nothing links a term to exams or to a weighted final result. Need `terms(school,year,name,sequence,dates,weight_pct)`, `exams.term_id`, `term_result_policy(school,class,term,exam_weight,internal_weight,practical_weight)`.
**C-2 Class-subject mapping + optional/elective.** `subjects.class_ids` ARRAY + `subject_type` String is the entire model. Cannot express "Grade 9 offers Computer *or* Population", no per-student election, no subject group. **Without `student_subjects`, a marksheet cannot know which subjects a given student takes — every student in a class implicitly takes everything in the array.** Need `subject_groups`, `class_subjects`, `student_subjects`.
**C-3 Streams for 11-12 are decorative.** Not tied to subject offerings; `classes.stream_id` forces "Grade 11 Science" to be a separate Class row from "Grade 11 Management", duplicating the grade.
**C-4 Section-wise subject teachers.** Only `subjects.teacher_ids` ARRAY. Blocks teacher workload reports, mark-entry authorization, and the teacher app's subject list.
**C-5 Internal assessment / CAS marks.** `marks` has theory + practical only. NEB requires internal assessment (25% at secondary) recorded separately, and CAS at basic level.
**C-6 Exam seating plan + invigilation duty.** Nothing at all. A 2000-student SEE mock needs room allocation and duty rosters.
**C-7 NEB/SEE board registration and symbol numbers.** `exams.exam_type` includes `see_mock`/`board_trial` but there is **no symbol number, no registration number, no board-exam registry**. Every grade-10 and grade-12 student in Nepal has both, and the school files the registration.
**C-8 Grace marks, re-exam, supplementary.** `grep grace|supplementary|re_exam` → 0. Nepali schools routinely award grace to a policy cap and run supplementary exams.
**C-9 Certificate issuance registry.** `students.character_cert_url` is a single URL field. Character/transfer/migration/transcript certificates are **serially numbered legal documents** that must be reproducible and verifiable years later.
**C-10 Fee heads with installments, late-fee rules, concession policy.** All of it lives in one JSONB. No installment schedule, no late-fee rule table (the fine is a bare Numeric on the collection), and `student_scholarships` is a flat percent/fixed discount with no type, no sponsor, no approval — and no migration.
**C-11 Refunds and deposits.** No refund table at all; `alumni_donations.status` has a `refunded` value with nothing behind it. Security/lab/library deposits are standard.
**C-12 Real staff records.** `models/staff.py:5` is literally `Staff = User`. **No employee code, joining date, designation, qualification, contract type, salary grade, PF/SSF number, PAN, bank account, or teaching licence.** Yet `staff_payroll` computes salaries against it, and the IEMIS importer already parses Designation/Level/Appointment Status/Teaching Subject at `iemis_importer.py:87-100` **and discards them**.

### P1 — needed within the first year
**C-13** substitution `date` is a String, points only at `timetable_periods`, no free-teacher search, no substitute pay linkage.
**C-14** `student_transfers` has 5 business columns, no year scoping, no TC serial number, no destination IEMIS code, no dues-cleared flag.
**C-15 Sibling linkage — `grep sibling` → 0.** Sibling discount is the most common concession in Nepal, and parent apps must show all children under one login. A `families` table also gives one billing account per family.
**C-16** Guardian model has no legal-guardian vs contact distinction, no custody arrangement, no per-guardian comms/portal preference.
**C-17 House system has no membership.** `houses` has `captain_id` and a `total_points` counter but **no `students.house_id`** and no membership table — it cannot award or total anything.
**C-18** No lightweight merit/demerit behaviour ledger, no detention/suspension register.
**C-19** `hub_groups.group_type` includes `'club'` — that is the entire co-curricular model. No activity registry, team, fixture, result, or participation certificate.
**C-20** No staff training record; Nepal's TPD/licensing cycle requires documented hours.
**C-21 Leave policy and accrual.** Two overlapping request tables with a String type and **no entitlement, no balance, no carry-forward, no encashment**. Also `schools.working_days ARRAY(String)` is the only holiday model, so **attendance percentage counts festival days as absences**.
**C-22** `counselor_notes.is_confidential` is a boolean with no ACL, no access log, no retention rule — case notes on a minor need provable restriction.
**C-23** `books` tracks copies as integers with no per-copy row (a specific lost copy is untrackable), `isbn`/`barcode` non-unique, no accession register (**legally required in Nepal**), no reservation queue, `fine_paid Boolean` with no waiver actor.
**C-24** `routes.distance_km` but **no fare**; `students.transport_enrolled Boolean` + `bus_stop_id` is the whole enrollment model, disconnected from fees.
**C-25** biometric is well-modelled but there is **no `students.biometric_id`/`rfid_card_number`** — the device↔student mapping lives only in the device.
**C-26** `visitors.badge_number` not unique; no gate pass for early leave, no vehicle log.
**C-27** `assets.depreciation_rate` with no depreciation run, no book-value history, no disposal record; `expenses` has no budget to compare against.
**C-28** `procurement_requests` is one flat row with `items JSONB` — no vendor master, no quotation comparison, no PO, no goods-receipt note, no invoice matching (all required by Nepali public-procurement practice for community schools).
**C-29 IEMIS field set is a fraction of the real form.** The importer maps 16 student + 22 school columns, but **`Student` has no `iemis_student_id` column at all** — the importer stuffs the EMIS id into `students.student_id` (`iemis_importer.py:526`), **colliding with the school's own roll identifier**. `School` has no `iemis_code`/`see_code`/`hseb_code` despite parsing them. Staff columns parsed and dropped entirely.
**C-30** `compliance_reports` is `report_type String` + `data JSONB`. Flash I/II/III have a fixed enrollment-by-grade-by-gender-by-caste matrix that must be reproducible and diffable.
**C-31** PT conference tables have no `academic_year_id`, no teacher availability window, no bulk slot generation, no attendance record, and `is_booked Boolean` with no UQ **so double-booking is possible**.
**C-32** Admission has `test_score`/`interview_score`/`merit_rank` and a `waitlisted` status but **no test event, no seat assignment, no published merit-list snapshot, no waitlist position or offer expiry**.
**C-33** `managed_files` is polymorphic with no expiry, no required-document checklist, no verification state. Schools must hold birth certificates, guardian citizenship, previous marksheets, TCs, vaccination cards — and chase the missing ones.

### P2
**C-34** No mess plan / meal attendance / canteen wallet (`hostel_rooms.monthly_fee` is the only food money).
**C-35** No uniform/book sales inventory — real revenue with real stock in most private Nepali schools.
**C-36** `alumni_donations` has no campaign, pledge, recurring gift, or tax-exemption receipt.
**C-37** `immunizations` table competes with `student_health_records.vaccination_records` JSONB; no national-schedule reference so "who is due" needs hardcoded logic.
**C-38** Practical/theory split is on the wrong grain — `subjects.practical_full_marks` is a per-subject global, so a subject that is practical in grade 11 but theory-only in grade 9 cannot be expressed (solved by C-2's `class_subjects`).

## Best-modelled table in the repo
`biometric_punches` (`biometric.py:79`) — two unique indexes plus a `(school_id, status)` index. Use it as the reference for what the rest should look like.

## Fix ordering (from the agent)
1. `student_scholarships` migration + `models/__init__` imports + `designer_document_revisions.is_deleted` + `qr_pay` enum — **these are live 500s**.
2. Unique constraints on `marks`, receipt numbers, student identity, `staff_payroll`.
3. **`academic_year_id` rollout across the 34 year-critical tables — do this before the school's second year exists, because backfilling later requires guessing.**
4. TIMESTAMPTZ conversion + `utcnow` removal.
5. FK indexes + the 12 composites.
6. FK `ondelete` + cascade soft-delete.
7. Normalize `fee_structures.fee_items` and `subjects.class_ids`/`teacher_ids` (prerequisite for C-2, C-4, C-10).
8. Enum/CHECK sweep on money and lifecycle states.
9. Audit-trail event listener + `created_by`/`updated_by`.
10. Domain gaps C-1 → C-12, then C-13 → C-33 as modules ship.
