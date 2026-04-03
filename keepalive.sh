#!/bin/bash
# Keepalive wrapper for Next.js dev server
# Restarts the server automatically if it crashes or exits
# IMPORTANT: next dev can return exit code 0 even on native crashes,
# so we always restart unless explicitly killed via SIGKILL (137)

cd /home/z/my-project

RESTART_COUNT=0
MAX_RESTARTS=50

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
  echo "[$(date)] Starting Next.js dev server... (restart #$RESTART_COUNT)" >> dev.log
  NODE_OPTIONS='--max-old-space-size=8192' npx next dev -p 3000 >> dev.log 2>&1
  EXIT_CODE=$?
  
  # SIGKILL (137) means we were intentionally killed - stop
  if [ $EXIT_CODE -eq 137 ]; then
    echo "[$(date)] Killed by SIGKILL, stopping keepalive" >> dev.log
    break
  fi
  
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 2 seconds..." >> dev.log
  RESTART_COUNT=$((RESTART_COUNT + 1))
  sleep 2
done

echo "[$(date)] Keepalive stopped after $RESTART_COUNT restarts" >> dev.log
