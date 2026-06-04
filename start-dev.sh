#!/bin/bash
cd /home/z/my-project
while true; do
  echo "$(date): Starting Next.js dev server..." >> /home/z/my-project/dev.log
  npx next dev -p 3000 -H 0.0.0.0 2>&1 | tee -a /home/z/my-project/dev.log
  EXIT_CODE=$?
  echo "$(date): Server exited with code $EXIT_CODE, restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done
