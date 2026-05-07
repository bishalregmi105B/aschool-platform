from app.models.academic import Class
from app.models.plugin import Plugin, SchoolPlugin
from app.models.student import Student
from tests.conftest import get_auth_headers


def _enable_design_studio(db, school):
    db.session.add(
        Plugin(
            slug="design_studio",
            name="Design Studio",
            category="growth",
            is_free=True,
            is_published=True,
        )
    )
    db.session.add(
        SchoolPlugin(
            school_id=school.id,
            plugin_slug="design_studio",
            active=True,
        )
    )


def test_design_studio_render_id_card_template(client, db, school, admin_user):
    _enable_design_studio(db, school)
    db.session.commit()

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    response = client.post(
        "/api/v1/design-studio/render",
        json={
            "template_id": "id_card_standard",
            "data": {
                "name": "Sample Student",
                "class": "Grade 10",
                "section": "A",
                "roll_no": "7",
            },
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["template_id"] == "id_card_standard"
    assert payload["template_width"]
    assert payload["template_height"]
    assert "Sample Student" in payload["html"]


def test_design_studio_bulk_id_cards_generates_rendered_cards(
    client,
    db,
    school,
    admin_user,
):
    _enable_design_studio(db, school)

    klass = Class(school_id=school.id, name="Grade 10", sort_order=10)
    db.session.add(klass)
    db.session.flush()

    student = Student(
        school_id=school.id,
        first_name="Sita",
        last_name="Sharma",
        class_id=klass.id,
        status="active",
        roll_number=12,
        admission_number="ADM-10-12",
        dob_bs="2067-02-10",
        photo_url="https://example.com/student.jpg",
    )
    db.session.add(student)
    db.session.commit()

    headers = get_auth_headers(client, admin_user.email, "Test@1234")
    response = client.post(
        "/api/v1/design-studio/bulk/id-cards",
        json={
            "class_id": str(klass.id),
            "template_id": "id_card_standard",
        },
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["count"] == 1

    card = payload["cards"][0]
    assert card["student_name"] == "Sita Sharma"
    assert card["template_id"] == "id_card_standard"
    assert card["template_width"]
    assert card["template_height"]
    assert isinstance(card["canvas_json"], dict)
    assert card["canvas_json"].get("objects")
    assert "Sita Sharma" in card["html"]
