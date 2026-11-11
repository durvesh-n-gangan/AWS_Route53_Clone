#!/bin/sh
# Container entry point: bring the schema up to date, add the demo data if it is missing,
# then serve the API. Migrations and seeding are both safe to repeat on every start.
set -e

alembic upgrade head
python -m app.db.seed

# --proxy-headers lets uvicorn read the client address and https scheme from the platform's
# load balancer.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" \
    --proxy-headers --forwarded-allow-ips="*"
