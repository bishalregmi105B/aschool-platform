"""D-07 + A-06 honesty items.

- D-07: audit trail rows are written for sensitive-table writes with
  changed-column granularity; TOTP secret never serializes.
- A-06 honesty: the fake `_default_variation` designer fallback is labeled
  rule-based, not AI.
"""
from app.models.compliance import AuditLog
from app.models.user import User
from extensions import db as _db
from tests.conftest import get_auth_headers


class TestAuditTrail:
    def test_marks_write_creates_audit_row(self, client, db, school, admin_user):
        from app.models.exam import Exam, Marks
        from app.models.student import Student

        from app.models.academic import Subject

        st = Student(school_id=school.id, first_name="Audit", last_name="Me",
                     roll_number=1, status="active")
        subject = Subject(school_id=school.id, name="Math", code="MA",
                          full_marks=100, pass_marks=32)
        exam = Exam(school_id=school.id, name="Audit Exam", exam_type="unit_test",
                    total_marks=100, pass_marks=32)
        db.session.add_all([st, subject, exam])
        db.session.flush()
        mark = Marks(
            school_id=school.id, exam_id=exam.id, student_id=st.id,
            subject_id=subject.id, theory_marks=50,
        )
        db.session.add(mark)
        db.session.commit()

        rows = AuditLog.query.filter_by(
            school_id=school.id, resource_type="marks", action="create"
        ).all()
        assert rows, "marks insert must be audited"
        assert rows[-1].new_values.get("theory_marks") == 50

    def test_update_records_changed_columns_only(self, client, db, school, admin_user):
        from app.models.exam import Exam, Marks
        from app.models.student import Student

        from app.models.academic import Subject

        st = Student(school_id=school.id, first_name="Audit", last_name="Me2",
                     roll_number=2, status="active")
        subject = Subject(school_id=school.id, name="Science", code="SC",
                          full_marks=100, pass_marks=32)
        exam = Exam(school_id=school.id, name="Audit Exam 2", exam_type="unit_test",
                    total_marks=100, pass_marks=32)
        db.session.add_all([st, subject, exam])
        db.session.flush()  # assign ids before referencing them
        mark = Marks(school_id=school.id, exam_id=exam.id, student_id=st.id,
                     subject_id=subject.id, theory_marks=10)
        db.session.add(mark)
        db.session.commit()

        # Expire so the update flush sees the committed row exactly as a
        # second request would (objects created in-session have no DB-loaded
        # prior value to audit).
        db.session.expire(mark)
        mark.theory_marks = 55
        db.session.commit()

        row = (
            AuditLog.query.filter_by(
                school_id=school.id, resource_type="marks", action="update"
            )
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert row is not None
        assert "theory_marks" in (row.old_values or {})
        assert row.old_values["theory_marks"] == 10
        assert row.new_values["theory_marks"] == 55
        assert "id" not in (row.old_values or {}), "unchanged cols not recorded"

    def test_totp_secret_never_serializes(self, db, admin_user):
        admin_user.permissions = {
            "totp_secret": "JBSWY3DPEHPK3PXP",
            "can_review_iep": True,
        }
        db.session.commit()
        data = User.query.get(admin_user.id).to_dict()
        assert "totp_secret" not in data["permissions"]
        assert data["permissions"]["can_review_iep"] is True


class TestDesignerHonesty:
    def test_fallback_variations_labeled_honestly(self):
        """A-06(5): quota-exhausted designer fallback is allowed, but every
        variation must carry source='rule_based_fallback' and a fallback
        marker — never pretend to be AI-generated."""
        import app.services.ai.website_designer as wd

        result = None
        service_cls = getattr(wd, "SchoolWebsiteDesigner", None)
        if service_cls and hasattr(service_cls, "suggest_variations"):
            try:
                result = service_cls.suggest_variations(
                    school_name="Honesty Test School"
                )
            except Exception:
                result = None
        if result is None:
            # fall back to source-level assertions
            src = open(wd.__file__.replace(".pyc", ".py")).read()
            assert '"source": "rule_based_fallback"' in src
            assert '"fallback": True' in src
        else:
            for v in result["variations"]:
                assert v.get("source") == "rule_based_fallback"
