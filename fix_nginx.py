import re

with open('nginx/nginx.conf', 'r') as f:
    content = f.read()

# Remove Vexel upstream blocks
content = re.sub(r'# ── Vexel \(pukarphulara.com.np\) ───────────────────────────────────────────.*?upstream vexel_nextjs {\n    server vexel-nextjs-1:3000;\n}\n\n', '', content, flags=re.DOTALL)

# Remove Vexel server blocks (everything from HTTP -> HTTPS redirect for Vexel to the end)
content = re.sub(r'# ── Vexel — HTTP → HTTPS redirect ────────────────────────────────────────.*', '', content, flags=re.DOTALL)

# Now replace aschool.pukarphulara.com.np with pukarphulara.com.np
content = content.replace('.aschool.pukarphulara.com.np', '.pukarphulara.com.np')
content = content.replace('aschool.pukarphulara.com.np', 'pukarphulara.com.np')

with open('nginx/nginx.conf', 'w') as f:
    f.write(content)
