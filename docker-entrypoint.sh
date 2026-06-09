#!/bin/sh
set -e

echo "==> NextCRM Docker Entrypoint"

# Railway and many other hosts provide DATABASE_URL but not individual
# connection parts. Derive the fields used by pg_isready/psql when needed.
if [ -n "$DATABASE_URL" ]; then
  if [ -z "$DB_HOST" ]; then
    export DB_HOST=$(node -e 'const u = new URL(process.env.DATABASE_URL); console.log(u.hostname)')
  fi
  if [ -z "$DB_PORT" ]; then
    export DB_PORT=$(node -e 'const u = new URL(process.env.DATABASE_URL); console.log(u.port || "5432")')
  fi
  if [ -z "$DB_USER" ]; then
    export DB_USER=$(node -e 'const u = new URL(process.env.DATABASE_URL); console.log(decodeURIComponent(u.username))')
  fi
  if [ -z "$DB_PASSWORD" ]; then
    export DB_PASSWORD=$(node -e 'const u = new URL(process.env.DATABASE_URL); console.log(decodeURIComponent(u.password))')
  fi
  if [ -z "$DB_NAME" ]; then
    export DB_NAME=$(node -e 'const u = new URL(process.env.DATABASE_URL); console.log(u.pathname.replace(/^\/+/, ""))')
  fi
  if [ -z "$PGSSLMODE" ]; then
    SSLMODE=$(node -e 'const u = new URL(process.env.DATABASE_URL); console.log(u.searchParams.get("sslmode") || "")')
    if [ -n "$SSLMODE" ]; then
      export PGSSLMODE="$SSLMODE"
    fi
  fi
fi

# --- 1. Wait for Postgres ---
echo "==> Waiting for PostgreSQL..."
RETRIES=30
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: PostgreSQL did not become ready in time."
    exit 1
  fi
  echo "    Postgres not ready, retrying in 1s... ($RETRIES attempts left)"
  sleep 1
done
echo "==> PostgreSQL is ready."

# --- 2. Auto-generate secrets if not provided ---
if [ -z "$BETTER_AUTH_SECRET" ]; then
  export BETTER_AUTH_SECRET=$(head -c 32 /dev/urandom | base64)
  echo "==> Generated BETTER_AUTH_SECRET"
fi

if [ -z "$EMAIL_ENCRYPTION_KEY" ]; then
  export EMAIL_ENCRYPTION_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  echo "==> Generated EMAIL_ENCRYPTION_KEY"
fi

# --- 3. Run Prisma migrations ---
echo "==> Running database migrations..."
prisma migrate deploy
echo "==> Migrations complete."

# --- 4. Create MinIO bucket (idempotent) ---
if [ "$SKIP_MINIO_BUCKET_CREATE" != "1" ] && [ -n "$MINIO_ENDPOINT" ] && [ -n "$MINIO_ACCESS_KEY" ] && [ -n "$MINIO_SECRET_KEY" ] && [ -n "$MINIO_BUCKET" ]; then
  echo "==> Ensuring MinIO bucket '$MINIO_BUCKET' exists..."
  # Strip protocol for host:port extraction
  MINIO_HOST=$(echo "$MINIO_ENDPOINT" | sed 's|https\?://||')

  # Create bucket via S3 API — returns 200 if created, 409 if exists (both are fine)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "http://${MINIO_HOST}/${MINIO_BUCKET}" \
    -H "Host: ${MINIO_HOST}" \
    -u "${MINIO_ACCESS_KEY}:${MINIO_SECRET_KEY}" \
    2>/dev/null || echo "000")

  if [ "$STATUS" = "200" ]; then
    echo "==> Bucket '$MINIO_BUCKET' created."
  elif [ "$STATUS" = "409" ]; then
    echo "==> Bucket '$MINIO_BUCKET' already exists."
  else
    echo "WARN: Could not create MinIO bucket (HTTP $STATUS). File storage may not work until bucket is created manually."
  fi
fi

# --- 5. Conditional database seed ---
# Use psql to count users directly (reliable) rather than prisma db execute
# (which emits noisy output hard to parse).
echo "==> Checking if database needs seeding..."
USER_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -tAc 'SELECT COUNT(*) FROM "Users";' 2>/dev/null || echo "0")

# Strip whitespace
USER_COUNT=$(echo "$USER_COUNT" | tr -d '[:space:]')

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "==> No users found, seeding database..."
  prisma db seed
  echo "==> Seeding complete."
else
  echo "==> Database already has $USER_COUNT user(s), skipping seed."
fi

# --- 6. Start the application ---
echo "==> Starting NextCRM..."
exec node server.js
