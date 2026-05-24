#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> dev.log
  NODE_OPTIONS="--max-old-space-size=1536" npx next dev -p 3000 --hostname 0.0.0.0 >> dev.log 2>&1
  EXIT=$?
  echo "[$(date)] Server exited with code $EXIT, restarting in 5s..." >> dev.log
  sleep 5
done
