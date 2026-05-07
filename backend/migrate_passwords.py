from app import create_app
from app.models.user import User
from app.models.student import Student
from app.models.school import School
from app.utils.password import generate_default_password
from extensions import db

def migrate_passwords():
    print("Starting password migration for all users...")
    users = User.query.filter_by(is_deleted=False).all()
    count = 0

    for user in users:
        student = None
        school = School.query.get(user.school_id) if user.school_id else None
        
        if user.role == "student":
            # Attempt to find the associated student record
            student = Student.query.filter_by(user_id=user.id).first()
            if not student:
                # If the user_id is not linked, try linking by full_name or phone
                student = Student.query.filter(
                    Student.school_id == user.school_id,
                    Student.first_name + " " + Student.last_name == user.full_name
                ).first()
                if student and not student.user_id:
                    student.user_id = user.id
        
        # Generate and set the new default password
        new_password = generate_default_password(user, student, school)
        user.set_password(new_password)
        count += 1
        
        if count % 50 == 0:
            db.session.commit()
            print(f"Migrated {count} users...")

    db.session.commit()
    print(f"Successfully migrated {count} users' passwords to the new EMIS-based standard.")

if __name__ == "__main__":
    app = create_app("development")
    with app.app_context():
        migrate_passwords()
