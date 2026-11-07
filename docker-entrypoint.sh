#!/bin/sh
set -e

echo "[entrypoint] Running database migration (db/script.sql)..."
node scripts/migrate.js

echo "[entrypoint] Starting application..."
exec node dist/main
