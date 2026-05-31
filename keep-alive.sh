#!/bin/bash
LOG="/home/z/my-project/dev.log"
cd /home/z/my-project
while true; do
  echo "$(date): Starting Next.js..." >> "$LOG"
  node_modules/.bin/next dev -p 3000 -H 0.0.0.0 >> "$LOG" 2>&1
  EXIT=$?
  echo "$(date): Next.js exited with code $EXIT" >> "$LOG"
  sleep 2
done
