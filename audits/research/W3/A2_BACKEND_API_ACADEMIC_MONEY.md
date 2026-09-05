# W3-A2 — Backend API Audit, Part 1: Academic + Money Core

Audit date: 2026-09-05 · Scope: read-only source review · Repo root: `/home/bishal-regmi/Desktop/ASchool`
Every claim below carries a `file:line` reference. Paths are relative to the repo root unless absolute.

## 0. Method & global facts

Read in full: `backend/app/api/v1/{__init__,academics,exams,fees,students,attendance,timetable,reports,analytics,assignments,hr_payroll,compliance,iemis_importer,webhooks}.py`, `backend/app/api/webhooks/__init__.py`, `backend/app/services/payments/{khalti,esewa,fonepay}_gateway.py` + `__init__.py`, `backend/app/utils/{nepal_grading,money,report_pdf,pagination,decorators,nepali_date}.py`, `backend/app/services/ai/timetable_solver.py`, `backend/app/services/compliance/moe_reports.py`, `backend/app/models/{fee,exam,attendance}.py`, `backend/app/tasks/{fee_reminders,report_generation}.py`, `backend/app/plugins/decorators.py`, `backend/app/__init__.py:370-560`.

Global mechanics that apply to every table row below, so they are stated once:

| Fact | Evidence |
|---|---|
| All v1 routes mount at `/api/v1` + blueprint `url_prefix` | `backend/app/__init__.py:523` |
| Payment/WhatsApp/Stripe webhooks mount at `/webhooks` (NOT under `/api/v1`) | `backend/app/__init__.py:528` |
| Plugin blueprints not statically listed are mounted by the loader at `/api/v1<bp.url_prefix>` | `backend/app/plugins/loader.py:349-350` |
| `fees`, `exams`, `attendance`, `basic_reports`, `timetable`, `assignments`, `hr_payroll`, `compliance` are loader-mounted plugin blueprints (manifest `api_blueprint`) | `app/plugins/modules/fees/manifest.yaml:11`, `.../exams/manifest.yaml:11`, `.../attendance/manifest.yaml:12`, `.../basic_reports/manifest.yaml:12`, `.../timetable/manifest.yaml:11`, `.../assignments/manifest.yaml:11`, `.../hr_payroll/manifest.yaml:11`, `.../compliance/manifest.yaml:11` |
| `academics`, `students`, `analytics`, `iemis_importer`, `webhooks_v1` are statically mounted (never double-registered) | `backend/app/api/v1/__init__.py:9-50,69-99` |
| `@school_required` only checks `g.school_id` truthiness → 400 otherwise | `backend/app/utils/decorators.py:33-49` |
| `@role_required(*roles)` reads `claims["role"]`, 403 on mismatch | `backend/app/utils/decorators.py:8-30` |
| `@plugin_required(slug)` checks `g.installed_plugins` with single-hop alias expansion; 403 with `install_url` | `backend/app/plugins/decorators.py:95-131`, aliases `:13-53` |
| Tenant context + cross-tenant 403 resolved in `before_request` (subdomain → `X-School-Slug` → JWT claim) | `backend/app/__init__.py:374-483` |
| Installed-plugin list is cached 300 s per school (stale gate window after uninstall) | `backend/app/__init__.py:488-517` |
| **Rate limiting: global default `60/minute` only. NOT ONE route in any audited file carries `@limiter.limit`.** The only per-route limits in the whole backend are 5 in `auth.py` and 3 in `website.py` | `backend/config.py:106,239`; `grep limiter.limit` → `app/api/v1/auth.py:140,159,175,191,283`, `app/api/v1/website.py:472,522,715` |
| `strict_slashes`: never set anywhere. Flask default applies — routes declared WITHOUT a trailing slash (e.g. `@exams_bp.route("")` → `/api/v1/exams`) 404 on `/api/v1/exams/`; routes WITH a trailing slash would 308-redirect. Because `""`-style routes dominate, `GET /api/v1/exams/` and `GET /api/v1/fees/collections/` are hard 404s | `grep -rn strict_slashes backend/app` → no hits; `app/api/v1/exams.py:217`, `app/api/v1/students.py:26`, `app/api/v1/assignments.py:33` |
| `paginate()` reads `page`/`per_page` (cap 100), no cursor mode | `backend/app/utils/pagination.py:5-30` |

Route counts (raw `_bp.route(` decorator count per file — a few functions carry two decorators, noted inline):

| File | Lines | Route decorators | Distinct endpoint functions |
|---|---|---|---|
| `backend/app/api/v1/academics.py` | 1056 | 37 | 37 |
| `backend/app/api/v1/exams.py` | 1988 | 25 | 25 |
| `backend/app/api/v1/fees.py` | 2882 | 33 | 33 |
| `backend/app/api/v1/students.py` | 1143 | 17 | 17 |
| `backend/app/api/v1/attendance.py` | 732 | 14 | 14 |
| `backend/app/api/v1/timetable.py` | 318 | 6 | 6 |
| `backend/app/api/v1/reports.py` | 732 | 7 | 7 |
| `backend/app/api/v1/analytics.py` | 652 | 6 | 6 |
| `backend/app/api/v1/assignments.py` | 449 | 10 | 10 |
| `backend/app/api/v1/hr_payroll.py` | 1434 | 25 | 23 (2 double-decorated: `leave_report` GET ×2; `PUT`+`DELETE` combos) |
| `backend/app/api/v1/compliance.py` | 259 | 8 | 8 |
| `backend/app/api/v1/iemis_importer.py` | 1237 | 6 | 6 |
| `backend/app/api/webhooks/__init__.py` | 896 | 6 | 6 |
| `backend/app/api/v1/webhooks.py` | 28 | 1 | 1 |
| **Total** | **13,806** | **201** | **~199** |

---

## 1. Complete endpoint catalog

Legend: `JWT` = `@jwt_required()`; `SCH` = `@school_required`; `RR(...)` = `@role_required(...)`; `PR(x)` = `@plugin_required("x")`; `SA` = `@superadmin_required`. **Rate limit column is omitted from every table because it is uniformly the global `60/minute` default — no audited route declares `@limiter.limit` (`backend/config.py:106`).** Trailing-slash behaviour is uniform: `strict_slashes` is never set in any audited file (only `app/api/v1/files.py:231` uses it), so `""`-rooted routes are exact-match and `/api/v1/<res>/` returns 404.

### 1.1 `backend/app/api/v1/academics.py` — `academics_bp`, prefix `/academics` (static mount, **no plugin gate at all**)

| METHOD | Path | Function | Line | Auth | Role gate | Body | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/academics/years` | `list_academic_years` | 36 | JWT+SCH | — (any role) | — | `[_year_dict]`+`meta.pagination` | — |
| POST | `/academics/years` | `create_academic_year` | 46 | JWT+SCH | RR(superadmin, school_admin) | `name,name_nepali,start_date_bs,end_date_bs,is_current,start_date_ad|start_date,end_date_ad|end_date` | `_year_dict` 201 | `academic_years` (+bulk `is_current=False` :63) |
| PUT | `/academics/years/<uuid:year_id>` | `update_academic_year` | 69 | JWT+SCH | RR(superadmin, school_admin) | same as POST | `_year_dict` | `academic_years` |
| DELETE | `/academics/years/<uuid:year_id>` | `delete_academic_year` | 99 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `academic_years.is_deleted` |
| GET | `/academics/semesters` | `list_semesters` | 115 | JWT+SCH | — | `?academic_year_id` | `[_semester_dict]`+pagination | — |
| POST | `/academics/semesters` | `create_semester` | 130 | JWT+SCH | RR(superadmin, school_admin) | `name,name_nepali,start/end_date_bs,sort_order,is_current,academic_year_id,start/end_date[_ad]` | `_semester_dict` 201 | `semesters` |
| PUT | `/academics/semesters/<uuid:semester_id>` | `update_semester` | 145 | JWT+SCH | RR(superadmin, school_admin) | as POST | `_semester_dict` | `semesters` |
| DELETE | `/academics/semesters/<uuid:semester_id>` | `delete_semester` | 164 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `semesters.is_deleted` |
| GET | `/academics/mediums` | `list_mediums` | 176 | JWT+SCH | — | — | `[_medium_dict]` (**no pagination**) | — |
| POST | `/academics/mediums` | `create_medium` | 184 | JWT+SCH | RR(superadmin, school_admin) | `name,name_nepali,code,is_default` | `_medium_dict` 201 | `mediums` |
| PUT | `/academics/mediums/<uuid:medium_id>` | `update_medium` | 199 | JWT+SCH | RR(superadmin, school_admin) | as POST | `_medium_dict` | `mediums` |
| DELETE | `/academics/mediums/<uuid:medium_id>` | `delete_medium` | 215 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `mediums.is_deleted` |
| GET | `/academics/streams` | `list_streams` | 227 | JWT+SCH | — | `?class_id` | `[_stream_dict]` | — |
| POST | `/academics/streams` | `create_stream` | 239 | JWT+SCH | RR(superadmin, school_admin) | `name,name_nepali,code,is_default,description,class_ids[]|class_id` | `_stream_dict` 201 | `streams` |
| PUT | `/academics/streams/<uuid:stream_id>` | `update_stream` | 254 | JWT+SCH | RR(superadmin, school_admin) | as POST | `_stream_dict` | `streams` |
| DELETE | `/academics/streams/<uuid:stream_id>` | `delete_stream` | 270 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `streams.is_deleted` |
| GET | `/academics/shifts` | `list_shifts` | 282 | JWT+SCH | — | — | `[_shift_dict]` | — |
| POST | `/academics/shifts` | `create_shift` | 290 | JWT+SCH | RR(superadmin, school_admin) | `name,name_nepali,is_default,start_time,end_time` | `_shift_dict` 201 | `shifts` |
| PUT | `/academics/shifts/<uuid:shift_id>` | `update_shift` | 305 | JWT+SCH | RR(superadmin, school_admin) | as POST | `_shift_dict` | `shifts` |
| DELETE | `/academics/shifts/<uuid:shift_id>` | `delete_shift` | 321 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `shifts.is_deleted` |
| GET | `/academics/classes` | `list_classes` | 333 | JWT+SCH | — (teacher auto-scoped :338-343) | `?academic_year_id,medium_id,stream_id` | `[_class_dict]` (nested sections) + pagination | — |
| POST | `/academics/classes` | `create_class` | 357 | JWT+SCH | RR(superadmin, school_admin) | `name,name_nepali,sort_order,numeric_grade|grade_number,academic_year_id,medium_id,stream_id,initial_section_name,initial_section_capacity` | `_class_dict` 201 | `classes`, `sections` (:379) |
| PUT | `/academics/classes/<uuid:class_id>` | `update_class` | 392 | JWT+SCH | RR(superadmin, school_admin) | as POST minus initial_* | `_class_dict` | `classes` |
| DELETE | `/academics/classes/<uuid:class_id>` | `delete_class` | 409 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `classes.is_deleted` |
| GET | `/academics/classes/<uuid:class_id>/sections` | `list_sections` | 424 | JWT+SCH | — (teacher scoped :428) | — | `[_section_dict]` | — |
| POST | `/academics/classes/<uuid:class_id>/sections` | `create_section` | 439 | JWT+SCH | RR(superadmin, school_admin) | `name,capacity,class_teacher_id,medium_id,shift_id` | `_section_dict` 201 | `sections` |
| PUT | `.../sections/<uuid:section_id>` | `update_section` | 463 | JWT+SCH | RR(superadmin, school_admin) | as POST | `_section_dict` | `sections` |
| DELETE | `.../sections/<uuid:section_id>` | `delete_section` | 492 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `sections.is_deleted` |
| GET | `/academics/subjects` | `list_subjects` | 513 | JWT+SCH | — (teacher scoped :532) | `?class_id,stream_id` | `[_subject_dict]`+pagination | — |
| POST | `/academics/subjects` | `create_subject` | 551 | JWT+SCH | RR(superadmin, school_admin) | `name*,code,credit_hours,has_practical,full_marks,pass_marks,practical_full_marks,practical_pass_marks,class_ids,teacher_ids,stream_id,subject_type|is_optional` | `_subject_dict` 201 | `subjects` |
| PUT | `/academics/subjects/<uuid:subject_id>` | `update_subject` | 566 | JWT+SCH | RR(superadmin, school_admin) | as POST | `_subject_dict` | `subjects` |
| DELETE | `/academics/subjects/<uuid:subject_id>` | `delete_subject` | 580 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | `subjects.is_deleted` |
| GET | `/academics/classes/<uuid:class_id>/subjects` | `list_class_subjects` | 593 | JWT+SCH | — (teacher scoped) | — | `[_subject_dict]` | — |
| POST | `/academics/classes/<uuid:class_id>/subjects` | `assign_subject_to_class` | 620 | JWT+SCH | RR(superadmin, school_admin) | `subject_id*` | `_subject_dict` 201 | `subjects.class_ids` |
| GET | `/academics/curriculum/frameworks` | `list_curriculum_frameworks` | 983 | JWT+SCH | — | `?grade,board,subject_code` | `[framework.to_dict]` | — |
| GET | `/academics/curriculum/frameworks/<uuid:framework_id>` | `get_curriculum_framework` | 1014 | JWT+SCH | — | — | framework + `units[].outcomes[]` | — |
| GET | `/academics/subject-offerings` | `list_subject_offerings` | 1039 | JWT+SCH | — | `?grade` | `[offering.to_dict]` | — |

Notes: (a) every write endpoint excludes `accountant`/`staff`/`teacher`; (b) **`academics` has no `@plugin_required` gate at all** — class/subject setup is core; (c) `_subject_dict` issues one `User.query.get` per subject (`academics.py:712`) → N+1 on `GET /academics/subjects`.

### 1.2 `backend/app/api/v1/exams.py` — `exams_bp`, prefix `/exams`, every route `PR("exams")`

| METHOD | Path | Function | Line | Auth | Role gate | Body / query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/exams/grade-table` | `get_grade_table` | 205 | JWT+SCH+PR | — | — | `GRADE_TABLE` (static NEB list) | — |
| GET | `/exams` | `list_exams` | 217 | JWT+SCH+PR | — (teacher scoped :238) | `?academic_year_id,exam_type,status(csv),class_id` | `[_exam_dict]`+pagination | — |
| GET | `/exams/online` | `list_online_exams` | 258 | JWT+SCH+PR | — (teacher scoped) | `?class_id,subject_id,status` | `[_online_exam_dict]` (no pagination) | — |
| POST | `/exams/online` | `create_online_exam` | 291 | JWT+SCH+PR | RR(school_admin, teacher) | `title|name,description,class_id,section_id,subject_id,duration_minutes,total_marks,total_questions,questions[],start_at,end_at,status,instructions` | `_online_exam_dict(include_questions)` 201 | `online_exams` |
| GET | `/exams/online/<uuid:online_exam_id>` | `get_online_exam` | 375 | JWT+SCH+PR | — | — | exam + **`questions` incl. `correct_answer`** | — |
| POST | `/exams/online/<uuid:online_exam_id>/submit` | `submit_online_exam` | 388 | JWT+SCH+PR | — | `student_id,answers{}` | attempt + `score` 201 | `online_exam_attempts` |
| POST | `/exams` | `create_exam` | 458 | JWT+SCH+PR | RR(school_admin) **only** | `name,name_nepali,academic_year_id,exam_type*,class_id,subject_ids[],start/end_date_bs/_ad,total_marks|full_marks,pass_marks,is_practical,practical_marks,description,instructions` | `_exam_dict` 201 | `exams` |
| GET | `/exams/<uuid:exam_id>` | `get_exam` | 498 | JWT+SCH+PR | — (teacher scoped) | — | `_exam_dict` | — |
| PUT | `/exams/<uuid:exam_id>` | `update_exam` | 526 | JWT+SCH+PR | RR(school_admin) | as POST + `status` | `_exam_dict` | `exams` |
| DELETE | `/exams/<uuid:exam_id>` | `delete_exam` | 560 | JWT+SCH+PR | RR(school_admin) | — | 204 | `exams.is_deleted` |
| GET | `/exams/<uuid:exam_id>/marks` | `list_marks` | 577 | JWT+SCH+PR | — (teacher scoped) | `?subject_id,class_id` | `class_id+subject_id` → roster-joined `[_student_mark_dict]`; else `[_marks_dict]`+pagination | — |
| POST | `/exams/<uuid:exam_id>/marks` | `submit_marks` | 638 | JWT+SCH+PR | RR(school_admin, teacher) | `subject_id,class_id,marks[{student_id,subject_id,class_id,theory_marks|marks,practical_marks,full_marks,pass_marks,remarks,is_absent}]` | `{total,new,updated}` | `marks` (upsert; 409 on IntegrityError :821) |
| GET | `/exams/<uuid:exam_id>/subjects` | `get_exam_subjects` | 845 | JWT+SCH+PR | — (teacher scoped) | `?class_id` | `[_subject_dict]` | — |
| GET | `/exams/results` | `list_student_results` | 882 | JWT+SCH+PR | — (student/parent auto-resolved) | `?student_id` | `[_student_result_from_report_card|_from_marks]` | — |
| GET | `/exams/<uuid:exam_id>/results` | `get_results` | 928 | JWT+SCH+PR | — (teacher class-gate) | `?class_id*` | per-student GPA/rank list | — |
| GET | `/exams/<uuid:exam_id>/grade-sheet` | `get_grade_sheet` | 1028 | JWT+SCH+PR | — (teacher class-gate) | `?class_id*` | matrix `{subjects[],rows[]}` | — |
| GET | `/exams/<uuid:exam_id>/marksheet/<uuid:student_id>` | `get_student_marksheet` | 1194 | JWT+SCH+PR | — (`_resolve_accessible_student`) | — | per-subject marksheet + rc fields | — |
| GET | `.../marksheet/<uuid:student_id>/html` | `get_student_marksheet_html` | 1297 | JWT+SCH+PR | — | `?template_id` | `{html,student_id,template_id}` | — |
| POST | `/exams/<uuid:exam_id>/designer-marksheet` | `generate_designer_marksheets` | 1340 | JWT+SCH+PR | RR(school_admin, teacher) + inline `design_studio` gate :1353 | `class_id*,template_id` | `{count,marksheets[]}` | — |
| POST | `/exams/<uuid:exam_id>/publish` | `publish_results` | 1391 | JWT+SCH+PR | RR(school_admin) | — | `{message,exam_id}` | `exams.status='result_published'` |
| GET | `/exams/<uuid:exam_id>/report-cards/<uuid:student_id>` | `get_report_card` | 1413 | JWT+SCH+PR | — | — | `_rc_dict` | — |
| GET | `/exams/<uuid:exam_id>/report-cards` | `list_report_cards` | 1431 | JWT+SCH+PR | — (teacher class-gate) | `?class_id` | `[_rc_dict + student_name]` | — |
| POST | `/exams/<uuid:exam_id>/report-cards` | `generate_report_cards` | 1468 | JWT+SCH+PR | RR(school_admin) | `class_id` | `{message,exam_id}` (Celery `.delay`) | `report_cards` (async) |
| GET | `/exams/<uuid:exam_id>/bulk-marksheet-pdf` | `bulk_marksheet_pdf` | 1487 | JWT+SCH+PR | RR(school_admin, teacher) | `?class_id*,template_id` | `application/pdf` stream (501 if no WeasyPrint) | — |
| GET | `/exams/<uuid:exam_id>/report-cards/bulk-pdf` | `bulk_report_cards_pdf` | 1555 | JWT+SCH+PR | RR(school_admin, teacher) | `?class_id*` | `application/pdf` | — |

### 1.3 `backend/app/api/v1/fees.py` — `fees_bp`, prefix `/fees`, every route `PR("fees")`

| METHOD | Path | Function | Line | Auth | Role gate | Body / query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/fees/types` | `list_fee_types` | 146 | JWT+SCH+PR | — | — | `[{id,name,description,is_system}]` or `DEFAULT_FEE_TYPES` | — |
| POST | `/fees/types` | `create_fee_type` | 174 | JWT+SCH+PR | RR(school_admin, accountant) | `name*,description` | 201 | `fee_types` |
| PUT | `/fees/types/<uuid:type_id>` | `update_fee_type` | 203 | JWT+SCH+PR | RR(school_admin, accountant) | `name,description` | dict | `fee_types` |
| DELETE | `/fees/types/<uuid:type_id>` | `delete_fee_type` | 230 | JWT+SCH+PR | RR(school_admin, accountant) | — | 204 | `fee_types.is_deleted` |
| GET | `/fees/payment-methods` | `get_payment_methods` | 253 | JWT+SCH+PR | — **(any role incl. student/parent)** | — | `{methods[](secret masked),enabled_methods,online_methods}` | — |
| PUT | `/fees/payment-methods` | `update_payment_methods` | 277 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `methods[{key,label,enabled,mode,requires_reference,supports_qr,qr_image_url,qr_payload,instructions,merchant_code,secret_key\|"***"}]` | masked methods | `schools.fee_config.payment_methods` |
| POST | `/fees/payment-methods/upload-qr` | `upload_qr_image` | 325 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | multipart `qr_image`,`method_key` | `{url,method_key}` | `schools.fee_config` |
| GET | `/fees/summary` | `get_fees_summary` | 387 | JWT+SCH+PR | — **(no role gate — students/parents see school-wide money)** | — | totals, `recent_payments[]`, `by_class[]` | — |
| GET | `/fees/recent` | `list_recent_fees` | 549 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `?limit≤100` | receipts list | — |
| GET | `/fees/outstanding` | `list_outstanding_fees` | 583 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `?limit≤200,class_id` | dues list | — |
| GET | `/fees/structures` | `list_fee_structures` | 632 | JWT+SCH+PR | — | `?class_id,academic_year[_id]` | `[_structure_dict]`+pagination | — |
| POST | `/fees/structures` | `create_fee_structure` | 653 | JWT+SCH+PR | RR(school_admin, accountant) | `name,fee_type,class_id,academic_year[_id],fee_items[],total_annual,total_monthly,amount|total_amount,frequency,due_day,is_optional` | `_structure_dict + applied_summary` 201 | `fee_structures` **+ immediately `fee_collections` via `_apply_fee_structure` :715** |
| POST | `/fees/structures/<uuid:structure_id>/apply` | `apply_fee_structure` | 721 | JWT+SCH+PR | RR(school_admin, accountant) | — | structure + summary | `fee_collections` |
| POST | `/fees/batch-monthly` | `batch_monthly_billing` | 742 | JWT+SCH+PR | RR(school_admin, accountant) | `class_id` | aggregate counts | `fee_collections` |
| GET | `/fees/scholarships` | `list_scholarships` | 794 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `?student_id` | `[_scholarship_dict]`+pagination | — |
| POST | `/fees/scholarships` | `create_scholarship` | 811 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `student_id*,fee_type,discount_type(percent|fixed),discount_value,reason,valid_from_bs,valid_until_bs,is_active` | 201 | `student_scholarships` |
| PUT/PATCH | `/fees/scholarships/<uuid:scholarship_id>` | `update_scholarship` | 856 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | subset | dict | `student_scholarships` |
| DELETE | `/fees/scholarships/<uuid:scholarship_id>` | `delete_scholarship` | 891 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | — | 204 | soft-delete |
| DELETE | `/fees/structures/<uuid:structure_id>` | `delete_fee_structure` | 928 | JWT+SCH+PR | RR(school_admin, accountant) | — | 204 | soft-delete |
| GET | `/fees/collections` | `list_collections` | 1019 | JWT+SCH+PR | — **(no role gate)** | `?student_id,class_id,section_id,search,status,from|start_date,to|end_date` | `[_collection_dict]`+pagination | — |
| GET | `/fees/collections/export` | `export_collections_csv` | 1032 | JWT+SCH+PR | — **(no role gate — CSV of the whole school's ledger)** | same filters | `text/csv` (BOM) | — |
| GET | `/fees/defaulters` | `list_defaulters` | 1117 | JWT+SCH+PR | RR(school_admin, accountant) | — | grouped dues incl. **parent phone/email** | — |
| POST | `/fees/defaulters/<uuid:student_id>/remind` | `remind_defaulter` | 1168 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | — | `{sent,channel,phone,amount}` | SMS queue (`sms_logs` downstream) |
| POST | `/fees/collections` | `create_collection` | 1211 | JWT+SCH+PR | RR(school_admin, accountant) | `student_id*,fee_item_name|fee_type*,amount|total_amount,late_fine_amount,discount_amount,is_scholarship,paid_amount,payment_status|status,academic_year,month_bs,year_bs,payment_method,transaction_id,notes` | `_collection_dict` 201 | `fee_collections` |
| PUT | `/fees/collections/<uuid:collection_id>` | `update_collection` | 1288 | JWT+SCH+PR | RR(school_admin, accountant) | subset of POST | `_collection_dict` | `fee_collections` |
| POST | `/fees/collections/<uuid:collection_id>/pay` | `record_payment` | 1355 | JWT+SCH+PR | RR(school_admin, accountant) | `amount*,payment_method,transaction_id,payment_date,idempotency_key` | `{collection,receipt,receipt_id}` | `fee_collections`, `fee_receipts`, `school_receipt_counters` |
| GET | `/fees/collections/<uuid:collection_id>/receipt` | `get_collection_receipt` | 1498 | JWT+SCH+PR | — | — | `_receipt_dict` | — |
| GET | `/fees/receipts/<uuid:receipt_id>` | `get_receipt` | 1518 | JWT+SCH+PR | — | — | `_receipt_dict` | — |
| GET | `/fees/receipts/<uuid:receipt_id>/pdf` | `download_receipt_pdf` | 1534 | JWT+SCH+PR | — | — | `application/pdf` (501 no WeasyPrint) | — |
| GET | `/fees/students/<uuid:student_id>/statement/pdf` | `download_student_statement_pdf` | 1570 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | — | `application/pdf` ledger | — |
| POST | `/fees/collections/<uuid:collection_id>/pay-online` | `initiate_online_payment` | 1758 | JWT+SCH+PR | — **(any role; parent-facing)** | `provider|gateway,return_url` | provider payload | `payment_initiations` |
| POST | `/fees/initiate-payment` | `initiate_parent_payment` | 1767 | JWT+SCH+PR | — | `fee_ids[1]`,`provider`,`return_url` | provider payload | `payment_initiations` |
| POST | `/fees/collections/<uuid:collection_id>/refund` | `refund_payment` | 1897 | JWT+SCH+PR | RR(superadmin, school_admin) | `reason*` | `{collection_id,refund_id,refund}` | `fee_refunds`, `fee_collections.payment_status='refunded'` |

### 1.4 `backend/app/api/v1/students.py` — `students_bp`, prefix `/students` (static, **no plugin gate**)

| METHOD | Path | Function | Line | Auth | Role gate | Body / query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/students` | `list_students` | 26 | JWT+SCH | — (teacher scoped :33) | `?user_id,guardian_user_id,class_id,section_id,academic_year_id,status,gender,grade,search` | `[Student.to_dict]`+pagination | — |
| GET | `/students/<uuid:student_id>` | `get_student` | 88 | JWT+SCH | — (teacher scoped) | — | student + `guardians[]` | — |
| POST | `/students` | `create_student` | 115 | JWT+SCH | RR(superadmin, school_admin, staff) | `first_name*,last_name*,class_id*,roll_number,section_id,…,password,phone,email,guardians[]` | student 201 | `students`, `users`, `guardians`, `schools` (number lock) |
| PUT | `/students/<uuid:student_id>` | `update_student` | 192 | JWT+SCH | RR(superadmin, school_admin, teacher, staff) | student fields + `password,phone,email` | student | `students`, `users` |
| DELETE | `/students/<uuid:student_id>` | `delete_student` | 235 | JWT+SCH | RR(superadmin, school_admin) | — | 204 | soft-delete |
| POST | `/students/bulk-delete` | `bulk_delete_students` | 248 | JWT+SCH | RR(superadmin, school_admin) | `ids[]` | `{deleted}` | soft-delete N |
| POST | `/students/batch-roll-numbers` | `batch_roll_numbers` | 268 | JWT+SCH | RR(superadmin, school_admin, staff, teacher) | `updates[{student_id,roll_number}]` | `{updated}` | `students.roll_number` |
| POST | `/students/bulk-profile-images` | `bulk_profile_images` | 305 | JWT+SCH | RR(superadmin, school_admin) | multipart `file` (.zip) | `{total,updated,skipped,details}` | `students.photo_url` + uploads |
| GET | `/students/promote/preview` | `promote_preview` | 545 | JWT+SCH | RR(superadmin, school_admin) | `?from_class_id*,to_class_id*` | students, conflicts, mappings | — |
| POST | `/students/promote` | `promote_students` | 660 | JWT+SCH | RR(superadmin, school_admin) | `from_class_id*,to_class_id*,academic_year_id,roll_strategy(keep|renumber),student_ids[]` | promoted/skipped/conflicts | `students.class_id/section_id/academic_year_id/roll_number` |
| POST | `/students/bulk-reset-passwords` | `bulk_reset_passwords` | 811 | JWT+SCH | RR(superadmin, school_admin) | `student_ids[]` | **cleartext passwords list** | `users.password_hash` |
| GET | `/students/transfers` | `list_transfers` | 858 | JWT+SCH | RR(superadmin, school_admin, staff) | `?search` | `[_transfer_dict]`+pagination | — |
| POST | `/students/transfers` | `create_transfer` | 886 | JWT+SCH | RR(superadmin, school_admin) | `student_id*,transfer_type(tc|withdrawal|migration),reason,destination_school` | `_transfer_dict` 201 | `student_transfers`, `students.status='transferred_out'` |
| GET | `/students/<uuid:student_id>/guardians` | `list_guardians` | 947 | JWT+SCH | — | — | `[_guardian_dict]` | — |
| POST | `/students/<uuid:student_id>/guardians` | `add_guardian` | 959 | JWT+SCH | RR(superadmin, school_admin, staff) | guardian fields | 201 | `guardians`, possibly `users` (parent) |
| PATCH | `.../guardians/<uuid:guardian_id>` | `update_guardian` | 980 | JWT+SCH | RR(superadmin, school_admin, staff) | guardian fields | dict | `guardians` |
| DELETE | `.../guardians/<uuid:guardian_id>` | `delete_guardian` | 1021 | JWT+SCH | RR(superadmin, school_admin) | — | `{id,deleted}` | `guardians.is_deleted` |

### 1.5 `backend/app/api/v1/attendance.py` — `attendance_bp`, prefix `/attendance`, every route `PR("attendance")`

| METHOD | Path | Function | Line | Auth | Role gate | Body / query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| POST | `/attendance/mark` | `mark_attendance` | 22 | JWT+SCH+PR | RR(school_admin, teacher) | `date,class_id,section_id,records[{student_id*,status,class_id,section_id,remarks}]` | `{date,total_marked,new_records,updated_records}` | `attendance` (upsert incl. tombstones :124) |
| POST | `/attendance/submit` | `submit_attendance_compat` | 168 | JWT+SCH+PR | RR(school_admin, teacher) | same | same (delegates :175) | `attendance` |
| GET | `/attendance/students/<class_id>` | `list_students_for_attendance` | 178 | JWT+SCH+PR | RR(school_admin, teacher) | `?section_id` | roster | — |
| GET | `/attendance/student/<student_id>` | `list_student_attendance` | 213 | JWT+SCH+PR | — **(any role, no ownership check → any student can read a classmate's history)** | `?year,month` | `[_att_dict]` | — |
| GET | `/attendance/student/<student_id>/summary` | `student_attendance_summary` | 232 | JWT+SCH+PR | — **(same gap)** | — | counts + percentage | — |
| GET | `/attendance/list` | `list_attendance` | 260 | JWT+SCH+PR | — (teacher scoped) | `?date,class_id,section_id,student_id,status` | `[_att_dict]`+pagination | — |
| GET | `/attendance/summary` | `attendance_summary` | 305 | JWT+SCH+PR | — (teacher scoped) | `?date,class_id*` | day summary + `attendance_rate` | — |
| GET | `/attendance/school-overview` | `school_attendance_overview` | 358 | JWT+SCH+PR | RR(school_admin) | — | `{summary{today/week/month_pct},class_wise[]}` | — |
| POST | `/attendance/teachers/mark` | `mark_teacher_attendance` | 440 | JWT+SCH+PR | RR(school_admin) | `date,records[{user_id*,status,check_in_time,check_out_time}]` | `{date,total_marked}` | `teacher_attendance` |
| GET | `/attendance/teachers/list` | `list_teacher_attendance` | 507 | JWT+SCH+PR | RR(school_admin) | `?date,user_id` | `[_teacher_att_dict]`+pagination | — |
| GET | `/attendance/leave-requests` | `list_leave_requests` | 533 | JWT+SCH+PR | — **(any role sees every staff leave)** | `?status` | `[_leave_dict]`+pagination | — |
| POST | `/attendance/leave-requests` | `create_leave_request` | 550 | JWT+SCH+PR | — (any role, `user_id` defaults to caller) | `start_date*,end_date*,leave_type,reason,user_id` | `_leave_dict` 201 | `leave_requests` |
| POST | `/attendance/leave-requests/<uuid:request_id>/approve` | `approve_leave_request` | 586 | JWT+SCH+PR | RR(school_admin, teacher) | — | `_leave_dict` | `leave_requests`, `teacher_attendance` (write-through :614-637) |
| POST | `/attendance/leave-requests/<uuid:request_id>/reject` | `reject_leave_request` | 640 | JWT+SCH+PR | RR(school_admin, teacher) | `rejection_reason|reason` | `_leave_dict` | `leave_requests` |

### 1.6 `backend/app/api/v1/timetable.py` — `timetable_bp`, prefix `/timetable`, every route `PR("timetable")`

| METHOD | Path | Function | Line | Auth | Role gate | Body / query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/timetable` | `get_timetable` | 20 | JWT+SCH+PR | — **(no teacher scoping at all)** | `?class_id,section_id,teacher_id,day` | `[_slot_dict]` (unpaginated) | — |
| GET | `/timetable/teacher/<teacher_id>` | `get_teacher_timetable_compat` | 46 | JWT+SCH+PR | — | — | `[_slot_dict]` | — |
| POST | `/timetable/generate` | `generate_timetable` | 59 | JWT+SCH+PR | RR(superadmin, school_admin) | `academic_year_id,days[],periods_per_day,period_duration,start_time` | generated plan (**not persisted**) | — |
| POST | `/timetable/save` | `save_timetable` | 80 | JWT+SCH+PR | RR(superadmin, school_admin) | `{classes:[{class_id,section_id,slots[]}]}` | `{saved_slots}` | `timetable_slots` (hard `DELETE` then insert :107) |
| POST | `/timetable/slots` | `create_slot` | 113 | JWT+SCH+PR | RR(superadmin, school_admin) | `class_id*,day_of_week*,period_number*,section_id,subject_id,teacher_id,start_time,end_time,room` | `_slot_dict` 201 / 409 clash | `timetable_slots` |
| DELETE | `/timetable/slots/<slot_id>` | `delete_slot` | 249 | JWT+SCH+PR | RR(superadmin, school_admin) | — | `{deleted:true}` | hard delete |

### 1.7 `backend/app/api/v1/reports.py` — `reports_bp`, prefix `/reports`, every route `PR("basic_reports")`

| METHOD | Path | Function | Line | Auth | Role gate | Query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/reports/attendance/summary` | `attendance_report` | 259 | JWT+SCH+PR | RR(school_admin, teacher) | `start_date*,end_date,class_id` | summary + `students[]` + headline | — |
| GET | `/reports/fees/collection` | `fee_collection_report` | 377 | JWT+SCH+PR | RR(school_admin, accountant) | `start_date*,end_date` | totals | — |
| GET | `/reports/exams/results` | `exam_results_report` | 411 | JWT+SCH+PR | RR(school_admin, teacher) | `exam_id*,class_id` | per-subject stats | — |
| GET | `/reports/dashboard` | `dashboard_report` | 434 | JWT+SCH+PR | RR(school_admin) | — | students/attendance/monthly fee | — |
| GET | `/reports/attendance/summary/pdf` | `attendance_report_pdf` | 489 | JWT+SCH+PR | RR(school_admin, teacher) | as JSON | `{pdf_url,filename,size_bytes,period}` (501 no WeasyPrint) | uploads (`reports/<school_id>/…`) |
| GET | `/reports/fees/collection/pdf` | `fee_collection_report_pdf` | 581 | JWT+SCH+PR | RR(school_admin, accountant) | as JSON | `{pdf_url,…}` | uploads |
| GET | `/reports/exams/results/pdf` | `exam_results_report_pdf` | 664 | JWT+SCH+PR | RR(school_admin, teacher) | as JSON | `{pdf_url,…}` | uploads |

### 1.8 `backend/app/api/v1/analytics.py` — `analytics_bp`, prefix `/analytics` (static, **no plugin gate**)

| METHOD | Path | Function | Line | Auth | Role gate | Query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/analytics/overview` | `overview` | 288 | JWT+SCH | RR(school_admin, teacher, accountant) | — | full overview payload (cached 300 s :298) | cache only |
| GET | `/analytics/academic` | `academic` | 302 | JWT+SCH | RR(school_admin, teacher) | `?exam_id` | class/subject/at-risk | — |
| GET | `/analytics/financial` | `financial` | 403 | JWT+SCH | RR(school_admin, accountant) | `?period(monthly\|quarterly\|yearly)` | revenue/collected/outstanding + trends | — |
| GET | `/analytics/benchmarking` | `benchmarking` | 479 | JWT+SCH | RR(school_admin, teacher) | — | own vs district vs national | — |
| GET | `/analytics/teacher-dashboard` | `teacher_dashboard` | 524 | JWT+SCH | RR(teacher, school_admin) | — | stats/schedule/notices | — |
| GET | `/analytics/superadmin-dashboard` | `superadmin_dashboard` | 590 | SA only (**no `@jwt_required()`; `superadmin_required` verifies internally** :591) | superadmin | — | platform stats | — |

### 1.9 `backend/app/api/v1/assignments.py` — `assignments_bp`, prefix `/assignments`, every route `PR("assignments")`

| METHOD | Path | Function | Line | Auth | Role gate | Body / query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/assignments` | `list_assignments` | 33 | JWT+SCH+PR | — (**no teacher/student scoping**) | `?class_id,subject_id` | `[_assignment_dict]`+pagination | — |
| POST | `/assignments` | `create_assignment` | 50 | JWT+SCH+PR | RR(superadmin, school_admin, teacher) | `class_id*,subject_id*,title,description,section_id,due_date,total_marks|max_marks,attachment_urls[]|attachment_url` | `_assignment_dict` 201 | `assignments` |
| GET | `/assignments/<assignment_id>` | `get_assignment` | 106 | JWT+SCH+PR | — | — | `_assignment_dict` | — |
| PUT | `/assignments/<assignment_id>` | `update_assignment` | 122 | JWT+SCH+PR | RR(superadmin, school_admin, teacher) | `title,description,total_marks,due_date,attachment_urls` | dict | `assignments` |
| DELETE | `/assignments/<assignment_id>` | `delete_assignment` | 148 | JWT+SCH+PR | RR(superadmin, school_admin) | — | 204 | `assignments.is_deleted` |
| GET | `/assignments/<assignment_id>/submissions` | `list_submissions` | 169 | JWT+SCH+PR | — **(students can read classmates' submissions)** | — | `[_submission_dict]`+pagination | — |
| POST | `/assignments/<assignment_id>/submit` | `submit_assignment` | 195 | JWT+SCH+PR | — (student self-check :207) | `student_id,content|remarks|note,attachment_urls[]|file_url` | `_submission_dict` 201 | `assignment_submissions` |
| POST | `/assignments/<assignment_id>/submissions/<sub_id>/grade` | `grade_submission` | 262 | JWT+SCH+PR | RR(superadmin, school_admin, teacher) | `marks|marks_obtained,feedback` | dict | `assignment_submissions` |
| POST | `/assignments/submissions/<sub_id>/grade` | `grade_submission_compat` | 291 | JWT+SCH+PR | RR(superadmin, school_admin, teacher) | same | dict | `assignment_submissions` |
| POST | `/assignments/<assignment_id>/ai-grade` | `ai_grade_submission` | 316 | JWT+SCH+PR | RR(superadmin, school_admin, teacher) | `submission_id*,subject` | AI grade payload (**not persisted**) | — |

### 1.10 `backend/app/api/v1/hr_payroll.py` — `hr_payroll_bp`, prefix `/hr`, every route `PR("hr_payroll")`

| METHOD | Path | Function | Line | Auth | Role gate | Body / query | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/hr/stats` | `hr_stats` | 25 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | — | staff/leaves/payroll/rating/monthly | — |
| GET | `/hr/payroll` | `list_payroll` | 86 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `?month,status` | `[_payroll_dict]`+pagination | — |
| POST | `/hr/payroll` | `create_payroll` | 105 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `user_id*,month*,basic_salary*,allowances{},deductions{},gross_salary,net_salary,payment_method,notes` | 201 | `staff_payroll` |
| POST | `/hr/payroll/generate` | `generate_payroll` | 178 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `month*` | `{created,month}` | `staff_payroll` (draft rows) |
| PUT | `/hr/payroll/<uuid:payroll_id>` | `update_payroll` | 309 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | as POST + `status` | dict | `staff_payroll` |
| POST | `/hr/payroll/<uuid:payroll_id>/approve` | `approve_payroll` | 364 | JWT+SCH+PR | RR(superadmin, school_admin) | — | dict | `staff_payroll.status='approved'` |
| GET | `/hr/payroll/<uuid:payroll_id>/payslip` | `download_payslip` | 382 | JWT+SCH+PR | — **(any role can pull any staff payslip PDF)** | — | `application/pdf` | — |
| POST | `/hr/payroll/<uuid:payroll_id>/pay` | `mark_paid` | 522 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `bank_ref,payment_method` | dict | `staff_payroll.status='paid'` |
| POST | `/hr/payroll/bulk-action` | `bulk_payroll_action` | 549 | JWT+SCH+PR | RR(superadmin, school_admin) | `action(approve|mark_paid)*,month*,ids[],payment_method` | `{updated,skipped,ids}` | `staff_payroll` |
| GET | `/hr/leave` | `list_leave` | 633 | JWT+SCH+PR | — **(any role)** | `?user_id,status` | `[_leave_dict]`+pagination | — |
| GET | `/hr/leaves` | `list_leave_plural` | 649 | JWT+SCH+PR | — | same | delegates :654 | — |
| POST | `/hr/leave` | `apply_leave` | 657 | JWT+SCH+PR | — (any role; `user_id` defaults to self) | `leave_type*,start_date*,end_date*,days,reason,user_id` | 201 | `staff_leave` |
| POST | `/hr/leave/<uuid:leave_id>/approve` | `approve_leave` | 700 | JWT+SCH+PR | RR(superadmin, school_admin) | `status,notes` | dict | `staff_leave` (**no attendance write-through**) |
| PATCH | `/hr/leaves/<uuid:leave_id>` | `update_leave_status` | 731 | JWT+SCH+PR | RR(superadmin, school_admin) | `status,notes` | dict | `staff_leave` |
| GET | `/hr/leave-report` **and** `/hr/leaves/report` | `leave_report` | 756, 757 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `?year,month,status,user_id,format=csv` | JSON aggregate or `text/csv` | — |
| GET | `/hr/appraisals` | `list_appraisals` | 893 | JWT+SCH+PR | RR(superadmin, school_admin) | `?user_id` | `[_appraisal_dict]`+pagination | — |
| POST | `/hr/appraisals` | `create_appraisal` | 909 | JWT+SCH+PR | RR(superadmin, school_admin) | `user_id|staff_id*,period,scores{},overall_score,strengths|comments,areas_for_improvement,goals` | 201 | `staff_appraisals` |
| PUT | `/hr/appraisals/<uuid:appraisal_id>` | `update_appraisal` | 969 | JWT+SCH+PR | RR(superadmin, school_admin) | subset + `status` | dict | `staff_appraisals` |
| GET | `/hr/expense-categories` | `list_expense_categories` | 1005 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | — | list | — |
| POST | `/hr/expense-categories` | `create_expense_category` | 1024 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `name*,description` | 201 | `expense_categories` |
| PUT/DELETE | `/hr/expense-categories/<uuid:cat_id>` | `update_expense_category` | 1043 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `name,description` | dict | `expense_categories` |
| GET | `/hr/expenses` | `list_expenses` | 1071 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `?category_id,start_date,end_date` | `[_expense_dict]`+pagination | — |
| POST | `/hr/expenses` | `create_expense` | 1096 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | `title*,amount*,date*,category_id*,notes,receipt_url` | 201 | `expenses` |
| PUT/DELETE | `/hr/expenses/<uuid:expense_id>` | `update_expense` | 1152 | JWT+SCH+PR | RR(superadmin, school_admin, accountant) | subset | dict | `expenses` |

### 1.11 `backend/app/api/v1/compliance.py` — `compliance_bp`, prefix `/compliance`, `PR("compliance")`

| METHOD | Path | Function | Line | Auth | Role gate | Body | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/compliance/reports` | `list_reports` | 25 | JWT+SCH+PR | — | `?type` | `[_report_dict]`+pagination | — |
| POST | `/compliance/reports` | `create_report` | 38 | JWT+SCH+PR | RR(superadmin, school_admin) | `report_type,academic_year,data,status,notes` | 201 | `compliance_reports` |
| PUT | `/compliance/reports/<uuid:report_id>` | `update_report` | 54 | JWT+SCH+PR | RR(superadmin, school_admin) | + `submitted_at` | dict | `compliance_reports` |
| POST | `/compliance/reports/generate` | `generate_report` | 79 | JWT+SCH+PR | RR(superadmin, school_admin) | `report_type,academic_year` | 201 | `compliance_reports` (**counts only — 2 COUNT queries, :94-99**) |
| GET | `/compliance/emis` | `list_emis_exports` | 124 | JWT+SCH+PR | — | — | `[_emis_dict]`+pagination | — |
| POST | `/compliance/emis/generate` | `generate_emis` | 134 | JWT+SCH+PR | RR(superadmin, school_admin) | `academic_year,data` | 201 | `emis_exports` (**stores the client's own `data` blob; never calls `MoEReportService`**) |
| GET | `/compliance/emis/<uuid:export_id>/download` | `download_emis_export` | 156 | JWT+SCH+PR | — | — | CSV stream or 302 presigned | — |
| GET | `/compliance/audit-logs` | `list_audit_logs` | 211 | JWT+SCH+PR | RR(superadmin, school_admin) | `?user_id,action` | `[_audit_dict]`+pagination | — |

### 1.12 `backend/app/api/v1/iemis_importer.py` — `iemis_importer_bp`, prefix `/iemis` (static mount + `PR("iemis_importer")`)

| METHOD | Path | Function | Line | Auth | Role gate | Body | Response | Writes |
|---|---|---|---|---|---|---|---|---|
| GET | `/iemis/formats` | `list_formats` | 961 | JWT+SCH+PR | — | — | 3 formats + column maps | — |
| GET | `/iemis/template` | `download_template` | 983 | JWT+SCH+PR | — | `?format` | `.xlsx` | — |
| POST | `/iemis/validate` | `validate_import` | 1054 | JWT+SCH+PR | RR(school_admin) | multipart `file`(.xlsx/.xls/.csv ≤20 MB), `format` | `{format,total_rows,valid_rows,warnings,preview[≤20]}` | — (dry run) |
| POST | `/iemis/import` | `run_import` | 1111 | JWT+SCH+PR | RR(school_admin) | same | `IemisImportLog.to_dict` 201 | `iemis_import_logs`, `students`, `users`, `guardians`, `classes`, `sections`, `schools.settings` |
| GET | `/iemis/history` | `import_history` | 1213 | JWT+SCH+PR | — | — | logs + pagination | — |
| GET | `/iemis/history/<uuid:log_id>` | `import_history_detail` | 1226 | JWT+SCH+PR | — | — | log dict | — |

### 1.13 `backend/app/api/webhooks/__init__.py` — `webhooks_bp` at `/webhooks` (**unauthenticated by design**)

| METHOD | Path | Function | Line | Auth | Verification | Writes |
|---|---|---|---|---|---|---|
| GET/POST | `/webhooks/esewa/callback` | `esewa_callback` | 23 | none | HMAC-SHA256 over `total_amount,transaction_uuid,product_code` (`esewa_gateway.py:117-121`) + `product_code`↔school merchant_code check (`:64-71`) | `fee_collections`, `fee_receipts`, `payment_initiations`, `school_receipt_counters` |
| GET/POST | `/webhooks/khalti/callback` | `khalti_callback` | 97 | none | server-side lookup `POST /epayment/lookup/` (`khalti_gateway.py:85-116`) + `purchase_order_id` cross-check (`:141-147`) | same |
| GET/POST | `/webhooks/fonepay/callback` | `fonepay_callback` | 168 | none | HMAC-SHA512 `DV` compare (`fonepay_gateway.py:127-140`) + server verify GET (`:165-212`) + PRN→`PaymentInitiation` anchor (`:218-233`) | same |
| GET | `/webhooks/whatsapp` | `whatsapp_verify` | 252 | none | fail-closed verify-token compare (`:264-272`) | — |
| POST | `/webhooks/whatsapp` | `whatsapp_incoming` | 323 | none | `X-Hub-Signature-256` **only when `WHATSAPP_APP_SECRET` is set** (`:339-346`) | `whatsapp_messages` |
| POST | `/webhooks/stripe` | `stripe_webhook` | 484 | none | `stripe.Webhook.construct_event` (`:515`) + `ProcessedWebhookEvent` replay guard (`:534-542`) | `processed_webhook_events`, `school_plugins` |

Plus `backend/app/api/v1/webhooks.py:12` — `GET /api/v1/webhooks` (`catalog`, `@jwt_required()` + `@superadmin_required`) returning the callback URL map; no writes.

---

## 2. Money correctness audit

### 2.1 The one payable formula, and where it lives (four copies)

`payable = max(base + late_fine − discount, 0)` rounded 2dp. There is **no single implementation** — four float copies exist:

| # | Implementation | Type |
|---|---|---|
| 1 | `backend/app/api/v1/fees.py:2649-2658` `_collection_payable_total` | `float`, `round(...,2)` |
| 2 | `backend/app/api/webhooks/__init__.py:821-826` `_collection_payable` → delegates to #1 | delegating (good) |
| 3 | `backend/app/tasks/fee_reminders.py:283-289` `_fee_payable_total` | **independent float copy** |
| 4 | `backend/app/utils/money.py:47-49` `net_payable` | `Decimal` — **and has ZERO importers repo-wide** (`grep -rn "app.utils.money" backend/ tests/` → 0 hits) |

So the Decimal discipline module written for exactly this problem (`money.py:1-7` docstring: "money … is computed ONLY through these helpers") is entirely dead code. Every actual money path is `float`.

### 2.2 Float arithmetic touching money — complete list

| Location | Expression | Consequence |
|---|---|---|
| `fees.py:2121-2125` `_coerce_fee_amount` | `round(float(value or 0), 2)` | every incoming amount enters as float |
| `fees.py:2650-2658` | `round(max(base+fine-discount,0.0),2)` | payable in float |
| `fees.py:1404` | `amount = float(data.get("amount",0) or 0)` | payment amount float |
| `fees.py:1449-1450` | `min(total, previous+amount)`, `min(amount, outstanding)` | float compare decides paid/partial |
| `fees.py:2670-2683` `_extract_partial_paid` | `float(notes.split("[partial_paid:")…)` | **paid-to-date is parsed out of a free-text `notes` string** |
| `fees.py:2428-2432` | `float(amount) * float(sc.discount_value)/100` then `round(min(...),2)` | discount stacking in float |
| `fees.py:693,696,699` | `round(amount/12,2)`, `/3`, `/6` | monthly derivation from annual in float |
| `fees.py:2798-2800` | `base = amount/(1+vat/100); vat_amount = amount-base` | **VAT split in float, not `split_vat_inclusive`** |
| `fees.py:1862` | `int(amount*100)` for Khalti paisa | `int()` truncates: `199.99*100 = 19998.999…` → `19998` paisa (1 paisa lost) |
| `webhooks/__init__.py:615,706,715,722,737` | `_AMOUNT_EPSILON = 0.01`, `abs(amount-initiated) > eps`, `min(float(amount), outstanding)` | float epsilon gate on gateway amounts |
| `reports.py:134,141,169-173` | `sum(...)`, `float(total_collected)/(...)*100` | report totals float |
| `analytics.py:112-156` | all buckets `0.0` floats, `+=` accumulate | analytics totals float |
| `hr_payroll.py:1401-1418` | `_sum_money`, `_compute_payroll_totals` → `round(float+float,2)` | **all payroll gross/net in float** |
| `hr_payroll.py:288,1289` | `base_basic*tax_rate/100.0`, `base_basic*percentage/100.0` | tax/allowance % in float |
| `fee_reminders.py:283-310,344-366` | payable/paid/discount all float | cron + report totals float |
| `report_generation.py:59-73` | `total_obtained += total`, `round(obtained/full*100,2)` | report-card marks float (acceptable — marks are not money) |

Verdict: **money is float end-to-end.** In practice NPR paisa amounts are small enough that `round(...,2)` masks most drift, but the accumulate-then-compare pattern in `_finalize_fee_payment` (`webhooks/__init__.py:706`) is guarded only by a hardcoded 1-paisa epsilon, and `int(amount*100)` at `fees.py:1862` is a real, reproducible 1-paisa under-charge for any amount whose cents end in `.x9`.

### 2.3 Fee generation

`_apply_fee_structure` (`fees.py:2329-2462`) is the single generator, called from three places: `create_fee_structure` (`:715` — generation happens *inside* the POST, before the client sees the structure), `apply_fee_structure` (`:736`), `batch_monthly_billing` (`:772`). The cron `_generate_monthly_fees_for_school` (`fee_reminders.py:461-565`) is a **second, parallel generator** — it duplicates the loop rather than calling `_apply_fee_structure`.

- **Dedupe**: notes marker `[fee_structure:<id>:<cycle_key>:<item_name>]` (`fee_reminders.py:56-62`) + legacy `[auto_monthly:...]` (`:65-68`) + a column-level fallback on `(fee_item_name, academic_year, year_bs, month_bs)` (`fees.py:2314-2326`). The marker check uses `notes.ilike('%marker%')` — **an unindexed leading-wildcard `LIKE` executed once per (item × student)**: a 1,000-student school with a 6-item structure runs 6,000+ full-table `ILIKE` scans per apply (`fees.py:2305-2312`).
- **Cycle key** is BS-based on both paths (`fee_reminders.py:23-41`), and the API delegates (`fees.py:2228-2230`), so cron/manual no longer double-bill. Good.
- **Cron divergence that remains**: the cron only bills items with `frequency == "monthly"` (`fee_reminders.py:477-481`) and only on BS day ≤ 2 (`:429-431`). Quarterly / semi-annual / annual items are **never auto-generated** — they only exist if an admin clicks apply.
- **No `due_date` column at all**: due dates are re-derived from a `[due_day:N]` substring in `notes` anchored to `month_bs` (`fees.py:2536-2551`). Annual/quarterly bills (`month_bs = None`, `:2251-2252`) therefore have **no due date and no late-fine anchor**.

### 2.4 Discount stacking

`fees.py:2402-2434` (API) and `fee_reminders.py:568-618` (cron) implement the same rule twice:
- all active, in-BS-window scholarships matching `fee_type IS NULL OR fee_type == item_name` are fetched;
- percent discounts are computed **on the base** (not sequentially): `combined += amount * value/100`;
- fixed discounts add flat NPR;
- combined is clamped `min(max(combined,0), amount)` → discount can never exceed base, so **a discount can never waive a late fine**;
- `is_scholarship = True` when any matched.

Validation on creation is present and correct: percent must be `0 < v ≤ 100` (`fees.py:833`), fixed must be `> 0` (`:837`), and the same rules are re-applied on update (`:871-882`). **Gap**: there is no per-student cap across fee heads, no approval workflow, no scholarship *scheme* entity (each row is a bare per-student discount), and `fee_type` is matched by **free-text item name equality** — renaming a fee item silently detaches every scholarship bound to it.

### 2.5 Fine calculation

**There is none.** `late_fine_amount` is a column (`models/fee.py:71`) that is only ever set from a client-supplied field: `create_collection` (`fees.py:1258`) and `update_collection` (`:1325`). No endpoint, task, or service computes a fine from a due date. Searching the whole backend for a fine calculator yields nothing — `_apply_fee_structure` never sets `late_fine_amount`, and the cron never does either. **Late fees in this platform are 100 % manual data entry.**

### 2.6 Receipt numbering + counters

`_generate_receipt_number` (`fees.py:2697-2732`) and `_webhook_receipt_number` (`webhooks/__init__.py:856-891`) are **two copies of the same logic**:
- format `{SLUG≤12}/{BS_FY}/{seq:05d}`, FY rolls at BS month 4 (Shrawan) — `fees.py:2707-2708`;
- counter row `SchoolReceiptCounter(school_id, fiscal_year_bs)` taken `SELECT … FOR UPDATE` (`fees.py:2713-2729`), with a create-then-relock race handler;
- unique partial index `uq_fee_receipts_school_receipt_number` on `(school_id, receipt_number) WHERE NOT is_deleted` (`models/fee.py:113-121`).

Verdict: **receipt numbering is genuinely race-safe and IRD-shaped.** Two real weaknesses: (a) the BS-FY derivation is duplicated with *different* date sources — `fees.py:2706` uses `nepali_datetime.date.today()` while `webhooks/__init__.py:861-865` string-splits `today_bs()`; (b) numbers are drawn **before** the commit succeeds, so a failed commit burns a sequence number (gaps — an IRD auditor's first question).

`verified_hash = sha256(f"{school_id}:{collection_id}:{receipt_number}:{amount}")` (`fees.py:2735-2737`) — **not keyed**. Anyone who knows the four public-ish values can recompute it; it is a checksum, not a signature.

### 2.7 Partial payments

The paid-to-date figure is stored as a substring in `FeeCollection.notes`:
```
_merge_partial_payment_note(existing, paid)  →  "[partial_paid:1234.5] <rest of notes>"   fees.py:2686-2694
_extract_partial_paid(collection)            →  float(notes.split("[partial_paid:")[1].split("]")[0])   fees.py:2670-2683
```
This is the platform's ledger of record for anything not fully paid. Consequences:
- **`FeeReceipt` rows are the real payment history, but nothing reconciles them against the note.** `record_payment` writes the note (`:1454`) *and* a receipt (`:1461-1474`) independently; if any write path touches `notes` without preserving the marker (e.g. `update_collection` sets `collection.notes = data["notes"]` verbatim at `fees.py:1312`), **the paid-to-date silently resets to 0** and the bill becomes collectable again.
- Duplicated three more times: `webhooks/__init__.py:829-853`, `fee_reminders.py:292-310`, `reports.py:47-49` (delegating).
- A malformed note fails silently to `0` (`fees.py:2682-2683`).
- `payment_status == "paid"` short-circuits to the full payable (`:2671-2672`) — so *editing* a paid bill's amount upward instantly re-marks it fully paid at the new amount.

### 2.8 Refunds — what is supported

| Capability | Status | Evidence |
|---|---|---|
| Khalti full refund | **real** — calls `POST /api/v2/transaction/refund/` | `khalti_gateway.py:119-152`, route `fees.py:1897-1989` |
| Partial refund | **not supported** — amount is forced to the whole payable | `fees.py:1972` `amount=_collection_payable_total(fc)` |
| eSewa refund | **not implemented** — 422 | `fees.py:1920-1921` |
| FonePay refund | **not implemented** — 422 (gateway only *reads* `R_AMT`) | `fees.py:1920`, `fonepay_gateway.py:159` |
| Cash/bank/cheque refund | **not implemented** — same 422 gate blocks every offline method | `fees.py:1920-1921` |
| Refund ledger | real table, written in the same commit as the status change | `models/fee.py:126-149`, `fees.py:1968-1982` |
| Reversal of the receipt | **absent** — the original `FeeReceipt` is left untouched, so `Σ receipts` still shows the money as collected | `fees.py:1968-1982` (no receipt write) |

So: refunds only work for Khalti, only in full, and **the receipt ledger is not reversed** — after a refund, `/fees/summary` (`fees.py:446-454`, sums `FeeReceipt.amount`) and `generate_monthly_fee_report` (`fee_reminders.py:372-386`) both still count the refunded money as collected. Only `payment_status` changes.

### 2.9 Gateway verification flows — real vs stubbed

| Gateway | Initiate | Verify | Verdict |
|---|---|---|---|
| **Khalti** | real HTTP `POST {base}/epayment/initiate/` with `Authorization: key <secret>` (`khalti_gateway.py:42-72`) | real HTTP `POST /epayment/lookup/`, `verified = status=="Completed"` (`:75-116`); network failure returns `{"verified":False,"network_error":True}` and the caller maps it to **502, not "unpaid"** (`webhooks/__init__.py:131-134`) | **REAL, and the safest of the three** |
| **eSewa** | **no HTTP call** — builds a signed form + a self-submitting HTML page for the client to POST (`esewa_gateway.py:36-95`). This is correct for ePay v2. | signature-only: HMAC-SHA256 over `total_amount,transaction_uuid,product_code` compared to the callback's `signature` (`:98-129`) | **REAL signature verification, but NO server-side status lookup on the callback path.** `check_transaction_status` exists (`:131-156`) and is **called from nowhere** (`grep check_transaction_status` → only its own definition). Signature compare also uses `!=` on strings (`:120`), not `hmac.compare_digest`. |
| **FonePay** | no HTTP call — builds a signed redirect URL (`fonepay_gateway.py:46-102`) | HMAC-SHA512 `DV` compare with `hmac.compare_digest` (`:134`) **plus** a real server-to-server `GET /merchantRequest/verify` when the callback claims success (`:144-151`, `:165-212`) | **REAL** |

Additional gateway facts:
- Credentials are strictly per-school from `school.fee_config["payment_methods"][*]["secret_key"]`; there are no env fallbacks (docstrings `khalti_gateway.py:3-5`, `esewa_gateway.py:3-5`, `fonepay_gateway.py:6-8`), and missing credentials `raise ValueError` → mapped to 422 (`fees.py:1889-1890`).
- Secrets are **stored in plaintext inside a JSONB column** (`fees.py:2098-2101` writes, `:2115-2118` reads). They are masked in responses (`:2108-2112`), but any DB dump exposes every school's live gateway secret.
- `_normalize_payment_methods` forces `mode="offline"` for anything outside `{esewa,khalti,fonepay}` (`fees.py:2058-2059`), which correctly prevents "online" QR-pay fictions.
- The **FonePay callback resolves the school by scanning every school row in Python** (`webhooks/__init__.py:186-192`) — a full table scan per callback, with the comment admitting it.

### 2.10 Webhook idempotency / replay guards

`_finalize_fee_payment` (`webhooks/__init__.py:618-800`) is a genuinely careful state machine:

| Rule | Line | Behaviour |
|---|---|---|
| initiation already `completed` | 677 | idempotent 200 duplicate |
| receipt with same `(collection, gateway, transaction_id)` exists | 679 | idempotent 200 |
| collection already `paid` by a *different* txn | 684-696 | **409, nothing recorded** (correct — refuses to double count) |
| initiation `failed` | 699 | 409 |
| callback amount ≠ initiated amount (±0.01) | 704-714 | 409, nothing recorded |
| no initiation anchor and amount > outstanding | 722-735 | 409, nothing recorded |
| receipt insert races a concurrent duplicate | 755-771 | rollback → idempotent 200 |
| unique `FeeReceipt.idempotency_key = "webhook:<gw>:<coll>:<txn>"` (sha256 if >100 chars) | 740-742, `models/fee.py:105` | DB-level replay guard |

Stripe has its own replay table `ProcessedWebhookEvent(provider, event_id)` inserted in the same transaction as the effect (`webhooks/__init__.py:534-542`). WhatsApp dedupes on `wa_message_id` (`:409-418`).

Remaining gaps: (a) **the three payment callbacks have no `ProcessedWebhookEvent`-style guard on the raw event** — they rely on receipt/initiation state, which is sound but means a replayed eSewa `data` blob for a *pending* collection re-runs the whole verify path (idempotent only because of rule 2); (b) `payment_initiations.status` is never set to `failed` by anything — `grep 'status = "failed"'` finds only the reader at `:699`, so rule 4 is dead code; (c) eSewa's callback locates the collection from **unverified** decoded data before verification (`:41-44`) — harmless (verification follows) but it means an attacker can probe collection-id existence unauthenticated.

### 2.11 VAT / IRD

- PAN is printed on the receipt when `school.pan_number` is set (`fees.py:2790`, `report_pdf.py:83-84`).
- VAT is rendered **only** when `school.fee_config["vat_percent"] > 0` (`fees.py:2792-2808`), computed inline as `base = amount/(1+vat/100)` — i.e. VAT-inclusive back-out, correct in shape but **not** using `money.split_vat_inclusive` (`money.py:52-56`), and in float.
- **No IRD CBMS / e-billing integration, no bill sync, no fiscal-year close, no credit-note document, no `is_vat_registered` flag, no VAT register report.** The 14-heading MoEST-2072 fee-cap classifier exists (`money.py:63-115`) and is **called from nowhere** — the CEHRD fee-cap report it was written for does not exist.
- Receipt numbering is per-school-per-BS-FY sequential (§2.6), which is the one genuinely IRD-shaped piece.

### 2.12 Payroll: TDS / SSF / PF

**Nothing statutory is implemented.** The only evidence of these concepts anywhere in the backend is a comment: `models/hr_payroll.py:16` — `deductions = Column(JSONB, default=dict)  # {pf: 1500, tax: 500, ssf: 1000}`.

- Deductions are an arbitrary free-text `{name: amount}` JSONB dict; `_sum_money` (`hr_payroll.py:1401-1404`) just sums the numeric values.
- The only automatic deduction is a single flat `Tax` line: `deductions["Tax"] = round(base_basic * tax_rate/100, 2)` (`hr_payroll.py:288`, cron copy `payroll_monthly.py:77`) where `tax_rate` is one school-wide number from settings.
- Nepal's actual requirements are all absent: no **TDS slab table** (1 % SST / 10 % / 20 % / 30 % / 36 % brackets), no married-vs-single threshold, no annualisation, no **SSF** (11 % employee + 20 % employer), no **PF/CIT** (10 % + 10 %), no gratuity, no `e-TDS` return export, no employee PAN field, no year-to-date accumulators, no annual salary certificate.
- `net = gross − Σdeductions` (`hr_payroll.py:1407-1418`), so an employer contribution has nowhere to live at all.
- The payslip PDF filters deduction rows with a fragile numeric-string test (`hr_payroll.py:433-443`), and its `or` chain has no parentheses — a boolean-precedence bug waiting to include a `True` value.

Verdict: payroll is a **spreadsheet with a PDF**, not a Nepali payroll engine.

---

## 3. Academic correctness audit

### 3.1 Marks entry validation — `submit_marks` (`exams.py:638-842`)

Three-pass design, all validation before any write:

| Pass | Lines | Checks |
|---|---|---|
| 1 (`cleaned`) | 672-731 | `student_id`/`subject_id` coerce to UUID (400 with `records[idx]` context); student, subject, class each resolved **inside this school**; teacher scope filter *skips* (`continue`) rows outside scope; `class_id` falls back to the student's own class |
| 2 (`validated`) | 736-768 | rejects negative theory/practical (`:741`); resolves the full-marks config; rejects `theory+practical > full_marks` (`:762`) |
| 3 (write) | 770-830 | upsert into `marks`, one `commit`, `IntegrityError` → 409 (`:821-830`) |

What is **not** validated: `is_absent` is accepted as a bare truthy value while marks are still stored (an absent student can carry marks); `remarks` is unbounded free text; practical marks are not checked against `practical_full_marks` individually (only the sum against the total); there is **no marks-locking / freeze after publish** — `submit_marks` works identically after `POST /exams/<id>/publish`, so published results can be silently rewritten with no audit trail (`marks.entered_by` is only set on insert, `:814`, never updated on the upsert branch `:784-796`).

### 3.2 Grade computation vs `nepal_grading` — drift check

`backend/app/utils/nepal_grading.py` is the single scale (`NEB_GRADES` `:18-27`: 90/A+/4.0 … 35/D/1.6, else NG; `PASS_PERCENTAGE=35`, `PRACTICAL_PASS_PERCENTAGE=40`).

| Consumer | Uses the util? | Evidence |
|---|---|---|
| `exams.py` (`_build_subject_grade`, `get_results`, `grade-sheet`, marksheet) | yes | `exams.py:18,163,996,1149` |
| `tasks/report_generation.py` report card | yes | `report_generation.py:77-90` |
| `services/designer/bulk_generator.py` | yes — explicitly de-duplicated ("ONE source of truth (N-02)") | `bulk_generator.py:846-873` |
| **`services/designer/template_engine.py:667-676`** | **NO — hardcoded 8-row grade table inside the `grade_sheet` writer template** | literal rows `["1","90 to 100","A+","Outstanding","4.0"] … ["8","0 to below 35","NG","Not Graded","—"]` |

So exactly one drifted duplicate survives: the **printed grade legend** on the NEB grade-sheet template is a hardcoded copy. It currently *matches* the util, but it is not derived from it — any scale change silently desynchronises the printed legend from the computed grades. (`bulk_generator.py:868-873` also has a suspicious `_neb_grade_from_gpa` that compares a GPA against `NEB_GRADES`' **percentage-ordered** list and takes the first `gpa >= gpa_val` — correct only because the list happens to be descending in both dimensions.)

### 3.3 GPA math

`calculate_gpa` (`nepal_grading.py:97-136`):
- credit-weighted: `Σ(gpa × credits) / Σcredits`, `credit_hours=None → 1.0`, explicit `0` honoured as zero weight (`:107-117`);
- overall **grade** comes from the aggregate *percentage* (`calculate_grade(overall_pct)`, `:125`) — i.e. grade and GPA are computed from two different bases, which can disagree (e.g. weighted GPA 3.6 but percentage 79 % → grade "B+");
- `status = "fail" if any subject is NG` (`:131`) — correct NEB rule;
- `subjects_failed` counted (`:135`).

Real bugs found in the callers:
- `exams.py:987-991` overrides the freshly computed subject grade with the **stored** `m.grade`/`m.gpa` but leaves `total_obtained`/`total_full` from the fresh computation — so if stored marks and stored grade ever disagree, `get_results` returns an internally inconsistent row.
- `exams.py:1146-1152` in `grade-sheet`: `overall_grade = calculate_gpa([])["grade"] if not subject_marks else ""` — this is **always either `"NG"` or the empty string**, and the value is then never put in the response. Dead, misleading code; the grade-sheet rows carry **no overall grade or GPA at all**, only `percentage` and `status`.
- `exams.py:1806` `_student_result_from_marks` computes GPA as a **plain unweighted mean of per-subject GPAs** (`sum(gpa)/len(marks)`) — a third GPA formula, used whenever a student has marks but no `ReportCard`.

### 3.4 Rank computation

Competition ranking (1, 1, 3) is implemented correctly and used in three places:
- `_assign_competition_ranks` (`exams.py:133-142`) → `get_results` (`:1020`) and `get_grade_sheet` (`:1170`);
- report-card ranking in the Celery task (`report_generation.py:227-244`) — its own copy of the same algorithm, writing `ReportCard.rank_in_class`.

Gaps: ranking is **per-class only** — `Marks.rank_in_section` (`models/exam.py:117`) is a column that nothing ever writes; there is no section rank, no stream rank, no school rank, and no tie-break policy beyond the shared rank. `get_results` ranks only students who **have marks rows** (`:957-962` groups from marks), so an absent student silently vanishes from the ranking rather than ranking last.

### 3.5 Report cards

- Generation is async: `POST /exams/<id>/report-cards` → `generate_bulk_report_cards.delay` (`exams.py:1478-1480`), which loops students calling `generate_report_card_pdf` **synchronously in-process** (`report_generation.py:209-211`) — one WeasyPrint render per student inside one task, no chunking; a 1,200-student school is a single task with 1,200 renders (`task_time_limit=1800` s, `app/__init__.py`), so it will hit the soft time limit.
- The response is fire-and-forget: `{"message": "Report card generation started"}` with **no job id**, so the UI cannot poll progress (`exams.py:1482-1484`).
- The PDF falls back to storing raw HTML when WeasyPrint is missing (`report_generation.py:138-139,181-187`) — honest, and `pdf_url` then points at an `.html`.
- `ai_remarks` is best-effort through the token hub and left empty on failure (`:159-174`) — no fabrication.
- The **web-facing** bulk report-card PDF (`exams.py:1555-1672`) is a completely separate, hand-built HTML document that includes **unescaped DB strings** in f-strings: `{school.name}`, `{exam.name}`, `{student_name}`, `{rc.ai_remarks}` (`:1615-1628`). A student named `<script>`/`</style>` breaks or injects into the render. Compare `reports.py`, which correctly uses `markupsafe.escape` (`reports.py:15,511`).

### 3.6 Transcripts

**Do not exist.** No route, model, or service produces a multi-exam / multi-year cumulative transcript. Evidence: the only "transcript" hits in the backend are AI-tutor conversation transcripts (`app/api/v1/ai_tutor.py:149`, `app/models/ai_teacher.py:219`, `app/plugins/modules/ai_teacher/tasks.py:66`). What exists is strictly per-exam: marksheet (`exams.py:1194`), grade sheet (`:1028`), report card (`:1413`). Missing pieces for a real transcript: cumulative GPA across exams/years, credit accumulation, a character-certificate/transcript document, symbol-number and registration-number fields (the grade-sheet template references `{symbol_no}` — `template_engine.py:650` — but **no model column holds it**).

### 3.7 Per-school grading scales

**Not supported.** `NEB_GRADES` is a module-level tuple (`nepal_grading.py:18`); there is no `GradingScale` model, no `school_id` parameter on any grading function, and `GET /exams/grade-table` returns the global constant (`exams.py:205-211`). A school on a 100-point CBSE-style or an A–F scale cannot be represented. Per-subject full/pass marks *are* per-school (`subjects.full_marks`, `pass_marks`, `practical_*`), and `SubjectOffering` provides platform NEB defaults (`academics.py:1039-1056`) — so the marks *config* is flexible while the *grade boundaries* are hardcoded.

### 3.8 Academic-year scoping

Inconsistent, and this is a structural weakness:

| Table | Year anchor | Evidence |
|---|---|---|
| `exams` | `academic_year_id` FK | `models/exam.py:42` |
| `marks` | `academic_year_id` **nullable, "expand phase"**, never set by `submit_marks` | `models/exam.py:88`; `exams.py:798-815` omits it |
| `report_cards` | `academic_year_id` nullable, same | `models/exam.py:135` |
| `attendance` | `academic_year_id` nullable, never written by `mark_attendance` | `models/attendance.py:21`; `attendance.py:141-150` |
| `fee_collections` | `academic_year` as a **String(10)** (`models/fee.py:47`) — not an FK | filters compare strings (`fees.py:2319`) |
| `fee_receipts` | `academic_year_id` nullable, never written | `models/fee.py:98`; `fees.py:1461-1470` |
| `students` | both `academic_year_id` FK **and** a `academic_year` string, used interchangeably | `students.py:61` filters the FK, `:73` filters the string as "grade" |

So year-over-year reporting is only possible through `exams`/`students`, and `GET /students?grade=X` (`students.py:71-73`) filters `Student.academic_year == grade` — the *year* column being used as a *grade* filter. That is an outright semantic bug in the query contract.

### 3.9 Promotion / rollover

Two independent implementations:

| Path | Trigger | Behaviour |
|---|---|---|
| `POST /students/promote` (`students.py:660-805`) | manual, class→class | eligible statuses `("active","transferred_in","on_leave")` (`:395`); section mapped **by name** with first-section fallback (`:423-432`); `roll_strategy` `keep` (report clashes) or `renumber` (1..N per section) (`:691-693`, `:779-785`); single transaction with rollback (`:780-794`); optional explicit `student_ids` |
| `academic_rollover_daily` (`tasks/academic_rollover.py:12-132`) | nightly cron, year→year | finds next `AcademicYear` by start date (`:135-157`); maps class by `numeric_grade+1` then `sort_order+1`, with medium/stream keys (`:174-194`); **students with no next class are set `status="graduated"`** (`:96`); flips `is_current` on both years (`:108-109`) |

Divergences worth noting: the cron **never renumbers rolls** (promoted students keep last year's roll, guaranteeing duplicates in the merged target section), it silently graduates anybody whose grade+1 class does not exist (a school that has not yet created next year's Grade 11 will graduate its whole Grade 10), and it re-activates `graduated` students (`:104-105`) which contradicts `PROMOTABLE_STATUSES`. Neither path carries fee dues, attendance, or marks forward, and neither writes an audit row.

---

## 4. Attendance / timetable audit

### 4.1 Subject-wise attendance

**Not supported.** `Attendance` carries a `UniqueConstraint("school_id","student_id","date")` (`models/attendance.py:11-16`) — one row per student per **day**, with no `subject_id`, no `period_number`, no `timetable_slot_id`. `mark_attendance` upserts on exactly that key (`attendance.py:124-128`). So period-wise / subject-wise attendance is structurally impossible without a schema change. This also means: a college-style shift school cannot record two sessions a day, and a subject teacher cannot record their own period.

Related: only **class teachers** may mark (`teacher_class_teacher_class_ids`, `teacher_scope.py:6-19`, enforced `attendance.py:45-49`) — a defensible policy given the daily-row model, but it makes subject teachers unable to record anything.

### 4.2 Statuses and rate rule

Enum `present|absent|late|half_day|leave` (`models/attendance.py:26-28`), validated up-front (`attendance.py:41,56-59`). The attendance *rate* rule is consistently `(present + late) / total` in all five places that compute it — `attendance.py:248,354`, `reports.py:92-94,329`, `analytics.py:84,93` — and `half_day` **never** contributes a half day anywhere. A half-day student counts as fully absent for the rate. There is no working-day calendar: `working_days` is `COUNT(DISTINCT date)` of rows that exist (`reports.py:352-363`), so a day nobody marked simply does not exist, and the denominator in `/attendance/school-overview` is `days = (end-start).days + 1` including Saturdays and public holidays (`attendance.py:391-394`).

### 4.3 Leave types and approval write-through

Two entirely separate leave systems:

| System | Model | Types | Approval | Write-through |
|---|---|---|---|---|
| `/attendance/leave-requests` | `LeaveRequest` (`models/attendance.py:61-78`) | `leave_type` free-text `String(50)`, default `"sick"` (`attendance.py:575`), comment lists sick/casual/earned/maternity | `POST …/approve` `RR(school_admin, teacher)` | **YES** — `_upsert_teacher_leave_attendance` stamps a `TeacherAttendance(status="leave")` row for every date in the inclusive range (`attendance.py:614-637`) |
| `/hr/leave` | `StaffLeave` (`models/hr_payroll.py`) | free-text `leave_type` | `POST /hr/leave/<id>/approve` `RR(superadmin, school_admin)`, statuses `pending|approved|rejected|cancelled` (`hr_payroll.py:1206`) | **NO** — approval only flips `status` (`hr_payroll.py:723-727`); no attendance row, no payroll deduction |

So the platform has two staff-leave tables with divergent semantics, and the one wired into the HR dashboard is the one **without** write-through. Neither has a leave **balance/entitlement** ledger: no accrual, no opening balance, no carry-forward, no "days remaining" anywhere (`_leave_days` in the report merely counts calendar days, `hr_payroll.py:812-819`). **Student leave has no request workflow at all** — a student "leave" is just an attendance row a teacher types in (documented at `attendance.py:597-599`).

### 4.4 The timetable "solver" — what it actually is

`TimetableSolverService.generate_timetable` (`backend/app/services/ai/timetable_solver.py:11-96`). Its docstring claims "constraint satisfaction" (`:1,21`). It is not.

Actual algorithm, line by line:
1. Load all `Class`, all `teacher` users, all `Subject` for the school (`:30-37`) — **no teacher↔subject relation is used**; the comment admits it: `# Build teacher-subject mapping (simplified — in production, use TeacherSubject relation)` (`:33`). `teacher_map` is built and then **never read** (`:34`).
2. `subject_queue = list(subjects) * 2` (`:57`) — the entire school subject list, duplicated, in DB order. Not per-class, not curriculum-weighted, no periods-per-week requirement.
3. For each day × period, pop the next subject off that flat queue (`:60-65`). When the queue runs out, `break` — later days get **no slots at all**.
4. Teacher assignment: iterate teachers in list order and take **the first teacher who is free in that (day, period)** (`:69-76`). No subject match, no qualification check, no workload cap, no max-periods-per-day.
5. `room_schedule` is declared (`:42`) and **never used** — no room allocation at all.
6. Returns `"conflicts": []` with the comment `# Would contain detected clashes` (`:95`) — conflicts are never computed.

So: **a single-pass greedy filler with one hard constraint (teacher not double-booked in the same day+period) and no backtracking, no objective function, no soft constraints, and no conflict reporting.** Additional consequences: a teacher can be assigned a subject they do not teach; the same subject repeats back-to-back; `period_duration`/`start_time` are echoed but never used to compute slot times (so `TimetableSlot.start_time`/`end_time` are left NULL by `save_timetable`, `timetable_solver.py:106-114`) — the saved timetable has period numbers but no clock times. `save_timetable` also commits inside the service (`:118`) and `save_timetable` the route then commits again (`timetable.py:109`), and the route's scoped delete uses a hard `query.delete(synchronize_session=False)` **before** the insert with no transaction guard (`timetable.py:101-108`) — a failure mid-save leaves the class with no timetable.

By contrast, the **manual** `POST /timetable/slots` (`timetable.py:113-246`) is thorough: FK scope checks, time-window overlap detection, class-wide-vs-section clash rule, teacher clash rule, 409s. The good clash logic exists — the generator just doesn't use it.

#### What a real constraint solver must accept as input

| Input | Why | Current availability |
|---|---|---|
| Per (class, section, subject) **periods-per-week** requirement | the core demand vector | **missing** — no model column |
| Per subject **double-period / consecutive** requirement (labs) | lab subjects need 2 contiguous periods | missing |
| Teacher→subject **qualification map** with per-class assignment | prevents assigning a maths teacher to Nepali | partially: `Subject.teacher_ids` + `Subject.class_ids` (`academics.py:904-910`) — usable today, ignored by the solver |
| Teacher **availability windows** and max periods/day + max/week | workload law and part-time staff | missing |
| **Room/lab inventory** with capacity and subject affinity | lab and computer-room contention | missing (`room` is a free string on the slot) |
| **Shift** definitions (start/end) and period grid with break periods | `Shift` exists (`academics.py:282-330`), `TimetableSlot.is_break` exists | shift exists but is not fed to the solver |
| **Holiday/working-day calendar** per school | do not schedule on Saturdays/festivals | missing entirely |
| Class-teacher **first-period preference**, subject **time-of-day preference** (soft) | quality objective | missing |
| Fixed/pinned slots (assembly, games) | must survive generation | missing (generation wipes the class's slots) |
| Objective weights (minimise gaps, spread a subject across the week, balance teacher load) | otherwise "clash-free" is the only quality bar | missing |

Output contract a real solver needs to return: per-slot assignment **with start/end times**, a populated `conflicts[]` list, per-teacher load summary, and an `unassigned_requirements[]` list so the admin knows what could not be placed.

---

## 5. Reports / analytics audit

### 5.1 What reports exist

| Report | JSON route | Export | Builder |
|---|---|---|---|
| Attendance summary (+ per-student rows, working days, below-75 % count) | `reports.py:259` | `…/pdf` → persisted PDF URL (`:489`) | `_attendance_summary_data` `:64`, `_attendance_per_student` `:285`, `_attendance_per_class` `:98` |
| Fee collection (collected/pending/rate + per-payment rows) | `reports.py:377` | `…/pdf` (`:581`), detail capped at 100 rows (`:602`) | `_fee_collection_summary_data` `:125` |
| Exam results (per-subject avg/min/max/pass-rate) | `reports.py:411` | `…/pdf` (`:664`) | `_exam_results_subjects` `:178` (single SQL GROUP BY — the only properly aggregated builder) |
| School dashboard | `reports.py:434` | — | inline |
| Fee collections CSV | — | `fees.py:1032` (`text/csv` + UTF-8 BOM) | `_collections_filtered_query` |
| HR leave aggregate CSV | — | `hr_payroll.py:850-876` | inline |
| Fee receipt PDF, student statement PDF, payslip PDF, marksheet/report-card bulk PDF | direct streams | `fees.py:1534,1570`, `hr_payroll.py:382`, `exams.py:1487,1555` | hand-built HTML |
| Monthly fee report | Celery only, **no route** | `fee_reminders.py:313-410` returns a dict to the Celery result backend — unreachable from the API | — |
| EMIS CSV | `compliance.py:156` download | `tasks/report_generation.py:258-360` | `MoEReportService.build_emis_csv` |
| MoE Flash Report I/II | **no route** | `services/compliance/moe_reports.py:45-84` — `generate_flash_report`/`generate_emis_export` have **zero callers** | — |

### 5.2 PDF / Excel dependency reality

Verified by importing in the project venv (`backend/.venv/bin/python`): **WeasyPrint 63.1, openpyxl 3.1.5, python-docx 1.2.0, nepali_datetime 1.0.8.5, bleach 6.1.0 all present**, and all are pinned in `backend/requirements.txt:35,42,46,71`. So the `501 "PDF export is unavailable"` branches (`fees.py:1550-1551`, `exams.py:1520-1521,1598-1599`, `reports.py:483-486`, `hr_payroll.py:509-510`) are correct defensive code, not the live path.

Two patterns coexist and should be unified:
- **Good**: `reports.py` → `report_pdf.build_report_html` (`utils/report_pdf.py:88-124`) with a shared letterhead, `@page` footer counters, `fmt_npr`, BS+AD issue date, and `markupsafe.escape` applied by the caller.
- **Bad**: `fees.py:2816-2882`, `exams.py:1640-1658`, `hr_payroll.py:445-503` each hand-roll a full HTML document with its own inline CSS; only `fees.py` escapes (`from html import escape`, `:8`), `exams.py` and `hr_payroll.py` interpolate DB strings raw.

**Excel export is import-only.** `openpyxl` is used exclusively by the IEMIS importer (`iemis_importer.py:127,935,1004`) — the only `.xlsx` *write* in the whole backend is the blank import template (`:1010-1051`). No report is downloadable as Excel; every tabular export is CSV. `python-docx` is used only by `services/writer_docx.py` (Design Studio), not by any academic/money report.

### 5.3 N+1 and full-table-scan risks (with lines)

| # | Location | Pattern | Cost |
|---|---|---|---|
| R1 | `fees.py:396-399` then `:499-506` | `FeeCollection.query.filter_by(school).all()` loads **every collection ever** into memory, then re-loops it once per class inside the class loop | O(collections × classes); a 3-year-old 1,000-student school = ~100 k rows × 12 classes |
| R2 | `fees.py:465-468` | per receipt: `FeeCollection.query.get` + `Student.query.get` | 20 queries per summary call |
| R3 | `fees.py:1124-1127` `list_defaulters` | loads **all** collections, then `collection.student`, `student.klass`, `student.user` lazily per row | 3 N+1 chains, no `limit` |
| R4 | `fees.py:2465-2471` `_structure_applied_count` | `notes ILIKE '%marker%'` **COUNT per structure**, called from `_structure_dict` → runs for **every row** of `GET /fees/structures` | unindexed leading-wildcard scan × page size |
| R5 | `fees.py:2305-2312` | same `ILIKE` inside the generation loop, per (item × student) | 6,000 scans for 1,000 students × 6 items |
| R6 | `fees.py:2554-2562` `_collection_dict` | `_latest_receipt(c.id)` = one query per collection + lazy `c.student` | 2 N+1 per listed collection (also hit by the CSV export, which is unpaginated) |
| R7 | `exams.py:966-998` `get_results` | `Student.query.get` per student **and** `Subject.query.get` per mark | O(students × subjects) |
| R8 | `exams.py:1458-1464`, `:1583-1589`, `:1602-1606` | `Student.query.get` per report card; class per card | N+1 in all three report-card endpoints |
| R9 | `exams.py:1777-1785`, `1802-1822` | `Exam.query.get` + `Subject.query.get` per mark inside the results serializer | N+1 |
| R10 | `analytics.py:98-110` | `FeeCollection…all()` + `Student…all()` + `Class…all()` for the school, all in Python | full-table load per uncached call |
| R11 | `analytics.py:87-91` | all attendance rows for 30 days loaded and counted in Python instead of SQL | O(students × 30) |
| R12 | `analytics.py:452-476` `_school_metric_averages` | calls `_overview_payload(school_id)` **once per school**, and `/analytics/benchmarking` passes **every active school in the platform** (`:496-502`) | the single worst endpoint in the audited set: N schools × (full fee + attendance + marks scan). At 200 schools this is hundreds of full-table scans in one request, uncached |
| R13 | `attendance.py:406-417` | per-class `COUNT` × 2 inside a Python loop over all classes | 2 × classes queries |
| R14 | `reports.py:127-141` | two unbounded `.all()` loads (paid + all pending collections) then Python `sum` | full-table |
| R15 | `reports.py:313-315` | `Student.query.filter(id.in_(student_ids))` with an unbounded `IN` list | can exceed parameter limits on large ranges |
| R16 | `webhooks/__init__.py:186-192` | **`School.query.filter_by(is_deleted=False).all()`** then Python filter to match the FonePay `PID` | full `schools` scan per payment callback |
| R17 | `report_generation.py:204-211` | bulk report cards: per student a full `Marks` + `Subject.query.get` loop + one WeasyPrint render, serially in one task | 1,200 renders in one 1,800 s task |
| R18 | `iemis_importer.py:282-284` | `_placeholder_phone` does a `User.query.filter_by(phone=…)` in a loop of up to 10,000 | pathological only on collision, but per imported row it is ≥1 extra query |

Only `_exam_results_subjects` (`reports.py:178-225`), `attendance_summary` (`attendance.py:323-341`) and `_attendance_per_student` (`reports.py:292-304`) push aggregation into SQL. Everything money-related aggregates in Python.

Caching: only `/analytics/overview` is cached (300 s, `analytics.py:293-298`), and `/analytics/financial` (`:437`) and `/analytics/benchmarking` (`:485`) call `_overview_payload` **directly**, bypassing that cache.

---

## 6. IEMIS importer audit

### 6.1 Pipeline stages

```
upload (multipart "file")                       iemis_importer.py:1063-1078 / 1118-1134
  → extension gate {xlsx, xls, csv}, ≤20 MB    :1072-1078
  → format = form["format"] or _detect_format   :1080-1085
  → _parse_tabular → _parse_csv | _parse_excel  :230-234
       header row = first non-empty row         :146-154
       header → field map via FORMAT_MAP        :156-162 (unknown cols → warnings)
  → _import_students | _import_staff | _import_school_level   (dry_run flag)
  → validate: return previews[:20] + warnings   :1099-1108
  → import: IemisImportLog row (processing → completed|partial|failed)  :1144-1210
  → emit("iemis.import_completed")              :1178-1186
```

Note the `.xls` trap: the extension allowlist accepts `xls` (`:1073,1129`) but `_parse_excel` uses `openpyxl.load_workbook` (`:135`), which cannot read legacy BIFF `.xls`. A real MoE `.xls` export therefore fails with a raw `openpyxl` exception → caught as generic `Exception` → **500 "Import failed due to an internal error"** (`:1205-1210`), not a helpful 415/422.

### 6.2 Mapping tables

Three formats, all header-string→field dicts (`:43-118`):
- `student_namewise` (16 cols) — `iemis_student_id`, `full_name`, `gender`, `grade`, `dob`, `father/mother/guardian_name`, `guardian_phone`, `section`, permanent/temporary address;
- `school_level` (23 cols) — IEMIS code, type/sub-type, province…ward/tole, head teacher, SEE/HSEB codes, five per-level establishment dates, `max_class`;
- `staff_details` (12 cols) — `iemis_teacher_id`, name, gender, DOB, phone, email, designation, level, appointment status, teaching subject.

Header matching is **exact, case-sensitive, whitespace-stripped equality** (`:158-162`), and note the inconsistency baked into the maps themselves: `"IEMIS Code"` in the student map (`:45`) vs `"Iemis Code"` in the school and staff maps (`:64,89`). Any MoE column-label change (a trailing space in the sheet, `"Full  Name"`, a Nepali header) silently drops the column to a warning and the field arrives empty.

### 6.3 Validation

| Field | Rule | Line |
|---|---|---|
| `full_name` | required; missing → row error | 406-410 |
| name split | **last whitespace token = last name**, rest = first name | 413-415 |
| `gender` | mapped from `M/MALE/BOY/पुरुष`, `F/FEMALE/GIRL/महिला`, else `"other"` | 237-245 |
| `grade` | strips a leading `"class "`, truncates to 10 chars | 300-309 |
| `dob` | see §6.5 | 290-297 |
| strings | `str(val).strip()[:max_len] or None` | 248-251 |
| student cap | plan cap enforced **before** the loop, live imports only | 371-403 |
| school-level | requires IEMIS code **or** school name | 671-676 |
| staff | `full_name` required | 773-779 |

There is **no** validation of gender/grade against the school's actual classes, no phone-format check, no duplicate-within-file check, no BS date-range check, and no row-count sanity check.

### 6.4 Dedupe strategy

| Entity | Key | Line | Weakness |
|---|---|---|---|
| Student | `Student.student_id == iemis_student_id` within the school | 456-461 | **rows with no IEMIS id are NEVER matched → every re-import creates a fresh duplicate student + user** (`existing=None` at `:455`) |
| Class | `Class.name == grade` (auto-created if absent) | 467-474 | `"10"` vs `"Class 10"` vs `"१०"` create three classes; the auto-created `Class` has no `academic_year_id`, `numeric_grade`, or `sort_order` |
| Section | `(class_id, name)` (auto-created) | 476-489 | same free-text problem |
| Guardian | relation match, then `full_name` match | 598-604 | a renamed guardian creates a second row |
| Parent user | `(school_id, phone)`, must already be `role="parent"` | 338-348 | a guardian sharing a phone with a teacher account returns `None` → guardian left unlinked, silently |
| Staff | `email` first, else `(full_name, phone)` | 806-817 | `iemis_teacher_id` is stored in `permissions` JSONB but **never used as the match key** (comment admits it, `:811`) |

Student counters: `ensure_student_numbers` is called on both the create and the update branch (`:519,543`) under a School-row `FOR UPDATE` lock, so admission numbers are concurrency-safe.

Transactionality: each student row runs in `with db.session.begin_nested()` (`:453`) with a per-row `except` (`:639-645`), and one final `commit` (`:648`) — good, a bad row cannot poison the batch. **But `_import_school_level` commits inside its loop (`:741`) and `_import_staff` calls `db.session.rollback()` inside its `except` (`:915`)** — a rollback there discards every *uncommitted* staff row processed so far in that batch, so a single bad staff row silently drops all preceding good ones.

### 6.5 BS ↔ AD handling

This is the importer's weakest point and it is explicit in the code:

```python
def _parse_dob(val):
    dob_bs = s if len(s) == 10 and s[4] == "-" else None
    return dob_bs, None   # AD conversion would need nepalicalendar lib
```
`iemis_importer.py:290-297`

- `dob_ad` is **always `None`** — every imported student has no AD date of birth, so any age-based logic, any AD-based report, and the grade-sheet's `{dob_ad}` placeholder (`template_engine.py:653`) are empty for imported students.
- The comment claiming the library is unavailable is **false**: `nepali_datetime` is pinned (`requirements.txt:35`), installed (verified 1.0.8.5), and `app/utils/nepali_date.py:14-18` already provides `bs_to_ad`.
- The BS detection is a shape heuristic (`len==10 and s[4]=="-"`), so `2015-07-28` (an AD date) is silently stored as a **BS** date, and `2071/07/28` (slash-separated, common in MoE sheets) is dropped entirely.
- The five school-level establishment-date columns (`:76-80`) are mapped but **never read** by `_import_school_level` — they are parsed out of the sheet and thrown away.

### 6.6 What breaks on real MoE files

1. **Legacy `.xls`** → 500 (§6.1).
2. **Merged/multi-row headers** (real IEMIS exports carry a title band above the header): `_parse_excel` takes the *first non-empty row* as the header (`:146-154`), so a title row becomes the header, every column becomes an "unknown column" warning, and every row imports as `Missing required field: Full Name`.
3. **Devanagari names/headers**: header keys must match ASCII English exactly; the gender normaliser handles two Nepali words but nothing else does.
4. **No IEMIS Student Id column** (common in section-wise exports) → unbounded duplicate creation on every re-run (§6.4).
5. **Class labels** like `"Class 10"`, `"१०"`, `"10 A"` → duplicate `Class` rows with no `numeric_grade`, which then breaks promotion (`academic_rollover.py:174-194` keys on `numeric_grade`/`sort_order`, both NULL for imported classes) and EMIS export ordering (`report_generation.py:274` orders by `numeric_grade`).
6. **Placeholder phones**: every phone-less student gets a synthetic `9800000xxxx` (`:261-287`) marked `permissions.placeholder_phone=True` — honest, but these numbers are in the **real** NTC 980 range, so any SMS blast to imported students dials live third-party numbers. Nothing filters `placeholder_phone` in `tasks/sms_sender.py`.
7. **Synthetic emails** `stud.<id>@<slug>.import.local` (`:552-556`) are written into `users.email`, which is used as a login identifier — non-deliverable by design (`.local`), so password reset can never work for imported students.
8. **Excel `read_only=True` + `data_only=True`** (`:135`) means formula cells return `None` when the file was never opened in Excel — a formula-driven MoE sheet imports as empty.

---

## 7. Gaps vs a complete Nepal school ERP

Each row: what is missing, the concrete route(s) to add, the payload, and the tables needed. "New table" means no model exists today.

### 7.1 Money gaps

| # | Gap | New route(s) | Payload | Tables |
|---|---|---|---|---|
| G1 | **Partial refunds** (only full Khalti refunds exist, `fees.py:1972`) | `POST /fees/collections/<id>/refunds` | `{amount, reason, method(khalti\|esewa\|cash\|bank\|cheque\|adjustment), gateway_ref?, refund_date}` | `fee_refunds` (exists), **+ negative-amount `fee_receipts` rows or a new `fee_receipt_reversals`** so `Σreceipts` nets out |
| G2 | **Offline refunds / cash refunds** | same route with `method=cash` and an approval step `POST /fees/refunds/<id>/approve` | `{approved:true, note}` | `fee_refunds` + `status` transitions `requested→approved→paid` |
| G3 | **Bank reconciliation** | `POST /fees/bank-statements` (upload CSV/MT940), `GET /fees/bank-statements/<id>/lines`, `POST /fees/bank-statements/<id>/match`, `GET /fees/reconciliation/unmatched` | upload: multipart `file`,`account_id`; match: `{lines:[{line_id, receipt_id\|collection_id, amount}]}` | **new** `bank_accounts`, `bank_statement_imports`, `bank_statement_lines`, `bank_reconciliation_matches` |
| G4 | **Late-fine engine** (no fine is ever computed, §2.5) | `GET/PUT /fees/fine-rules`, `POST /fees/fines/run` (also a nightly task) | rules: `{fee_type, grace_days, mode(flat\|per_day\|percent), amount, cap, applies_from_bs}` | **new** `fee_fine_rules`, `fee_fine_applications`; **`fee_collections.due_date_ad/due_date_bs` columns** (today the due date is a `notes` substring, `fees.py:2536-2551`) |
| G5 | **Scholarship workflow** (rows are bare per-student discounts) | `GET/POST /fees/scholarship-schemes`, `POST /fees/scholarship-applications`, `POST /fees/scholarship-applications/<id>/decision` | scheme: `{name, funder, discount_type, discount_value, criteria{}, seats, academic_year_id}`; application: `{student_id, scheme_id, documents[], remarks}`; decision: `{status(approved\|rejected), approved_value, valid_from_bs, valid_until_bs, note}` | **new** `scholarship_schemes`, `scholarship_applications`; link `student_scholarships.scheme_id`, `application_id` |
| G6 | **Transport fee billing** (`transport.py` has routes/buses/stops with `student_ids` at `:200,331` but **no fee link**) | `GET/PUT /transport/fare-rules`, `POST /transport/billing/run` | fare rule: `{stop_id\|route_id, monthly_amount, one_way_discount_pct}`; run: `{month_bs, class_id?}` | **new** `transport_fare_rules`, `student_transport_subscriptions`; writes `fee_collections` with `fee_item_name="Transport Fee"` |
| G7 | **Hostel fee billing** (`hostel.py:163` stores `monthly_fee` on the room; nothing bills it) | `POST /hostel/billing/run` | `{month_bs}` | `hostel_allocations` (exists) → `fee_collections` |
| G8 | **Canteen wallet** (zero code — `grep -i canteen` = 0 hits) | `GET /canteen/wallets/<student_id>`, `POST /canteen/wallets/<student_id>/topup`, `POST /canteen/transactions`, `GET /canteen/menu`, `GET /canteen/statements/<student_id>` | topup: `{amount, method, reference, idempotency_key}`; txn: `{student_id, items:[{menu_item_id,qty}], total, terminal_id, idempotency_key}` | **new** `canteen_wallets`, `canteen_wallet_ledger`, `canteen_menu_items`, `canteen_transactions` |
| G9 | **Fee waiver / write-off with authority trail** (`payment_status="waived"` is set silently at `fees.py:2665`) | `POST /fees/collections/<id>/waive` | `{amount, reason, authority(principal\|committee), approved_by_id}` | **new** `fee_waivers`; reuse `payment_status='waived'` |
| G10 | **TDS/SSF/PF payroll statutory engine** (§2.12) | `GET/PUT /hr/payroll/tax-config`, `GET /hr/payroll/<id>/statutory-breakdown`, `GET /hr/reports/etds?fy=`, `GET /hr/staff/<user_id>/salary-certificate?fy=` | tax-config: `{fy_bs, slabs:[{upto, rate}], marital_threshold, ssf{employee_pct,employer_pct}, pf{employee_pct,employer_pct}, cit_cap, sst_rate}` | **new** `payroll_tax_configs`, `payroll_statutory_lines`, `payroll_ytd_accumulators`; **`users.pan_number`, `users.ssf_number` columns** |
| G11 | **IRD / VAT register + credit notes** (§2.11) | `GET /fees/vat-register?from&to`, `POST /fees/credit-notes`, `GET /fees/fiscal-years/<fy>/close` | credit note: `{receipt_id, amount, reason}` | **new** `fee_credit_notes`, `fiscal_year_closes`; `schools.is_vat_registered` column |
| G12 | **CEHRD fee-cap report** — `money.classify_fee_cap_heading` (`money.py:109-115`) and `FEE_CAP_HEADINGS` (`:63-78`) exist with **zero callers** | `GET /compliance/fee-cap-report?academic_year=` | — | `fee_structures.fee_items[*].cap_heading` (add) + read-only aggregate |
| G13 | **Double-entry / day-book** — there is no chart of accounts; `Expense` (`hr_payroll.py:1096`) and `FeeReceipt` are unrelated islands | `GET /accounts/ledger`, `GET /accounts/trial-balance`, `GET /accounts/day-book?date=` | — | **new** `chart_of_accounts`, `journal_entries`, `journal_lines` |
| G14 | **Fee heads on `FeeCollection`** — the fee "type" is a free-text `fee_item_name` string (`models/fee.py:48`), so `FeeType` rows and scholarship `fee_type` matching are string-joined | migrate to `fee_collections.fee_type_id` FK | — | `fee_types` (exists) + FK column |

### 7.2 Academic gaps

| # | Gap | New route(s) | Payload | Tables |
|---|---|---|---|---|
| G15 | **Transcripts** (§3.6 — do not exist) | `GET /exams/transcripts/<student_id>?from_year&to_year`, `GET /exams/transcripts/<student_id>/pdf`, `POST /exams/transcripts/bulk-pdf` | bulk: `{class_id, academic_year_id, template_id}` | **new** `student_transcripts` (cached snapshot) reading `marks`+`exams`+`report_cards`; `students.symbol_no`, `students.registration_no` columns |
| G16 | **Per-school grading scales** (§3.7) | `GET/POST /academics/grading-scales`, `PUT /academics/grading-scales/<id>`, `POST /academics/grading-scales/<id>/activate` | `{name, board(neb\|cbse\|custom), bands:[{min_pct,grade,gpa,description}], theory_pass_pct, practical_pass_pct, is_default}` | **new** `grading_scales`, `grading_scale_bands`; thread `school_id` through `nepal_grading.calculate_grade` |
| G17 | **Re-evaluation / recheck** (`grep -i reevaluation` = 0 hits) | `POST /exams/<exam_id>/reevaluations`, `GET /exams/reevaluations?status=`, `POST /exams/reevaluations/<id>/decision` | request: `{student_id, subject_id, reason, fee_amount}`; decision: `{status(approved\|rejected), revised_theory, revised_practical, remarks}` | **new** `exam_reevaluations`; must also write a `fee_collections` row for the recheck fee and re-run grading + rank |
| G18 | **Marks lock / result freeze** (§3.1 — publish does not lock) | `POST /exams/<exam_id>/lock-marks`, `POST /exams/<exam_id>/unlock-marks` (superadmin), `GET /exams/<exam_id>/marks-audit` | lock: `{class_id?, subject_id?}`; unlock: `{reason}` | `exams.marks_locked_at/by` columns + **new** `marks_audit_log` (`old_*`, `new_*`, actor, reason) |
| G19 | **Seat plan / exam seating + admit cards as first-class data** (`generate_bulk_admit_cards` exists in Design Studio only, `bulk_generator.py:305`; no seating model) | `POST /exams/<exam_id>/seat-plan/generate`, `GET /exams/<exam_id>/seat-plan`, `GET /exams/<exam_id>/admit-cards/bulk-pdf` | generate: `{rooms:[{name,rows,cols,capacity}], class_ids[], mixing(alternate_class\|sequential), symbol_no_series}` | **new** `exam_rooms`, `exam_seat_allocations`; `students.symbol_no` |
| G20 | **Subject-wise / period-wise attendance** (§4.1) | `POST /attendance/period-mark`, `GET /attendance/subject-summary?student_id&subject_id` | `{date, class_id, section_id, subject_id, period_number, records:[{student_id,status}]}` | **new** `period_attendance` (unique on `school_id,student_id,date,period_number`) — the existing `attendance` unique key cannot be extended in place |
| G21 | **Student leave requests** (§4.3 — students have no workflow) | `POST /attendance/student-leave-requests`, `GET …`, `POST …/<id>/approve\|reject` | `{student_id, leave_type, start_date, end_date, reason, attachment_url}` | **new** `student_leave_requests`; on approval write `attendance(status="leave")` for the range |
| G22 | **Leave entitlement / balance ledger** (§4.3) | `GET/PUT /hr/leave-policies`, `GET /hr/staff/<user_id>/leave-balance` | policy: `{leave_type, annual_days, carry_forward_max, encashable, accrual(monthly\|annual)}` | **new** `leave_policies`, `leave_balances` |
| G23 | **Real timetable solver inputs** (§4.4) | `GET/PUT /timetable/requirements`, `GET/PUT /timetable/constraints`, `POST /timetable/generate` (extended), `GET /timetable/conflicts`, `GET /timetable/teacher-load` | requirements: `[{class_id,section_id,subject_id,periods_per_week,double_periods,requires_room_type}]`; constraints: `{teacher_unavailable:[{teacher_id,day,periods[]}], max_periods_per_day, max_periods_per_week, no_first_period:[subject_id], pinned_slots:[…]}` | **new** `timetable_requirements`, `timetable_constraints`, `rooms`, `school_calendar_days`; `timetable_slots.start_time/end_time` must be populated |
| G24 | **Working-day / holiday calendar** (§4.2 — attendance % denominators are invented) | `GET/POST /academics/calendar-days`, `POST /academics/calendar/import-nepali-holidays` | `{date_ad, date_bs, kind(working\|holiday\|exam\|event), name, applies_to(all\|class_ids)}` | **new** `school_calendar_days` |
| G25 | **Co-scholastic / behaviour grades on the report card** (report cards carry only marks) | `POST /exams/<exam_id>/coscholastic`, `GET …` | `{student_id, items:[{area, grade, remark}]}` | **new** `coscholastic_assessments` |
| G26 | **Character certificate / TC document render** (`student_transfers` stores the row, `students.py:886`, but produces no document) | `GET /students/transfers/<id>/pdf`, `GET /students/<id>/character-certificate/pdf` | — | reuse `student_transfers` + Design Studio template |
| G27 | **Section rank / stream rank** (`Marks.rank_in_section` is a dead column, `models/exam.py:117`) | extend `GET /exams/<id>/results` with `?rank_scope=class\|section\|stream\|school` | — | write `marks.rank_in_section`, `report_cards.rank_in_section` |
| G28 | **Report-card job status** (§3.5 — fire-and-forget) | `POST /exams/<id>/report-cards` returns `{job_id}`; add `GET /exams/report-card-jobs/<job_id>` | — | **new** `report_card_jobs` (or reuse a generic `background_jobs`) |

### 7.3 Compliance / integration gaps

| # | Gap | New route(s) | Payload | Tables |
|---|---|---|---|---|
| G29 | **MoE Flash Report I/II is unreachable** — `MoEReportService.generate_flash_report` (`moe_reports.py:45-84`) has zero callers | `POST /compliance/flash-report` (`{report_type:"flash_1"\|"flash_2", academic_year}`), `GET /compliance/flash-report/<id>/pdf` | as shown | `compliance_reports` (exists) |
| G30 | **`POST /compliance/emis/generate` never generates anything** — it stores the client's `data` blob (`compliance.py:141-153`) while the real builder lives in a Celery task (`report_generation.py:258`) | rewire the route to `export_emis_data.delay(school_id, academic_year_id)` and return a job handle | `{academic_year_id}` | `emis_exports` (exists) |
| G31 | **IEMIS export (upload back to MoE)** — only import exists | `POST /iemis/export`, `GET /iemis/exports/<id>/download` | `{format(student_namewise\|staff_details\|school_level), academic_year_id}` | **new** `iemis_exports` |
| G32 | **SEE/NEB result import** (board results cannot come back in) | `POST /exams/board-results/import` | multipart `file`, `{exam_id, board(see\|neb), mapping{symbol_no,subject_code}}` | **new** `board_result_imports`; matches on `students.symbol_no` |
| G33 | **`payment_initiations` never expire / never fail** (§2.10 — nothing writes `status="failed"`) | nightly task + `POST /fees/payment-initiations/<id>/fail` | `{reason}` | `payment_initiations` (exists) |
| G34 | **Gateway secrets stored in plaintext JSONB** (§2.9) | no new route — encrypt at rest via a KMS/Fernet column type | — | `schools.fee_config` → `school_payment_credentials` with an encrypted column |

---

## 8. Endpoints with no UI consumer

Method: enumerated every API path literal in `frontend/{app,components,lib,src}` (`*.ts`,`*.tsx`) and in `{flutter_admin,flutter_parent,flutter_student,flutter_teacher,flutter_user}/lib` + `aschool_shared` (`*.dart`), excluding `.next/` build output and `node_modules`. Counts below are file counts of a matching literal.

### 8.1 Zero consumers in web **and** all five Flutter apps

| Endpoint | Backend line | Notes |
|---|---|---|
| `GET/POST/PUT/DELETE /academics/semesters[/<id>]` (4 routes) | `academics.py:115,130,145,164` | Full CRUD, `Semester` model, `is_current` exclusivity — **no UI anywhere**. Semester-based schools are unreachable. |
| `GET/POST/PUT/DELETE /academics/mediums[/<id>]` (4) | `academics.py:176,184,199,215` | `Class.medium_id`/`Section.medium_id` are populated by the class dialogs, but the medium list itself is never fetched |
| `GET/POST/PUT/DELETE /academics/streams[/<id>]` (4) | `academics.py:227,239,254,270` | same — `stream_id` is settable but no picker source |
| `GET/POST/PUT/DELETE /academics/shifts[/<id>]` (4) | `academics.py:282,290,305,321` | same |
| `GET /academics/curriculum/frameworks` and `/<id>` | `academics.py:983,1014` | Consumed only server-side by the AI workbench; no web/mobile call |
| `GET /academics/subject-offerings` | `academics.py:1039` | The NEB theory/practical grid — the marks-entry UI never reads it, so per-subject NEB defaults never reach the form |
| `GET/POST /attendance/leave-requests`, `POST …/<id>/approve`, `POST …/<id>/reject` (4) | `attendance.py:533,550,586,640` | **The only leave system with attendance write-through is entirely unconsumed**; both UIs use `/hr/leave*` instead (§4.3) |
| `POST /hr/leave/<id>/approve` | `hr_payroll.py:700` | Web uses `PATCH /hr/leaves/<id>` (`hr_payroll.py:731`) instead |
| `GET /reports/attendance/summary/pdf` | `reports.py:489` | Real WeasyPrint export, no download button |
| `GET /reports/exams/results/pdf` | `reports.py:664` | same |
| `GET /analytics/benchmarking` | `analytics.py:479` | The web benchmarking page calls `/benchmarking/overview` (`frontend/app/dashboard/benchmarking/page.tsx:25`) — a **different** blueprint. This endpoint (the platform's worst-performing one, R12) is dead. |
| `GET /compliance/emis`, `POST /compliance/emis/generate`, `GET /compliance/emis/<id>/download` (3) | `compliance.py:124,134,156` | The web compliance page only calls `/compliance/reports` (`frontend/app/dashboard/compliance/page.tsx:21`) |
| `GET /api/v1/webhooks` (catalog) | `webhooks.py:12` | superadmin-only catalog, no UI |
| `GET /exams/<id>/subjects` | `exams.py:845` | ⚠ borderline — a templated literal `/exams/${...}/subjects` **does** appear in Flutter (`flutter_teacher`, `flutter_admin`); counted as consumed |

**Subtotal: 27 endpoints with zero consumers**, dominated by the four academic-dimension CRUD families (16 routes) — i.e. the entire `Semester`/`Medium`/`Stream`/`Shift` configuration layer is backend-only.

### 8.2 Backend-only service code with zero callers (not endpoints, but the same dead-weight class)

| Symbol | Location | Callers |
|---|---|---|
| entire `app/utils/money.py` (`to_decimal`, `money`, `add`, `sub`, `mul`, `pct`, `net_payable`, `split_vat_inclusive`, `classify_fee_cap_heading`, `FEE_CAP_HEADINGS`) | `money.py:13-115` | **0** repo-wide |
| `MoEReportService.generate_flash_report` / `generate_emis_export` | `moe_reports.py:45,86` | 0 |
| `EsewaGateway.check_transaction_status` | `esewa_gateway.py:131` | 0 |
| `generate_monthly_fee_report` (Celery, returns a dict nobody reads) | `fee_reminders.py:313` | no route, no beat entry consumer |
| `teacher_map` in the timetable solver | `timetable_solver.py:34` | assigned, never read |
| `room_schedule` in the timetable solver | `timetable_solver.py:42` | assigned, never read |
| `Timetable` / `TimetablePeriod` / `Substitution` models | `models/timetable.py:16,29,49` | the API uses only `TimetableSlot`; these three tables are unused |
| `Marks.rank_in_section`, `Marks.is_withheld`, `Marks.teacher_id` | `models/exam.py:117,124,85` | never written |
| `payment_initiations.status = "failed"` | `models/fee.py:172` | never written (read at `webhooks/__init__.py:699`) |

### 8.3 Consumed by exactly one surface (fragile, listed for completeness)

`GET /fees/recent` and `GET /fees/outstanding` — **Flutter only** (`fees.py:549,583`); `GET /attendance/school-overview` and `GET /reports/dashboard` — **Flutter only** (`attendance.py:358`, `reports.py:434`); `POST /fees/initiate-payment` — **Flutter parent only** (`fees.py:1767`); `POST /fees/collections/<id>/pay-online` — **web only** (`fees.py:1758`); `POST /fees/collections/<id>/refund` — **web only, and the only web hit is a status pill label** (`frontend/components/ui/status-pill.tsx:56` maps the `refunded` status; no code calls the refund route) → in practice **the refund endpoint has no caller either**.

<!--SECTION9-->
