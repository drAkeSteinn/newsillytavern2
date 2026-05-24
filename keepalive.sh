#!/bin/bash
while true; do
  echo "Starting Next.js dev server..."
  NODE_OPTIONS="--max-old-space-size=1536" npx next dev -p 3000 --hostname 0.0.0.0 >> dev.log 2>&1
  EXIT_CODE=$?
  echo "Process exited with code $EXIT_CODE, restarting in 5s..." >> dev.log
  sleep 5
done
