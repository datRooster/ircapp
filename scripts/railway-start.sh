#!/usr/bin/env bash
set -euo pipefail

ROLE="${APP_ROLE:-web}"

echo "[railway-start] APP_ROLE=${ROLE}"

case "$ROLE" in
  web)
    npm run start
    ;;
  irc)
    npm run irc:start
    ;;
  bot)
    npm run bot:start
    ;;
  *)
    echo "[railway-start] Unknown APP_ROLE: ${ROLE}" >&2
    exit 1
    ;;
esac
