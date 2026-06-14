#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1
  echo "Server exited at $(date), restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done
