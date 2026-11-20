#!/bin/sh
# Render start command for the API (run from backend/). Safe to run on every start:
# - migrations only ever upgrade, and do nothing when the schema is current;
# - the 377 processed repair records are upserted by record_id (no duplicates, nothing deleted);
# - the embedding index is built in the background, skips unchanged records and waits out free-tier rate limits,
#   so a missing index never delays startup or the health check.
set -e
alembic upgrade head
python scripts/ingest_knowledge.py --if-present
if [ -n "$GEMINI_API_KEY" ] && [ "${VECTOR_SEARCH_MODE:-auto}" != "keyword" ]; then
  (python scripts/index_knowledge.py > /tmp/index_knowledge.log 2>&1 || true) &
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
