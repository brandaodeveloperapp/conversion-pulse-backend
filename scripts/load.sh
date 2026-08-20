#!/usr/bin/env bash
set -euo pipefail

DUMP="${DUMP:-data/case_tech_lead.sql}"
CSV="${CSV:-data/channel_events.csv}"
CONTAINER="${CONTAINER:-cpulse-db}"
DB_USER="${POSTGRES_USER:-cpulse}"
DB_NAME="${POSTGRES_DB:-cpulse}"

psql_run() { docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"; }

if [ ! -f "$DUMP" ]; then
  echo "dump nao encontrado em $DUMP" >&2
  echo "baixe de https://drive.google.com/drive/folders/1r7sn8MuBoBJRGB_DBtiJQsa9ydTKrvXx" >&2
  exit 1
fi

if ! docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null | grep -q healthy; then
  echo "container $CONTAINER nao esta healthy. rode: docker compose up -d db" >&2
  exit 1
fi

echo "[1/4] transformando dump em csv"
node scripts/transform-dump.mjs "$DUMP" "$CSV"

echo "[2/4] carregando via COPY"
psql_run -c "TRUNCATE inside.channel_events" \
         -c "\copy inside.channel_events (id, channel, status_id, created_at) FROM '/import/$(basename "$CSV")' WITH (FORMAT csv)"

echo "[3/4] indices"
psql_run < db/post-load/02_indexes.sql

echo "[4/4] rollup"
psql_run < db/post-load/03_rollup.sql

psql_run -c "SELECT (SELECT count(*) FROM inside.channel_events) AS eventos, (SELECT count(*) FROM inside.conversion_daily) AS rollup_linhas"
echo "carga concluida"
