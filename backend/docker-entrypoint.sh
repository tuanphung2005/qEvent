#!/bin/sh
set -e

echo "⏳ Waiting for database to be ready and syncing schema..."
bun x prisma db push

if [ "$SEED_DB" = "true" ]; then
  echo "🌱 Seeding database initial data..."
  bun run prisma/seed.ts || echo "Seed skipped or already populated."
fi

echo "🚀 Starting qCheck backend..."
exec bun run start
