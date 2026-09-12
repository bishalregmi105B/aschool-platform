"""S-A5 regression tests: admission funnel (A-09), guest payments (A-22),
custom fields (A-35), exit documents (A-36)."""
import pytest

from app.models.admission import AdmissionRegistration, EnrollmentSeatCap
from app.models.custom_field import CustomFieldDef
from app.models.exit_document import StudentExitDocument
from app.models.fee import FeeCollection
from app.models.student import Student
from app.models.user import User
from tests.conftest import get_auth_headers


@pytest.fixture
def env(client, db, school, admin_user):
    for slug in ("admission", "fees", "settings_core"):
        from app.models.plugin import Plugin, SchoolPlugin

        db.session.add(Plugin(slug=slug, name=slug.title(), category="core",
                              is_free=True, is_published=True))
        db.session.add(SchoolPlugin(school_id=school.id, plugin_slug=slug, active=True))
    db.session.commit()
    return {
        "headers": get_auth_headers(client, "admin@test.edu.np", "Test@1234"),
        "client": client, "db": db, "school": school,
    }


def test_public_registration_and_conversion(env, db, app):
    client, headers, school = env["client"], env["headers"], env["school"]
    from app.models.academic import Class

    klass = Class(school_id=school.id, name="Class 1")
    db.session.add(klass)
    db.session.flush()
    db.session.add(EnrollmentSeatCap(school_id=school.id, class_id=klass.id, max_seat=1))
    db.session.commit()

    # cookie-free client: the login cookies trip the cookie-auth CSRF guard
    # on these unauthenticated public endpoints
    public = app.test_client()
    body = {"student_first_name": "Anita", "student_last_name": "Shrestha",
            "guardian_name": "Mother Shrestha", "guardian_phone": "9841000111",
            "applied_class_id": str(klass.id), "source": "public"}
    submit = public.post(
        f"/api/v1/website/public/{school.slug}/admission/registration", json=body
    )
    assert submit.status_code == 201, submit.get_json()
    reg_data = submit.get_json()["data"]
    assert reg_data["registration_number"].startswith("REG-")

    # duplicate inside 24h → 409
    dup = public.post(
        f"/api/v1/website/public/{school.slug}/admission/registration", json=body
    )
    assert dup.status_code == 409

    # status with the token
    status = public.get(
        f"/api/v1/website/public/{school.slug}/admission/registration/"
        f"{reg_data['id']}?token={reg_data['verification_token']}"
    )
    assert status.status_code == 200
    assert status.get_json()["data"]["status"] == "submitted"
    # wrong token → 404
    bad = public.get(
        f"/api/v1/website/public/{school.slug}/admission/registration/"
        f"{reg_data['id']}?token=nope"
    )
    assert bad.status_code == 404

    # admin converts → student + guardian provisioned
    convert = client.post(
        f"/api/v1/admission/registrations/{reg_data['id']}/convert",
        json={}, headers=headers,
    )
    assert convert.status_code == 200, convert.get_json()
    data = convert.get_json()["data"]
    student = Student.query.get(data["student_id"])
    assert student.first_name == "Anita"
    assert student.dynamic_fields == {}
    guardian_user = User.query.get(data["guardian_user_id"])
    assert guardian_user.role == "parent"
    assert guardian_user.must_change_password is True
    reg = AdmissionRegistration.query.get(reg_data["id"])
    assert reg.status == "converted" and reg.student_id == student.id

    # seat cap: cap=1 consumed → second registration of another student → 409
    body2 = {"student_first_name": "Bimal", "guardian_name": "Father B",
             "guardian_phone": "9841000222", "applied_class_id": str(klass.id)}
    public.post(f"/api/v1/website/public/{school.slug}/admission/registration", json=body2)
    reg2 = AdmissionRegistration.query.filter_by(student_first_name="Bimal").first()
    client.post(f"/api/v1/admission/registrations/{reg2.id}/review",
                json={"decision": "approved"}, headers=headers)
    blocked = client.post(
        f"/api/v1/admission/registrations/{reg2.id}/convert", json={}, headers=headers
    )
    assert blocked.status_code == 409, blocked.get_json()
    assert blocked.get_json()["error"]["max_seat"] == 1


def test_custom_fields_validation_and_exit_docs(env, db):
    client, headers, db, school = env["client"], env["headers"], env["db"], env["school"]
    from app.models.academic import Class

    klass = Class(school_id=school.id, name="Class 2")
    db.session.add(klass)
    db.session.commit()

    # field defs
    create = client.post("/api/v1/custom-fields/defs", json={
        "form_name": "student_registration", "label": "Previous GPA",
        "field_type": "number", "required": True, "rank": 1}, headers=headers)
    assert create.status_code == 201, create.get_json()
    def_id = create.get_json()["data"]["id"]
    create2 = client.post("/api/v1/custom-fields/defs", json={
        "form_name": "student_registration", "label": "House",
        "field_type": "select", "choices": ["Red", "Blue"]}, headers=headers)
    house_id = create2.get_json()["data"]["id"]

    # public defs readable
    pub = client.get(f"/api/v1/custom-fields/defs/public/{school.slug}/student_registration")
    assert pub.status_code == 200 and len(pub.get_json()["data"]["fields"]) == 2

    # student create with dynamic fields (valid)
    from app.models.student import Student as S

    student = S(school_id=school.id, first_name="Kiran", last_name="Rai",
                class_id=klass.id, status="active",
                dynamic_fields={def_id: 3.5, house_id: "Red"})
    db.session.add(student)
    db.session.commit()
    assert student.dynamic_fields[def_id] == 3.5

    # exit doc: blocked by dues
    db.session.add(FeeCollection(school_id=school.id, student_id=student.id,
                                 amount=700, payment_status="pending"))
    db.session.commit()
    blocked = client.post(
        f"/api/v1/students/{student.id}/exit-documents",
        json={"doc_type": "transfer_certificate"}, headers=headers)
    assert blocked.status_code == 409
    assert blocked.get_json()["error"]["dues_total"] == 700

    # clear the dues → issues and flips status
    bill = FeeCollection.query.filter_by(student_id=student.id).first()
    bill.payment_status = "paid"
    db.session.commit()
    issued = client.post(
        f"/api/v1/students/{student.id}/exit-documents",
        json={"doc_type": "transfer_certificate", "issued_on_bs": "2083-04-15",
              "reason": "Family relocation"},
        headers=headers)
    assert issued.status_code == 201, issued.get_json()
    doc = issued.get_json()["data"]
    assert doc["document_number"].startswith("TR-")
    db.session.expire_all()
    assert Student.query.get(student.id).status == "transferred_out"

    # public verify
    verify = client.get(f"/api/v1/students/exit-documents/verify?number={doc['document_number']}")
    assert verify.status_code == 200
    assert verify.get_json()["data"]["student_name"] == "Kiran Rai"
    assert verify.get_json()["data"]["revoked"] is False

    # revoke
    revoked = client.post(
        f"/api/v1/students/exit-documents/{doc['id']}/revoke", headers=headers)
    assert revoked.status_code == 200
    verify2 = client.get(
        f"/api/v1/students/exit-documents/verify?number={doc['document_number']}")
    assert verify2.get_json()["data"]["revoked"] is True
