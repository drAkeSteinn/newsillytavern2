#!/bin/bash
cd /home/z/my-project
while true; do
  node_modules/.bin/next dev -p 3000 -H 0.0.0.0 2>&1 | tee /home/z/my-project/dev.log
  echo "=== Server exited, restarting in 2s ===" >> /home/z/my-project/dev.log
  sleep 2
done
