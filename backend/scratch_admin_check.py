from app import create_app
from app.models.user import User
from app.models.school import School

app = create_app()
with app.app_context():
    admin = User.query.filter_by(email="admin@demo.aschool.com.np").first()
    if admin:
        print(f"User found: {admin.email}, Role: {admin.role}, Active: {admin.is_active}")
        print(f"Password Check 'changeme123': {admin.check_password('changeme123')}")
        print(f"Password Hash: {admin.password_hash}")
    else:
        print("Admin user not found in DB.")
        users = User.query.filter_by(role="school_admin").all()
        print("Other admins:", [u.email for u in users])
