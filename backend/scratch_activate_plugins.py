import sys
import os

# Setup path so we can import app modules
sys.path.insert(0, os.path.abspath('/home/bishal-regmi/Desktop/ASchool/backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Assume standard postgres URL from docker-compose
DATABASE_URL = "postgresql://aschool:aschool_password@localhost:5433/aschool_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    from app.models.plugin import InstalledPlugin
    plugins = db.query(InstalledPlugin).all()
    for p in plugins:
        p.active = True
    db.commit()
    print(f"Activated {len(plugins)} existing plugin installations.")
except Exception as e:
    print(e)
