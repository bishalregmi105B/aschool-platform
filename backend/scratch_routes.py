import sys
import os

# Add backend dir to python path
sys.path.append('/home/bishal-regmi/Desktop/ASchool/backend')

from app import create_app

app = create_app()

with app.app_context():
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule.rule}")
