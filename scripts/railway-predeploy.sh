#!/usr/bin/env bash
set -euo pipefail

ROLE="${APP_ROLE:-web}"

echo "[railway-predeploy] APP_ROLE=${ROLE}"

case "$ROLE" in
  web)
    npx prisma migrate deploy
    npm run db:seed:core
    ;;
  irc|bot)
    echo "[railway-predeploy] No pre-deploy actions required for ${ROLE}"
    ;;
  *)
    echo "[railway-predeploy] Unknown APP_ROLE: ${ROLE}" >&2
    exit 1
    ;;
esac
