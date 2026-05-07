# ASchool Production Deployment Guide on brighternepal.com

This guide migrates production from old BrighterNepal services to ASchool and serves ASchool on brighternepal.com.

Status target after completion:
- Web app (main): https://brighternepal.com
- API: https://api.brighternepal.com
- School public sites: https://<school-slug>.brighternepal.com
- Optional Flower: https://flower.brighternepal.com (or internal only)

---

## 1. Repository Plan (Create all needed repos)

Use one required deployment repo plus optional split repos for mobile and hardware.

Required:
1. aschool-platform (backend + frontend + docker + nginx + docs)

Recommended optional repos:
1. aschool-flutter-admin
2. aschool-flutter-teacher
3. aschool-flutter-parent
4. aschool-flutter-student
5. aschool-flutter-shared
6. aschool-hardware-gps

### 1.1 Install and login GitHub CLI

    sudo apt update && sudo apt install -y gh
    gh auth login

### 1.2 Repositories created and clone URLs

All required repos are now created under GitHub user: bishalregmi105B.

1. aschool-platform
HTTPS: https://github.com/bishalregmi105B/aschool-platform
SSH: git@github.com:bishalregmi105B/aschool-platform.git

2. aschool-flutter-admin
HTTPS: https://github.com/bishalregmi105B/aschool-flutter-admin
SSH: git@github.com:bishalregmi105B/aschool-flutter-admin.git

3. aschool-flutter-teacher
HTTPS: https://github.com/bishalregmi105B/aschool-flutter-teacher
SSH: git@github.com:bishalregmi105B/aschool-flutter-teacher.git

4. aschool-flutter-parent
HTTPS: https://github.com/bishalregmi105B/aschool-flutter-parent
SSH: git@github.com:bishalregmi105B/aschool-flutter-parent.git

5. aschool-flutter-student
HTTPS: https://github.com/bishalregmi105B/aschool-flutter-student
SSH: git@github.com:bishalregmi105B/aschool-flutter-student.git

6. aschool-flutter-shared
HTTPS: https://github.com/bishalregmi105B/aschool-flutter-shared
SSH: git@github.com:bishalregmi105B/aschool-flutter-shared.git

7. aschool-hardware-gps
HTTPS: https://github.com/bishalregmi105B/aschool-hardware-gps
SSH: git@github.com:bishalregmi105B/aschool-hardware-gps.git

### 1.3 Push local code to each repo

Run from your machine.

Platform repo (required for server deploy):

    cd /home/bishal-regmi/Desktop/ASchool
    git init
    git add .
    git commit -m "Initial ASchool platform import"
    git branch -M main
    git remote add origin git@github.com:bishalregmi105B/aschool-platform.git
    git push -u origin main

If you split mobile/hardware into separate repos later, move each folder to its own repository and push similarly.

---

## 2. Domain and Cloudflare Setup for brighternepal.com

In Cloudflare DNS for brighternepal.com, add:

1. A record @ -> YOUR_SERVER_IP (Proxied)
2. A record api -> YOUR_SERVER_IP (Proxied)
3. A record flower -> YOUR_SERVER_IP (Proxied, optional)
4. A record * -> YOUR_SERVER_IP (Proxied) for school subdomains
5. CNAME www -> brighternepal.com (Proxied)

Important for shutdown of the old alternate web endpoint:
1. If app.brighternepal.com already exists in DNS, you may keep it temporarily.
2. Nginx should redirect app.brighternepal.com -> https://brighternepal.com (configured below).
3. After stable cutover, remove the explicit app DNS record if you do not need it.

Cloudflare SSL/TLS:
1. Mode: Full (strict)
2. Origin Certificate hostnames:
   - brighternepal.com
   - *.brighternepal.com
3. WebSockets: ON

Copy cert files to server:

    mkdir -p /etc/ssl/cloudflare
    # Upload from local machine:
    # brighternepal.com.pem and brighternepal.com.key
    chmod 600 /etc/ssl/cloudflare/brighternepal.com.key
    chmod 644 /etc/ssl/cloudflare/brighternepal.com.pem

---

## 3. Prepare ASchool for brighternepal.com

The nginx config in this repo is already prepared for brighternepal.com.

If your local copy is older, update domain references before deployment:

On your local machine:

    cd /home/bishal-regmi/Desktop/ASchool
    sed -i 's/aschool\.com\.np/brighternepal.com/g' nginx/nginx.conf

Also set these in production environment:
- FRONTEND_URL=https://brighternepal.com
- BASE_DOMAIN=brighternepal.com
- NEXT_PUBLIC_API_URL=https://api.brighternepal.com
- NEXT_PUBLIC_WS_URL=https://api.brighternepal.com

Nginx host routing requirement for this deployment:
1. Main dashboard/public app server_name should be brighternepal.com www.brighternepal.com
2. Add a dedicated redirect server block for app.brighternepal.com to return 301 to https://brighternepal.com$request_uri
3. Keep api.brighternepal.com routed to Flask, and wildcard school subdomains on *.brighternepal.com

---

## 4. Server Cutover Plan (Shutdown old BrighterNepal apps first)

Run on VPS as root.

### 4.1 Backup old app data/config first

    mkdir -p /root/backups/pre-aschool-cutover
    tar -czf /root/backups/pre-aschool-cutover/brighternepal-opt-$(date +%F).tar.gz /opt/brighternepal || true
    cp -a /etc/nginx /root/backups/pre-aschool-cutover/nginx-$(date +%F) || true

### 4.2 Stop and disable old BrighterNepal services

    systemctl stop bn-frontend bn-api bn-chat || true
    systemctl disable bn-frontend bn-api bn-chat || true

If old stack used host nginx:

    systemctl stop nginx || true
    systemctl disable nginx || true

If any old docker stack is running:

    docker ps --format '{{.Names}}' | grep -E 'brighter|bn-' | xargs -r docker stop

### 4.3 Verify old services are fully down

    systemctl is-active bn-frontend bn-api bn-chat nginx || true
    ss -tulpen | grep -E ':80 |:443 |:3000 |:5000 |:5001 ' || true

Ports 80 and 443 must be free before starting ASchool docker nginx.

---

## 5. Deploy ASchool on VPS

### 5.1 Clone platform repo

Verify GitHub SSH key auth first (recommended):

    ssh -T git@github.com
    # Expected: Hi bishalregmi105B! You've successfully authenticated...

    mkdir -p /opt/aschool
    cd /opt/aschool
    git clone git@github.com:bishalregmi105B/aschool-platform.git .

If SSH auth works but clone still asks for credentials, force the configured key:

    GIT_SSH_COMMAND="ssh -i ~/.ssh/vexel_deploy_ed25519 -o IdentitiesOnly=yes" git clone git@github.com:bishalregmi105B/aschool-platform.git .

### 5.2 Create production .env

    cp .env.example .env

Edit .env for production values:

    FLASK_ENV=production
    DEBUG=False
    SECRET_KEY=<64+ random chars>
    JWT_SECRET_KEY=<64+ random chars>

    POSTGRES_USER=aschool
    POSTGRES_PASSWORD=<strong password>
    POSTGRES_DB=aschool
    DATABASE_URL=postgresql://aschool:<strong password>@postgres:5432/aschool

    REDIS_URL=redis://redis:6379/0
    CELERY_BROKER_URL=redis://redis:6379/1
    CELERY_RESULT_BACKEND=redis://redis:6379/2

    FRONTEND_URL=https://brighternepal.com
    BASE_DOMAIN=brighternepal.com
    NEXT_PUBLIC_API_URL=https://api.brighternepal.com
    NEXT_PUBLIC_WS_URL=https://api.brighternepal.com

    FILE_STORAGE_BACKEND=r2
    R2_ACCOUNT_ID=<value>
    R2_ACCESS_KEY_ID=<value>
    R2_SECRET_ACCESS_KEY=<value>
    R2_BUCKET_NAME=aschool
    R2_PUBLIC_URL=https://files.brighternepal.com

    FLOWER_USER=<value>
    FLOWER_PASSWORD=<value>

### 5.3 Ensure SSL files exist where compose nginx can read

Current docker compose mounts:
- ./nginx/ssl -> /etc/nginx/ssl (inside container)

So place cert files on server:

    mkdir -p /opt/aschool/nginx/ssl
    cp /etc/ssl/cloudflare/brighternepal.com.pem /opt/aschool/nginx/ssl/brighternepal.com.crt
    cp /etc/ssl/cloudflare/brighternepal.com.key /opt/aschool/nginx/ssl/brighternepal.com.key

Note: names above match the current nginx config filenames.

### 5.4 Build and start production services

    cd /opt/aschool
    docker compose -f docker-compose.prod.yml pull || true
    docker compose -f docker-compose.prod.yml up -d --build

### 5.5 Run DB migration and optional seed

    docker compose -f docker-compose.prod.yml exec flask flask db upgrade
    # Optional first-time seed:
    # docker compose -f docker-compose.prod.yml exec flask python seed_full.py

---

## 6. Post-Deploy Validation

Run on VPS:

    docker compose -f /opt/aschool/docker-compose.prod.yml ps
    docker compose -f /opt/aschool/docker-compose.prod.yml logs --tail=80 flask
    docker compose -f /opt/aschool/docker-compose.prod.yml logs --tail=80 nextjs
    docker compose -f /opt/aschool/docker-compose.prod.yml logs --tail=80 nginx

Public checks:

    curl -I https://brighternepal.com
    curl -I https://api.brighternepal.com/health

Redirect check for old endpoint:

    curl -I https://app.brighternepal.com
    # Expected: HTTP 301/308 Location: https://brighternepal.com/...

Browser checks:
1. Login from brighternepal.com
2. Open plugin marketplace
3. Create/update fee payment
4. Open teacher and parent assignment flows
5. Verify one school slug route: https://demo.brighternepal.com

---

## 7. Keep old BrighterNepal app permanently off

After successful validation of ASchool in production:

    systemctl mask bn-frontend bn-api bn-chat || true
    rm -f /etc/systemd/system/bn-frontend.service /etc/systemd/system/bn-api.service /etc/systemd/system/bn-chat.service || true
    systemctl daemon-reload

Optional cleanup after a safe retention period:

    # Keep backup tar first, then remove old app directory
    rm -rf /opt/brighternepal

---

## 8. Standard Update Workflow for ASchool

From local machine:

    cd /home/bishal-regmi/Desktop/ASchool
    git add -A
    git commit -m "your change"
    git push

On VPS:

    cd /opt/aschool
    git pull --ff-only
    docker compose -f docker-compose.prod.yml up -d --build
    docker compose -f docker-compose.prod.yml exec flask flask db upgrade

---

## 9. Rollback Strategy

If deployment fails:

1. Bring down ASchool stack:

    cd /opt/aschool
    docker compose -f docker-compose.prod.yml down

2. Re-enable old BrighterNepal services:

    systemctl unmask bn-frontend bn-api bn-chat || true
    systemctl enable bn-frontend bn-api bn-chat nginx || true
    systemctl restart bn-frontend bn-api bn-chat nginx || true

3. Investigate ASchool logs and redeploy after fix.

---

## 10. Final Notes

1. Use Dockerized production commands for ASchool operations on server.
2. Do not run both old host-nginx and ASchool docker nginx simultaneously on ports 80/443.
3. Keep old backup for at least 7-14 days before permanent deletion.
4. If you want zero-downtime migration, deploy ASchool first on temporary subdomains, then switch DNS after validation.
