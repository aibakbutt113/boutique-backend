#!/bin/sh
set -e

# Create/upgrade the database tables. Safe to run on every start: it only applies new migrations.
echo "Applying database migrations..."
npx prisma migrate deploy

# Optional: load the admin user, categories, sample products and coupons (idempotent).
if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  npm run seed
fi

echo "Starting API on port ${PORT:-4000}"
exec node dist/main.js
