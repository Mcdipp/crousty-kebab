#!/bin/sh
set -e
# Applique les migrations Prisma en attente avant de démarrer l'API.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "▶ Application des migrations Prisma…"
  npx prisma migrate deploy
fi
exec "$@"
