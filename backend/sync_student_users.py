from app import create_app
from app.models.student import Student
from app.models.user import User
from app.models.school import School
from app.utils.password import generate_default_password
from extensions import db

def sync_student_users():
    print("Syncing missing User accounts for Students...")
    students = Student.query.filter_by(is_deleted=False).all()
    count = 0

    for student in students:
        if not student.user_id:
            # Create user account for student
            user = User(
                school_id=student.school_id,
                role="student",
                full_name=f"{student.first_name} {student.last_name}".strip(),
                phone=student.phone if hasattr(student, "phone") else ""
            )
            school = School.query.get(student.school_id) if student.school_id else None
            
            # Generate and set the new default password
            new_password = generate_default_password(user, student, school)
            user.set_password(new_password)
            
            db.session.add(user)
            db.session.flush()
            
            student.user_id = user.id
            count += 1
            
            if count % 50 == 0:
                db.session.commit()
                print(f"Synced {count} students...")

    db.session.commit()
    print(f"Successfully created User accounts for {count} students.")

if __name__ == "__main__":
    app = create_app("development")
    with app.app_context():
        sync_student_users()
