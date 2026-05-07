from app import create_app
from app.models.user import User
from extensions import db

app = create_app()
with app.app_context():
    admin = User.query.filter_by(email="admin@demo.aschool.com.np").first()
    if admin:
        admin.set_password("changeme123")
        db.session.commit()
        print(f"Password reset to 'changeme123' for {admin.email}")
    else:
        print("Admin user not found in DB.")
