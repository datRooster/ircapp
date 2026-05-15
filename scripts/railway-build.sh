#!/usr/bin/env bash
set -euo pipefail

ROLE="${APP_ROLE:-web}"

echo "[railway-build] APP_ROLE=${ROLE}"

case "$ROLE" in
  web)
    npx prisma migrate deploy
    npx prisma generate
    npm run db:seed:core
    npm run build
    ;;
  irc|bot)
    npx prisma generate
    ;;
  *)
    echo "[railway-build] Unknown APP_ROLE: ${ROLE}" >&2
    exit 1
    ;;
esac
