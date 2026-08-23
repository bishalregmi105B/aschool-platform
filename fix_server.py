import re
import os
import secrets

print("Starting ASchool reconfiguration script...")

# 1. Fix docker-compose.prod.yml
dc_path = '/opt/aschool/docker-compose.prod.yml'
with open(dc_path, 'r') as f:
    dc = f.read()

dc = re.sub(r'ports:\n\s+- "80:80"\n\s+- "443:443"', 'ports:\n      - "8080:80"', dc)
dc = re.sub(r'\s+- vexel_default', '', dc)
dc = re.sub(r'\s+vexel_default:\n\s+external: true', '', dc)

with open(dc_path, 'w') as f:
    f.write(dc)
print("Updated docker-compose.prod.yml")

# 2. Fix nginx/nginx.conf
nx_path = '/opt/aschool/nginx/nginx.conf'
with open(nx_path, 'r') as f:
    nx = f.read()

nx = nx.replace('.aschool.pukarphulara.com.np', '.pukarphulara.com.np')
nx = nx.replace('aschool.pukarphulara.com.np', 'pukarphulara.com.np')

nx = re.sub(r'# ── Vexel \(pukarphulara.com.np\) ───────────────────────────────────────────.*?upstream vexel_nextjs {\n    server vexel-nextjs-1:3000;\n}\n\n', '', nx, flags=re.DOTALL)
nx = re.sub(r'# ── Vexel — HTTP → HTTPS redirect ────────────────────────────────────────.*', '', nx, flags=re.DOTALL)
nx = re.sub(r'listen 443 ssl http2;', 'listen 80;', nx)
nx = re.sub(r'\s*ssl_certificate.*?;', '', nx)
nx = re.sub(r'\s*ssl_protocols.*?;', '', nx)
nx = re.sub(r'\s*ssl_ciphers.*?;', '', nx)

# We need to manually remove the HTTP->HTTPS redirect if present, otherwise let's just make sure it doesn't cause infinite redirect
nx = re.sub(r'# HTTP → HTTPS redirect\nserver \{\n\s*listen 80;\n\s*server_name \*\.pukarphulara\.com\.np pukarphulara\.com\.np;\n\s*return 301 https://\$host\$request_uri;\n\}\n', '', nx, flags=re.MULTILINE)

with open(nx_path, 'w') as f:
    f.write(nx)
print("Updated docker nginx.conf")

# 3. Create .env file for ASchool
env_path = '/opt/aschool/.env'
secret_key = secrets.token_hex(32)
jwt_secret_key = secrets.token_hex(32)
env_content = f"""FLASK_ENV=production
DEBUG=False
BASE_DOMAIN=pukarphulara.com.np
FRONTEND_URL=https://pukarphulara.com.np
NEXT_PUBLIC_API_URL=https://api.pukarphulara.com.np
NEXT_PUBLIC_WS_URL=https://api.pukarphulara.com.np
DATABASE_URL=postgresql://aschool:AschoolProd123!@postgres:5432/aschool
POSTGRES_USER=aschool
POSTGRES_PASSWORD=AschoolProd123!
POSTGRES_DB=aschool
REDIS_URL=redis://redis:6379/0
SECRET_KEY={secret_key}
JWT_SECRET_KEY={jwt_secret_key}
"""
with open(env_path, 'w') as f:
    f.write(env_content)
print("Created production .env file")

# 4. Create Host Nginx config
host_nx_path = '/etc/nginx/sites-available/aschool'
host_nx = """
server {
    listen 80;
    server_name pukarphulara.com.np *.pukarphulara.com.np api.pukarphulara.com.np app.pukarphulara.com.np;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Proxy to ASchool Docker Nginx
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""
with open(host_nx_path, 'w') as f:
    f.write(host_nx)

os.system('ln -sf /etc/nginx/sites-available/aschool /etc/nginx/sites-enabled/aschool')
os.system('systemctl reload nginx')
print("Host nginx configured and reloaded")
