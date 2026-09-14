# Handoff Report — Explorer 2 (Milestone 1)

**Working Directory**: `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_2`  
**Parent Agent**: `parent` (`df2d9bfa-2996-4d4a-aafe-9480a23f43cb`)  
**Scope**: Milestone 1 (Features 2, 3, 5, 6)

---

## 1. Observation

1. **Benchmarking Dead Imports (`backend/app/api/v1/benchmarking.py:87-95`)**:
   - Lines 87–95 contain:
     ```python
     from datetime import date, timedelta

     from app.models.academic import Class
     from app.models.exam import ReportCard
     from app.models.attendance import Attendance
     from app.models.exam import Exam
     from app.models.student import Student
     from app.models.user import User
     ```
   - Running Python AST inspection `ast.parse(inspect.getsource(_rankings_rows))` confirmed:
     - `Class` occurrences = 0.
     - `Exam` occurrences = 0.
     - `Exam` is already imported locally inside helper `db_query_latest_exam_ids()` at line 205.
     - `ReportCard` was previously imported from `app.models.analytics` (triggering 500), but is now from `app.models.exam`.

2. **GPS Haversine Formula & Role Enums (`backend/app/tasks/gps_processing.py:174-210`)**:
   - Line 178 now reads: `dlon = math.radians(lon2 - lon1)`.
   - Tested coordinates: Kathmandu Durbar Square (27.7042, 85.3068) to Thamel (27.7154, 85.3123).
     - Correct formula: `1.358 km` (< 2.0 km geofence radius).
     - Buggy formula (`lon2 - lat1`): `5615.195 km` (> 2.0 km threshold).
   - Target push notification roles (line 205): `roles=["superadmin", "school_admin"]`.
   - PostgreSQL `user_role` enum (`backend/app/models/user.py:27-36`):
     `"superadmin", "school_admin", "accountant", "teacher", "staff", "parent", "student"`.
   - Transport coordinators/drivers are categorized as `"staff"`.
   - `backend/tests/test_gps_pipeline.py` currently contains tests for `process_gps_data` and poller, but **zero** tests for `check_geofence_alerts`.

3. **FAQ Role & School Authorization (`backend/app/api/v1/faqs.py:51-100`)**:
   - `POST /faqs` (line 53), `PUT /faqs/<faq_id>` (line 76), `DELETE /faqs/<faq_id>` (line 90) have `@role_required("superadmin", "school_admin")`.
   - `@school_required` is **not imported** and **not applied** to any route in `faqs.py`.
   - `FAQ.school_id` (`backend/app/models/faq.py:12`) is `nullable=False`.
   - A request to `POST /faqs` without school context sets `school_id=g.school_id=None`, crashing with `IntegrityError` 500 on `db.session.commit()`.
   - `backend/tests/test_tenant_isolation_hostel_faq.py` only tests cross-school update/delete 404, not role rejection or school context enforcement.

4. **Server-Side LMS Quiz Score Computation (`backend/app/api/v1/lms.py:312-357`)**:
   - `POST /api/v1/lms/quizzes/<quiz_id>/attempt` passes `answers` to `_score_quiz(quiz, answers)` and never reads client-supplied `score`.
   - Empirical test execution identified:
     - Question ID keys (`answers={"q1": "..."}`) yield 0 score because `_score_quiz` only checks `str(i)` / `i`.
     - Casing mismatch (`"water"` vs `"Water"`) yields 0 score due to strict equality `str(given) == str(...)`.
     - Multi-select lists (`correct_answer=["A", "B"]`) yield 0 score due to list stringification `str(["A", "B"])`.
     - Explicit 0-mark questions award 1 mark due to `float(q.get("marks") or 1)`.
     - Non-numeric marks raise `ValueError` 500.
     - `backend/tests/` has **zero** unit tests for `_score_quiz` or `submit_quiz_attempt`.

---

## 2. Logic Chain

1. From AST evidence, `Class` and `Exam` in `_rankings_rows()` are unreferenced → therefore, pruning them eliminates dead code and prevents confusion during maintenance without breaking runtime behavior.
2. From Great-Circle trigonometry, `dlon = lon2 - lon1` accurately models angular displacement along the longitudinal meridian → therefore, the current formula in `gps_processing.py` is correct, but expanding target roles to include `"staff"` ensures transport operators receive alerts.
3. From PostgreSQL constraints, inserting `None` into `faqs.school_id` triggers `NotNullViolation` → therefore, adding `@school_required` prevents 500 errors by rejecting requests lacking school context with 400 Bad Request.
4. From empirical test execution of `_score_quiz()`, real-world quiz submissions with question IDs, different casing, or multi-select options fail exact string matching against question indices → therefore, normalizing answers and checking question IDs ensures robust assessment scoring across web and mobile clients.

---

## 3. Caveats

- In `check_geofence_alerts`, `superadmin` users who lack a `school_id` tag or token context will not receive school-filtered pushes; alerts depend on school-scoped users (`school_admin`, `staff`).
- For LMS quizzes, open-ended free text questions that require subjective grading are not handled by `_score_quiz` and must be scored manually or via teacher review workflows.

---

## 4. Conclusion

All four Milestone 1 features have been thoroughly investigated with complete root causes, failure modes, and concrete patch proposals.
- Feature 2: Clean dead imports `Class` and `Exam` from `_rankings_rows()`.
- Feature 3: Haversine formula is validated; update alert roles to `["superadmin", "school_admin", "staff"]` and add unit tests to `test_gps_pipeline.py`.
- Feature 5: Add `@school_required` to all school-scoped FAQ routes in `faqs.py` and add role tests to `test_tenant_isolation_hostel_faq.py`.
- Feature 6: Harden `_score_quiz()` with answer set normalization, question ID lookup, safe float coercion, and dedicated unit test suite.

---

## 5. Verification Method

1. Run AST import hygiene check:
   ```bash
   PYTHONPATH=backend backend/.venv/bin/python -c '
   import ast, inspect
   from app.api.v1.benchmarking import _rankings_rows
   source = inspect.getsource(_rankings_rows)
   assert "import Class" not in source
   assert "import Exam" not in source
   print("Hygiene check: PASS")
   '
   ```
2. Verify GPS geofence test:
   ```bash
   backend/.venv/bin/pytest backend/tests/test_gps_pipeline.py
   ```
3. Verify FAQ `@school_required` decorator presence:
   ```bash
   PYTHONPATH=backend backend/.venv/bin/python -c '
   import inspect
   from app.api.v1.faqs import list_faqs, create_faq, update_faq, delete_faq
   for fn in (list_faqs, create_faq, update_faq, delete_faq):
       assert "@school_required" in inspect.getsource(fn)
   print("FAQ school_required check: PASS")
   '
   ```
4. Verify LMS quiz scoring test:
   ```bash
   backend/.venv/bin/pytest backend/tests/test_lms_quiz_scoring.py
   ```
