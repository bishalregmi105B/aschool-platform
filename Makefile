.PHONY: dev backend frontend migrate seed test clean

# ── Development ──────────────────────────────────────────
dev:
	docker-compose up

dev-build:
	docker-compose up --build

down:
	docker-compose down

# ── Backend ──────────────────────────────────────────────
backend:
	cd backend && flask run --reload --port 5000

shell:
	cd backend && flask shell

# ── Database ─────────────────────────────────────────────
migrate:
	cd backend && flask db migrate -m "$(msg)"

upgrade:
	cd backend && flask db upgrade

downgrade:
	cd backend && flask db downgrade

seed:
	cd backend && flask seed-plugins

# ── Celery ───────────────────────────────────────────────
worker:
	cd backend && celery -A app.celery_app worker -l info -Q default,ai,notifications,gps

beat:
	cd backend && celery -A app.celery_app beat -l info

# ── Frontend ─────────────────────────────────────────────
frontend:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

# ── Test ─────────────────────────────────────────────────
test:
	cd backend && python -m pytest tests/ -v

test-cov:
	cd backend && python -m pytest tests/ --cov=app --cov-report=html

test-frontend:
	cd frontend && npm test

test-flutter:
	cd flutter_shared && flutter test

test-all: test test-frontend test-flutter

# ── Clean ────────────────────────────────────────────────
clean:
	docker-compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
