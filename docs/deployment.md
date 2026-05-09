
# ASchool Deployment Guide

## Prerequisites

- Ubuntu 22.04+ server (2 vCPU, 4GB RAM minimum)
- Domain: `aschool.com.np` with wildcard DNS (`*.aschool.com.np`)
- Docker & Docker Compose installed
- SSL certificate (Let's Encrypt recommended)

## Production Deployment

### 1. Server Setup

```bash
# Clone repository
git clone https://github.com/your-org/aschool.git /opt/aschool
cd /opt/aschool

# Configure environment
cp .env.example .env
# Edit .env with production values:
#   FLASK_ENV=production
#   DEBUG=False
#   SECRET_KEY=<random-64-char-string>
#   JWT_SECRET_KEY=<random-64-char-string>
#   DATABASE_URL=postgresql://aschool:<password>@db:5432/aschool
```

### 2. Build & Start

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend flask db upgrade

# Seed plugins
docker-compose -f docker-compose.prod.yml exec backend python seed_full.py
```

### 3. SSL with Let's Encrypt

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get wildcard certificate
certbot certonly --manual --preferred-challenges dns \
  -d aschool.com.np -d '*.aschool.com.np'
```

### 4. Nginx Configuration

The `nginx/nginx.conf` handles:
- `api.aschool.com.np` → Flask backend (:5000)
- `app.aschool.com.np` → Next.js frontend (:3000)
- `{slug}.aschool.com.np` → School websites (SSR via Next.js)

### 5. CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on push to `main`:
1. Backend tests (pytest)
2. Frontend tests (Jest) & build
3. Docker image build & push
4. SSH deploy to production server

## Services Architecture

| Service | Port | Description |
|---------|------|-------------|
| Flask API | 5000 | Backend REST API + Socket.IO |
| Next.js | 3000 | Web dashboard + SSR websites |
| PostgreSQL | 5432 | Primary database (pgvector) |
| Redis | 6379 | Cache, sessions, Celery broker |
| Celery Worker | — | Background tasks (AI, SMS, email) |
| Celery Beat | — | Scheduled tasks (reports, sync) |
| Nginx | 80/443 | Reverse proxy, SSL, subdomain routing |

## Monitoring

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f celery-worker

# Health check
curl https://api.aschool.com.np/health

# Celery flower (task monitor)
# Accessible at :5555 (configure in docker-compose.prod.yml)
```

## Backup

```bash
# Database backup
docker-compose -f docker-compose.prod.yml exec db \
  pg_dump -U aschool aschool > backup_$(date +%Y%m%d).sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T db \
  psql -U aschool aschool < backup_20240115.sql
```

## Environment Variables Reference

See [.env.example](../.env.example) for the complete list. Critical production values:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Flask secret (64+ random chars) |
| `JWT_SECRET_KEY` | JWT signing key |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude AI API key |
| `SPARROW_SMS_TOKEN` | Sparrow SMS gateway token |
| `R2_*` | Cloudflare R2 file storage |
| `FIREBASE_DATABASE_URL` | GPS tracking Firebase RTDB |
