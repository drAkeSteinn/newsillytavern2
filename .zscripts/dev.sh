#!/bin/bash
cd /home/z/my-project

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "[DEV] Installing dependencies..."
  bun install
fi

# Generate Prisma client if needed
if [ ! -d "node_modules/.prisma" ]; then
  echo "[DEV] Generating Prisma client..."
  bun run db:generate
fi

# Push database schema
echo "[DEV] Pushing database schema..."
bun run db:push 2>/dev/null || true

# Start the dev server with memory limit
echo "[DEV] Starting Next.js dev server..."
exec node node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0
