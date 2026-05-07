from app.models.school import School

def generate_default_password(user, student=None, school=None):
    """
    Generate a dynamic default password based on School EMIS ID (regd_number) and user details.
    - Students: {EMIS_ID}@{StudentID}
    - Others: {EMIS_ID}@{Last4Phone}
    """
    if not school and user.school_id:
        school = School.query.get(user.school_id)

    emis_id = school.regd_number if school and school.regd_number else school.slug if school else "ASchool"

    if user.role == "student" and student and student.student_id:
        return f"{emis_id}@{student.student_id}"
    
    # Fallback for students without student_id, or other roles
    suffix = "1234"
    if user.phone and len(user.phone) >= 4:
        suffix = user.phone[-4:]
    elif user.phone:
        suffix = user.phone
    else:
        suffix = user.role

    return f"{emis_id}@{suffix}"
