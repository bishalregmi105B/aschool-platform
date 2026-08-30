# Phase-2 runtime smoke — all GET /api/v1 endpoints (2026-08-28)

Method: Flask test client in `aschool-flask-1`, login as demo admin (JWT from `data.access_token` + cookie),
GET every /api/v1 rule (≤4 per blueprint, uuid args substituted with `1`, `?page=1&per_page=5` appended).

Fix applied during smoke: `app/api/v1/notifications.py:47` called `paginate(query, default_per_page=50)`
→ TypeError 500 on the core notifications list. Fixed by adding `default_per_page` kwarg to
`app/utils/pagination.py:5` (backward-compatible, default 20).

Final distribution (180 probed): 200×72, 403×70 (plugin gating — demo school lacks paid plugins), 404×34, 400×4, 500×0.

404/400 triage — all benign:
- uuid-arg artifacts (`/students/<uuid>` with `1`), QR-param artifact (`/inventory/assets/scan/<qr>`)
- role-hiding: `/student/*` aborts 404 for non-student roles (by design)
- `/ai-usage/quota` 404 = no quota row for schools registered before quota provisioning (E12 fix); `POST /quota/init` exists
- 400×4 = required date-range params absent in probe (reports ×3, website public-domain)

Conclusion: no unmounted blueprints, no 500s, gating responds 403 correctly. Deep per-plugin checks continue in category batches.
