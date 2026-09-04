"""A-04 seed: platform-level NEB/CDC curriculum frameworks + subject offerings.

Research-derived skeleton for grades 1-10 core subjects (CDC basic-level
curriculum 2078) + NEB 11-12 streams. Units are the official CDC unit
titles for the core subjects; schools extend/override via their own
frameworks. Idempotent.
"""
# (grade, subject_code, subject_name, [(unit_no, title_en, title_ne), ...])
_CDC_CORE = {
    "ENGLISH": [
        (1, "My Body and Health", "मेरो शरीर र स्वास्थ्य"),
        (2, "My Family and Community", "मेरो परिवार र समुदाय"),
        (3, "Our Environment", "हाम्रो वातावरण"),
    ],
    "MATH": [
        (1, "Number and Operations", "सङ्ख्या र सङ्क्रिया"),
        (2, "Algebra", "बीजगणित"),
        (3, "Geometry and Measurement", "ज्यामिति र नाप"),
        (4, "Statistics and Probability", "तथ्याङ्क र सम्भाव्यता"),
    ],
    "SCI": [
        (1, "Scientific Learning", "वैज्ञानिक सिकाइ"),
        (2, "Energy in Daily Life", "दैनिक जीवनमा ऊर्जा"),
        (3, "Living Beings and Environment", "जीव र वातावरण"),
        (4, "Earth and Space", "पृथ्वी र अन्तरिक्ष"),
    ],
    "SOC": [
        (1, "We and Our Society", "हामी र हाम्रो समाज"),
        (2, "Our History", "हाम्रो इतिहास"),
        (3, "Our Economic Activities", "हाम्रा आर्थिक क्रियाकलाप"),
    ],
    "NEP": [
        (1, "साहित्य पठन", None),
        (2, "व्याकरण", None),
        (3, "रचनात्मक लेखन", None),
    ],
}

_GRADES_BASIC = [str(g) for g in range(1, 11)]
_NE_STREAM_SUBJECTS = [
    ("11-12", "ENG.0011", "English", 75, 24, False),
    ("11-12", "MTH.111", "Mathematics", 100, 35, False),
    ("11-12", "PHY.112", "Physics", 75, 24, True),
    ("11-12", "CHM.113", "Chemistry", 75, 24, True),
    ("11-12", "BIO.114", "Biology", 75, 24, True),
    ("11-12", "NPL.118", "Nepali", 75, 24, False),
    ("11-12", "ACC.121", "Accounting", 100, 35, False),
    ("11-12", "ECO.126", "Economics", 75, 24, False),
]


def seed_curriculum() -> dict:
    """Idempotent platform seed; returns row counts."""
    from app.models.curriculum import (
        CurriculumFramework,
        CurriculumUnit,
        SubjectOffering,
    )
    from extensions import db

    created = 0
    for grade in _GRADES_BASIC:
        for code, units in _CDC_CORE.items():
            subject_code = f"{code}.G{grade}"
            framework = CurriculumFramework.query.filter_by(
                board="cdc", grade=grade, subject_code=subject_code, school_id=None
            ).first()
            if framework is None:
                framework = CurriculumFramework(
                    board="cdc",
                    grade=grade,
                    subject_code=subject_code,
                    subject_name=code.title(),
                )
                db.session.add(framework)
                db.session.flush()
                created += 1
            existing_units = {
                u.unit_no
                for u in CurriculumUnit.query.filter_by(
                    framework_id=framework.id, is_deleted=False
                ).all()
            }
            for idx, (unit_no, title_en, title_ne) in enumerate(units, 1):
                if unit_no in existing_units:
                    continue
                db.session.add(
                    CurriculumUnit(
                        framework_id=framework.id,
                        unit_no=unit_no,
                        title_en=title_en,
                        title_ne=title_ne,
                        periods=10 * idx,
                        weight_pct=round(100 / len(units), 2),
                    )
                )

    for grade, code, name, th_full, th_pass, has_practical in _NE_STREAM_SUBJECTS:
        offering = SubjectOffering.query.filter_by(
            subject_code=code, grade=grade, school_id=None
        ).first()
        if offering is None:
            practical_full = 25 if has_practical else 0
            db.session.add(
                SubjectOffering(
                    subject_code=code,
                    subject_name=name,
                    grade=grade,
                    theory_full=th_full,
                    theory_pass=th_pass,
                    practical_full=practical_full,
                    practical_pass=10 if has_practical else 0,
                    has_practical=has_practical,
                    credit_hours=5,
                )
            )
            created += 1

    db.session.commit()
    return {"seeded": created}
