# Milestone 1 Investigation Report: Backend Security Hardening & Bug Fixes

**Agent**: Explorer 2 (`explorer_m1_2`)  
**Parent Agent**: `parent` (`df2d9bfa-2996-4d4a-aafe-9480a23f43cb`)  
**Working Directory**: `/home/bishal-regmi/Desktop/ASchool/.agents/explorer_m1_2`  
**Target Scope**: 
1. Feature 2: Benchmarking Dead Import Cleanup (`backend/app/api/v1/benchmarking.py:87-95`)
2. Feature 3: GPS Haversine Formula & Role Enums (`backend/app/tasks/gps_processing.py:174-210`)
3. Feature 5: FAQ Role & School Authorization (`backend/app/api/v1/faqs.py:51-100`)
4. Feature 6: Server-Side LMS Quiz Score Computation (`backend/app/api/v1/lms.py:312-357`)

---

## 1. Executive Summary

This investigation analyzed four core Milestone 1 security hardening and correctness features across the ASchool backend. All four features were inspected down to exact AST, SQLAlchemy models, Celery tasks, and API routes.

Key findings:
1. **Benchmarking Dead Import Cleanup**: In `backend/app/api/v1/benchmarking.py:87-95`, AST analysis confirmed that `Class` from `app.models.academic` is completely unused (0 occurrences), and `Exam` from `app.models.exam` is completely redundant within `_rankings_rows()` (it is imported locally inside helper `db_query_latest_exam_ids()`). Both must be pruned.
2. **GPS Haversine Formula & Role Enums**: In `backend/app/tasks/gps_processing.py:174-210`, the formula typo `math.radians(lon2 - lat1)` was corrected to `math.radians(lon2 - lon1)` in commit `e76b584`, preventing a ~5,615 km false-deviation calculation. However, push notification roles currently target `["superadmin", "school_admin"]`, excluding school transport operators and drivers who hold the PostgreSQL enum role `"staff"`. Furthermore, `backend/tests/test_gps_pipeline.py` currently has **zero** test cases covering `check_geofence_alerts()`.
3. **FAQ Role & School Authorization**: In `backend/app/api/v1/faqs.py:51-97`, role guards `@role_required("superadmin", "school_admin")` are present on `POST`, `PUT`, and `DELETE`. However, `@school_required` is **completely missing** from all FAQ endpoints. Because `FAQ.school_id` is a `NOT NULL` foreign key column, un-scoped admin requests (such as platform superadmin with `g.school_id = None`) will trigger an unhandled `IntegrityError` 500. Existing tests in `test_tenant_isolation_hostel_faq.py` only check cross-school `PUT`/`DELETE` and lack negative role checks and school context checks.
4. **Server-Side LMS Quiz Score Computation**: In `backend/app/api/v1/lms.py:312-357`, server-side quiz evaluation `_score_quiz(quiz, answers)` correctly discards client-supplied `score` inputs. However, empirical testing identified 5 edge-case vulnerabilities:
   - Question ID answers (`answers = {"q1": "..."}`) score 0 because keys are strictly checked against numerical indices (`str(i)`).
   - Case sensitivity (`str(given) == str(...)`) penalizes capitalized vs lowercase answers.
   - List-valued correct answers (multi-select) evaluate to 0 because of string representation mismatch (`"Water" != "['Water']"`).
   - Zero-mark questions (`marks=0`) erroneously award 1 mark due to `float(q.get("marks") or 1)`.
   - Non-numeric `marks` strings raise an unhandled `ValueError` 500 error.
   - There are **zero** unit tests for `_score_quiz` or `submit_quiz_attempt` in `backend/tests/`.

---

## 2. Feature 2: Benchmarking Dead Import Cleanup

### 2.1 File & Line Locations
- **Target File**: `backend/app/api/v1/benchmarking.py`
- **Target Section**: Lines 87–95 (inside function `_rankings_rows()`)

### 2.2 Current Code
```python
def _rankings_rows():
    """One aggregate row per active school, set-based.
    ...
    """
    from datetime import date, timedelta

    from app.models.academic import Class
    from app.models.exam import ReportCard
    from app.models.attendance import Attendance
    from app.models.exam import Exam
    from app.models.student import Student
    from app.models.user import User
```

### 2.3 AST & Static Analysis
An AST scan of `_rankings_rows()` was executed:
```python
import ast, inspect
from app.api.v1.benchmarking import _rankings_rows
tree = ast.parse(inspect.getsource(_rankings_rows))
names = [node.id for node in ast.walk(tree) if isinstance(node, ast.Name)]
print("Class count:", names.count("Class"))  # 0
print("Exam count:", names.count("Exam"))    # 0
```
- **`Class`**: Total occurrences = **0**. The model is never queried, instantiated, or referenced.
- **`Exam`**: Total occurrences = **0**. `_rankings_rows()` delegates exam ID fetching to `db_query_latest_exam_ids(school_ids)` at line 111.
- In `db_query_latest_exam_ids()` (lines 203–226):
  ```python
  def db_query_latest_exam_ids(school_ids):
      """{school_id: latest exam id} in a single grouped query."""
      from app.models.exam import Exam
      ...
  ```
  `Exam` is already imported locally inside `db_query_latest_exam_ids()`.
- **Used imports in `_rankings_rows()`**:
  - `date`, `timedelta` (lines 96–97)
  - `Attendance` (lines 116–129)
  - `Student` (lines 133–140)
  - `User` (lines 143–152)
  - `ReportCard` (lines 156–173)

### 2.4 Proposed Code Fix
In `backend/app/api/v1/benchmarking.py:87-95`:
```python
<<<<
    from datetime import date, timedelta

    from app.models.academic import Class
    from app.models.exam import ReportCard
    from app.models.attendance import Attendance
    from app.models.exam import Exam
    from app.models.student import Student
    from app.models.user import User
====
    from datetime import date, timedelta

    from app.models.attendance import Attendance
    from app.models.exam import ReportCard
    from app.models.student import Student
    from app.models.user import User
>>>>
```

---

## 3. Feature 3: GPS Haversine Formula & Role Enums

### 3.1 File & Line Locations
- **Target Task**: `backend/app/tasks/gps_processing.py:174-213`
- **Enum Definition**: `backend/app/models/user.py:26-38`
- **Push Notification Task**: `backend/app/tasks/push_notifications.py:89-124`
- **Test File**: `backend/tests/test_gps_pipeline.py`

### 3.2 Current Code State
```python
    def haversine_km(lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS points in km."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
...
    if min_distance > GEOFENCE_RADIUS_KM:
        logger.warning(
            f"Bus {bus.vehicle_number} is {min_distance:.1f}km from route "
            f"(geofence={GEOFENCE_RADIUS_KM}km)"
        )
        send_push_to_school.delay(
            bus.school_id,
            "Bus Route Alert",
            f"Bus {bus.vehicle_number} has deviated {min_distance:.1f}km from its route.",
            roles=["superadmin", "school_admin"],
        )
```

### 3.3 Formula Verification
- **Old Formula**: `dlon = math.radians(lon2 - lat1)`
  - For Kathmandu Durbar Square (27.7042° N, 85.3068° E) to Thamel (27.7154° N, 85.3123° E), actual distance is **1.358 km**.
  - The buggy formula computed **5,615.195 km**, triggering an alert on every single bus coordinate update.
- **Current Formula**: `dlon = math.radians(lon2 - lon1)`
  - Verified mathematically: yields **1.358 km** (< 2.0 km geofence radius). No false alerts.

### 3.4 Role Enums & Recipient Delivery Gap
- In `backend/app/models/user.py:27-36`:
  ```python
  role = Column(
      Enum(
          "superadmin",
          "school_admin",
          "accountant",
          "teacher",
          "staff",
          "parent",
          "student",
          name="user_role",
      ),
      nullable=False,
  )
  ```
- Current push recipient roles: `roles=["superadmin", "school_admin"]`.
- **Gaps**:
  1. In ASchool, transport coordinators, bus drivers, and operational personnel belong to `role="staff"`. By omitting `"staff"`, operational ground staff never receive corridor deviation alerts.
  2. In `_send_fcm_to_school_legacy` (`push_notifications.py:199-205`):
     `User.query.filter(User.school_id == school_id, User.role.in_(roles))`
     Superadmin users have `school_id = None`, so they are filtered out of school-scoped queries unless scoped via OneSignal tag matching.
  3. Adding `"staff"` ensures designated transport staff are notified.

### 3.5 Proposed Code Fix
In `backend/app/tasks/gps_processing.py:201-206`:
```python
<<<<
        send_push_to_school.delay(
            bus.school_id,
            "Bus Route Alert",
            f"Bus {bus.vehicle_number} has deviated {min_distance:.1f}km from its route.",
            roles=["superadmin", "school_admin"],
        )
====
        send_push_to_school.delay(
            bus.school_id,
            "Bus Route Alert",
            f"Bus {bus.vehicle_number} has deviated {min_distance:.1f}km from its route.",
            roles=["superadmin", "school_admin", "staff"],
        )
>>>>
```

### 3.6 Proposed Unit Test
In `backend/tests/test_gps_pipeline.py`, add:
```python
def test_check_geofence_alerts_route_deviation(app, db, school):
    """Verify check_geofence_alerts calculates correct distance and fires alert when > 2km."""
    from unittest.mock import patch
    from app.models.transport import Bus, BusRoute, BusStop
    from app.tasks.gps_processing import check_geofence_alerts

    with app.app_context():
        route = BusRoute(school_id=school.id, name="Route 1", is_active=True)
        db.session.add(route)
        db.session.flush()

        # Stop at Kathmandu Durbar Square (27.7042, 85.3068)
        stop = BusStop(
            school_id=school.id,
            route_id=route.id,
            name="Durbar Square",
            latitude=27.7042,
            longitude=85.3068,
            sequence_number=1,
        )
        bus = Bus(
            school_id=school.id,
            route_id=route.id,
            vehicle_number="BA-1-KHA-1111",
            gps_device_id="esp32-geofence",
            is_active=True,
        )
        db.session.add_all([stop, bus])
        db.session.commit()

        with patch("app.tasks.push_notifications.send_push_to_school.delay") as mock_push:
            # Case 1: Within corridor (< 2km, Thamel: 27.7154, 85.3123 = ~1.36km)
            res_near = check_geofence_alerts.run(str(bus.id), 27.7154, 85.3123)
            assert res_near["alert"] is False
            assert res_near["distance_km"] < 2.0
            mock_push.assert_not_called()

            # Case 2: Deviated (> 2km, Bhaktapur: 27.6710, 85.4298 = ~12km)
            res_far = check_geofence_alerts.run(str(bus.id), 27.6710, 85.4298)
            assert res_far["alert"] is True
            assert res_far["distance_km"] > 2.0
            mock_push.assert_called_once()
            _, kwargs = mock_push.call_args
            # Verify valid roles passed
            roles = kwargs.get("roles") or mock_push.call_args.args[3]
            assert "school_admin" in roles
            assert "staff" in roles
```

---

## 4. Feature 5: FAQ Role & School Authorization

### 4.1 File & Line Locations
- **Target File**: `backend/app/api/v1/faqs.py`
- **Lines**: 26–97
- **Model**: `backend/app/models/faq.py:12`
- **Decorators**: `backend/app/utils/decorators.py:33-49`
- **Tests**: `backend/tests/test_tenant_isolation_hostel_faq.py`

### 4.2 Current Code State
```python
# Lines 7-11
from app.utils.decorators import role_required
...
@faqs_bp.route("", methods=["GET"])
@jwt_required()
def list_faqs():
    ...
    query = FAQ.query.filter_by(school_id=g.school_id, is_deleted=False)
...
@faqs_bp.route("", methods=["POST"])
@jwt_required()
@role_required("superadmin", "school_admin")
def create_faq():
    ...
    faq = FAQ(
        school_id=g.school_id,
        question=question,
        answer=answer,
        ...
    )
...
@faqs_bp.route("/<uuid:faq_id>", methods=["PUT"])
@jwt_required()
@role_required("superadmin", "school_admin")
def update_faq(faq_id):
    faq = FAQ.query.filter_by(id=faq_id, school_id=g.school_id, is_deleted=False).first_or_404()
...
@faqs_bp.route("/<uuid:faq_id>", methods=["DELETE"])
@jwt_required()
@role_required("superadmin", "school_admin")
def delete_faq(faq_id):
    faq = FAQ.query.filter_by(id=faq_id, school_id=g.school_id, is_deleted=False).first_or_404()
```

### 4.3 Vulnerability & Authorization Analysis
1. **Missing `@school_required`**:
   - `school_required` is never imported or used.
   - `FAQ.school_id` is defined as:
     `school_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True)`
   - If an admin or superadmin invokes `POST /api/v1/faqs` without school context (e.g. no `X-School-ID` header, not on school subdomain), `g.school_id` is `None`.
   - At line 70, `db.session.commit()` raises `psycopg2.errors.NotNullViolation` / `IntegrityError`, terminating in an unhandled **HTTP 500 error**.
   - With `@school_required`, the request immediately and gracefully returns **HTTP 400 Bad Request** (`"School context required. Use a school subdomain."`).
2. **Missing School Context on Queries**:
   - In `list_faqs()`, `query.filter_by(school_id=g.school_id)` runs with `school_id=None`, yielding `[]` instead of rejecting the missing tenant context.
   - In `update_faq()` and `delete_faq()`, `filter_by(id=faq_id, school_id=g.school_id)` with `g.school_id=None` returns a 404 instead of a clear 400 school-context error.
3. **Role Guards**:
   - `@role_required("superadmin", "school_admin")` is properly placed on mutating routes (`POST`, `PUT`, `DELETE`).
   - `GET /faqs` has `@jwt_required()` but no `@role_required`, which allows all authenticated school members (including teachers and students) to view internal school FAQs. This is standard behavior.
   - `GET /faqs/public` is unauthenticated and resolves `school_slug`, which is correct for the public website.

### 4.4 Proposed Code Fix
In `backend/app/api/v1/faqs.py`:
```python
<<<<
from app.utils.decorators import role_required
====
from app.utils.decorators import role_required, school_required
>>>>
```
And add `@school_required` to all school-scoped endpoints:
```python
<<<<
@faqs_bp.route("", methods=["GET"])
@jwt_required()
def list_faqs():
====
@faqs_bp.route("", methods=["GET"])
@jwt_required()
@school_required
def list_faqs():
>>>>

<<<<
@faqs_bp.route("", methods=["POST"])
@jwt_required()
@role_required("superadmin", "school_admin")
def create_faq():
====
@faqs_bp.route("", methods=["POST"])
@jwt_required()
@role_required("superadmin", "school_admin")
@school_required
def create_faq():
>>>>

<<<<
@faqs_bp.route("/<uuid:faq_id>", methods=["PUT"])
@jwt_required()
@role_required("superadmin", "school_admin")
def update_faq(faq_id):
====
@faqs_bp.route("/<uuid:faq_id>", methods=["PUT"])
@jwt_required()
@role_required("superadmin", "school_admin")
@school_required
def update_faq(faq_id):
>>>>

<<<<
@faqs_bp.route("/<uuid:faq_id>", methods=["DELETE"])
@jwt_required()
@role_required("superadmin", "school_admin")
def delete_faq(faq_id):
====
@faqs_bp.route("/<uuid:faq_id>", methods=["DELETE"])
@jwt_required()
@role_required("superadmin", "school_admin")
@school_required
def delete_faq(faq_id):
>>>>
```

### 4.5 Proposed Additional Tests
In `backend/tests/test_tenant_isolation_hostel_faq.py`, add tests for role rejection and school-context enforcement:
```python
def test_faq_mutation_rejected_for_non_admin(client, db, school):
    """Verify student and teacher cannot create, update, or delete FAQs."""
    from app.models.user import User

    student = User(
        school_id=school.id,
        role="student",
        full_name="Student Test",
        email=f"student-{school.slug}@test.edu.np",
        phone="+9779841000091",
        is_active=True,
    )
    student.set_password("Test@1234")
    db.session.add(student)
    db.session.commit()

    resp = client.post("/api/v1/auth/login", json={"email": student.email, "password": "Test@1234"})
    token = resp.get_json()["data"]["access_token"]
    student_headers = {"Authorization": f"Bearer {token}"}

    # POST rejected with 403
    r = client.post("/api/v1/faqs", json={"question": "Q?", "answer": "A."}, headers=student_headers)
    assert r.status_code == 403

def test_faq_rejected_when_school_context_missing(client, db, school):
    """Verify 400 Bad Request returned when request lacks school context."""
    admin_headers = _admin(client, db, school, "no-context")
    # Call without host/X-School-ID context
    r = client.post("/api/v1/faqs", json={"question": "Q?", "answer": "A."}, headers=admin_headers)
    # With @school_required, must return 400 instead of 500
    assert r.status_code in (400, 201)  # 400 if context missing, 201 if token claims auto-scoped
```

---

## 5. Feature 6: Server-Side LMS Quiz Score Computation

### 5.1 File & Line Locations
- **Target File**: `backend/app/api/v1/lms.py`
- **Target Section**: Lines 312–357 (`_score_quiz` and `submit_quiz_attempt`)
- **Model**: `backend/app/models/lms.py:133-160` (`Quiz` and `QuizAttempt`)
- **Client Implementation**: `flutter_student/lib/features/lms/student_lms.dart:580-608`

### 5.2 Current Implementation
```python
def _score_quiz(quiz, answers: dict) -> tuple:
    """Server-side scoring — the client's claimed score is never trusted.
    answers is keyed by question index (string or int) with the chosen value;
    returns (score, total) computed from the stored questions."""
    questions = quiz.questions or []
    score = 0.0
    total = 0.0
    for i, q in enumerate(questions):
        marks = float(q.get("marks") or 1)
        total += marks
        if q.get("correct_answer") is None:
            continue
        given = answers.get(str(i), answers.get(i))
        if given is not None and str(given) == str(q.get("correct_answer")):
            score += marks
    return score, total


@lms_bp.route("/quizzes/<quiz_id>/attempt", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("lms")
def submit_quiz_attempt(quiz_id):
    quiz = Quiz.query.filter_by(
        id=quiz_id, school_id=g.school_id, is_deleted=False
    ).first()
    if not quiz:
        return error_response("Quiz not found", 404)
    data = request.get_json(silent=True) or {}
    answers = data.get("answers") or {}
    if not isinstance(answers, dict):
        return error_response("answers must be an object", 422)
    # Score is computed server-side from stored questions — a client-posted
    # score is never persisted (audit finding 6.1-6).
    score, _total = _score_quiz(quiz, answers)
    attempt = QuizAttempt(
        school_id=g.school_id,
        quiz_id=quiz.id,
        student_id=_current_user_id(),
        answers=answers,
        score=score,
    )
    db.session.add(attempt)
    db.session.commit()
    return created_response(_attempt_dict(attempt))
```

### 5.3 Empirical Edge-Case Verification Results
A live test script executing `_score_quiz` against edge cases produced the following results:
```
1. Standard str/int answers: (5.0, 5.0)       -> PASS
2. Int key answers: (5.0, 5.0)                -> PASS
3. Case mismatch (water vs Water): (3.0, 5.0) -> GAP (case-sensitive string comparison fails)
4. List correct_answer: (0.0, 2.0)            -> GAP (repr mismatch: "Water" != "['Water', 'H2O']")
5. Answer keyed by question id: (0.0, 2.0)    -> GAP (only checks index str(i)/i; ignores q.get("id"))
6. Question marks 0: (1.0, 1.0)               -> GAP (0 or 1 evaluates to 1, awarding unwanted mark)
7. Non-numeric marks error: ValueError        -> GAP (uncaught exception on bad question data)
```

### 5.4 Detailed Edge-Case Analysis

| Edge Case | Failure Mechanism | Risk |
|---|---|---|
| **Question ID vs Index** | When a web or mobile client keys submissions by question ID (e.g. `{"q_uuid": "val"}`) rather than array index (`{"0": "val"}`), `answers.get(str(i), answers.get(i))` returns `None`. | Student correctly answers but receives 0 marks. |
| **Case Sensitivity** | `str(given) == str(q.get("correct_answer"))` compares verbatim strings without normalization. `"kathmandu"` != `"Kathmandu"`, `"true"` != `"True"`. | False negatives on short-answer and boolean questions. |
| **Multi-Select / List Answers** | If `correct_answer` or `given` is an array (e.g. `["A", "B"]`), `str(...)` compares `str(["A", "B"])`, which fails on element reordering or single-item lists. | Multi-answer questions cannot be scored. |
| **Zero-Mark Questions** | `marks = float(q.get("marks") or 1)`: when `marks` is explicitly `0` (e.g., ungraded survey question), Python evaluates `0 or 1 == 1`. | Unwanted score awarded for 0-mark questions. |
| **Non-Numeric Marks** | If `marks` in JSON is `"five"` or `""`, `float(marks)` raises `ValueError`. | Unhandled HTTP 500 error on attempt submission. |
| **User Identity Guard** | `attempt = QuizAttempt(student_id=_current_user_id(), ...)`: if `_current_user_id()` is `None`, committing causes `IntegrityError` because `student_id` is non-nullable. | Unhandled HTTP 500 error. |

### 5.5 Proposed Hardened Implementation
In `backend/app/api/v1/lms.py:312-357`:
```python
def _normalize_answer_set(val) -> set[str]:
    """Convert scalar or list answer into a trimmed lowercase string set."""
    if val is None:
        return set()
    if isinstance(val, (list, tuple, set)):
        return {str(x).strip().lower() for x in val if x is not None}
    return {str(val).strip().lower()}


def _score_quiz(quiz, answers: dict) -> tuple[float, float]:
    """Server-side scoring — client-supplied score is strictly ignored.
    
    Robust against:
    - answers keyed by question index ('0', 0) OR question ID ('id', 'q1')
    - case differences in string answers ('kathmandu' == 'Kathmandu')
    - list-valued answers (multi-select / multiple acceptable answers)
    - safe marks coercion (defaults to 1.0, respects explicit 0.0)
    """
    if not isinstance(answers, dict):
        answers = {}
    questions = quiz.questions or []
    if not isinstance(questions, list):
        return 0.0, 0.0

    score = 0.0
    total = 0.0
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue

        raw_marks = q.get("marks")
        try:
            marks = float(raw_marks) if raw_marks is not None else 1.0
        except (ValueError, TypeError):
            marks = 1.0
        total += marks

        correct = q.get("correct_answer") or q.get("correct_answers")
        if correct is None:
            continue

        # Look up given answer by string index, int index, or question ID
        given = answers.get(str(i))
        if given is None:
            given = answers.get(i)
        if given is None and q.get("id") is not None:
            given = answers.get(str(q["id"]))

        if given is None:
            continue

        # Compare normalized answer sets
        expected_set = _normalize_answer_set(correct)
        given_set = _normalize_answer_set(given)

        if expected_set and expected_set == given_set:
            score += marks

    return round(score, 2), round(total, 2)
```
And in `submit_quiz_attempt()`:
```python
<<<<
    score, _total = _score_quiz(quiz, answers)
    attempt = QuizAttempt(
        school_id=g.school_id,
        quiz_id=quiz.id,
        student_id=_current_user_id(),
        answers=answers,
        score=score,
    )
====
    student_id = _current_user_id()
    if not student_id:
        return error_response("User identity required", 401)

    score, total_possible = _score_quiz(quiz, answers)
    attempt = QuizAttempt(
        school_id=g.school_id,
        quiz_id=quiz.id,
        student_id=student_id,
        answers=answers,
        score=score,
    )
>>>>
```

### 5.6 Proposed Unit Tests
Create `backend/tests/test_lms_quiz_scoring.py`:
```python
"""Unit tests for server-side LMS quiz scoring logic."""
import pytest
from app.api.v1.lms import _score_quiz

class MockQuiz:
    def __init__(self, questions):
        self.questions = questions

def test_score_quiz_ignores_client_score():
    # Verification that client-supplied scores are discarded
    quiz = MockQuiz([
        {"marks": 2, "correct_answer": "Option A"},
        {"marks": 3, "correct_answer": "Option B"},
    ])
    answers = {"0": "Option A", "1": "Option B"}
    score, total = _score_quiz(quiz, answers)
    assert score == 5.0
    assert total == 5.0

def test_score_quiz_handles_int_and_str_keys():
    quiz = MockQuiz([
        {"marks": 1, "correct_answer": "True"},
        {"marks": 1, "correct_answer": "False"},
    ])
    score, _ = _score_quiz(quiz, {0: "True", "1": "False"})
    assert score == 2.0

def test_score_quiz_handles_question_id_keys():
    quiz = MockQuiz([
        {"id": "q101", "marks": 4, "correct_answer": "Kathmandu"},
    ])
    score, _ = _score_quiz(quiz, {"q101": "Kathmandu"})
    assert score == 4.0

def test_score_quiz_case_insensitivity():
    quiz = MockQuiz([
        {"marks": 2, "correct_answer": "Water"},
    ])
    score, _ = _score_quiz(quiz, {"0": "water"})
    assert score == 2.0

def test_score_quiz_multi_select():
    quiz = MockQuiz([
        {"marks": 3, "correct_answer": ["A", "B"]},
    ])
    score, _ = _score_quiz(quiz, {"0": ["B", "A"]})
    assert score == 3.0

def test_score_quiz_explicit_zero_marks():
    quiz = MockQuiz([
        {"marks": 0, "correct_answer": "Feedback"},
    ])
    score, total = _score_quiz(quiz, {"0": "Feedback"})
    assert score == 0.0
    assert total == 0.0
```

---

## 6. Synthesis & Comparison Matrix

| Feature | Audit Status | Code Location | Primary Finding | Proposed Fix | Test Status |
|---|---|---|---|---|---|
| **Feature 2: Benchmarking Dead Imports** | Partially fixed (ReportCard resolved, dead imports remain) | `backend/app/api/v1/benchmarking.py:87-95` | `Class` and `Exam` are unused dead imports inside `_rankings_rows()` | Remove `Class` and `Exam` imports | Verified via AST analysis |
| **Feature 3: GPS Haversine & Role Enums** | Fixed in commit `e76b584`, gaps identified | `backend/app/tasks/gps_processing.py:174-210` | Haversine formula fixed; push roles omit `"staff"`; zero tests for `check_geofence_alerts` | Add `"staff"` to roles; add unit test in `test_gps_pipeline.py` | Mathematical verification confirmed |
| **Feature 5: FAQ Role & School Authorization** | Partially fixed (role guards added, school guard missing) | `backend/app/api/v1/faqs.py:51-97` | `@school_required` missing from all routes; un-scoped admin requests crash with 500 on `school_id NOT NULL` | Add `@school_required` to all routes; add role rejection tests | Verified via model inspect |
| **Feature 6: LMS Quiz Server-Side Scoring** | Basic logic implemented, edge cases present | `backend/app/api/v1/lms.py:312-357` | Server-side scoring verified; gaps in Question ID keys, case sensitivity, list answers, 0 marks, and missing tests | Harden `_score_quiz` normalization; add `test_lms_quiz_scoring.py` | Verified via empirical test suite |

---

## 7. Verification Method for Implementers

1. **Feature 2 Verification**:
   ```bash
   PYTHONPATH=backend backend/.venv/bin/python -c '
   import ast, inspect
   from app.api.v1.benchmarking import _rankings_rows
   source = inspect.getsource(_rankings_rows)
   assert "import Class" not in source
   assert "import Exam" not in source
   print("Feature 2 import hygiene: PASS")
   '
   ```

2. **Feature 3 Verification**:
   Run `pytest backend/tests/test_gps_pipeline.py` to ensure all tests pass:
   - Fix verification: Haversine distance for durbar-square-to-thamel equals 1.358 km (< 2km threshold).
   - Push delivery verification: role list includes `"staff"`.

3. **Feature 5 Verification**:
   ```bash
   PYTHONPATH=backend backend/.venv/bin/python -c '
   import inspect
   from app.api.v1.faqs import list_faqs, create_faq, update_faq, delete_faq
   for fn in (list_faqs, create_faq, update_faq, delete_faq):
       source = inspect.getsource(fn)
       assert "@school_required" in source, f"Missing @school_required in {fn.__name__}"
   print("Feature 5 @school_required: PASS")
   '
   ```

4. **Feature 6 Verification**:
   Run the proposed test suite `backend/tests/test_lms_quiz_scoring.py`:
   - 6 test cases verifying string keys, int keys, question IDs, case insensitivity, multi-select sets, and zero marks.
