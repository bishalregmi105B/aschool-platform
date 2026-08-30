import json as _json
from tests.conftest import get_auth_headers as _orig

def traced(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    print(f"LOGIN[{email}]: {resp.status_code} {str(resp.get_json())[:150]}", flush=True)
    return _orig(client, email, password)

import tests.conftest as c
c.get_auth_headers = traced
import tests.test_slice2_api_validation as m
m.get_auth_headers = traced
