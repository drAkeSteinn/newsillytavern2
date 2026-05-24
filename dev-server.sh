#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> dev.log
  node node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0 >> dev.log 2>&1
  echo "[$(date)] Server exited. Restarting in 3s..." >> dev.log
  sleep 3
done
