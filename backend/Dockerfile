# Backend image for Render / Railway. Build context: the backend/ folder.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini start.sh ./
COPY alembic ./alembic
COPY app ./app

# Run as an unprivileged user. /var/data is where the hosting platform mounts the persistent
# disk; DATABASE_URL should point inside it (see render.yaml).
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /var/data /app/data \
    && chown -R appuser:appuser /var/data /app/data \
    && chmod +x start.sh
USER appuser

ENV DATABASE_URL=sqlite:////var/data/route53.db \
    COOKIE_SECURE=true \
    PORT=8000

EXPOSE 8000
CMD ["./start.sh"]
