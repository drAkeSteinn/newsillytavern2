#!/bin/bash
cd /home/z/my-project
while true; do
  echo "Starting Next.js dev server..." >> /home/z/my-project/dev.log
  node node_modules/.bin/next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "Server exited with code $EXIT_CODE, restarting in 3s..." >> /home/z/my-project/dev.log
  sleep 3
done
