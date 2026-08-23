import traceback

import pytest

from app.models.revoked_token import RevokedToken


def test_revoked_query(client, db, school):
    try:
        rows = RevokedToken.query.all()
        print("REVOKED OK:", len(rows))
    except Exception:
        traceback.print_exc()
