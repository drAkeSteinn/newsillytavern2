#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..." >> keepalive.log
  node node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0 >> dev.log 2>&1
  EXIT=$?
  echo "[$(date)] Server exited with code $EXIT, restarting in 2s..." >> keepalive.log
  sleep 2
done
