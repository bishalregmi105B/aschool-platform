FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info fontconfig && \
    rm -rf /var/lib/apt/lists/*

# Devanagari fonts for WeasyPrint PDFs (Noto, SIL OFL) — installed system-wide
# so Pango can shape Nepali text in every render path.
COPY app/static/fonts/ /usr/share/fonts/truetype/aschool/
RUN fc-cache -f

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=wsgi:app
EXPOSE 5000

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "4", "-b", "0.0.0.0:5000", "wsgi:app"]
