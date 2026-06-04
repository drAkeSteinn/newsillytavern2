#!/bin/bash
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] Starting Next.js dev server..." >> /home/z/my-project/dev-alive.log
    npx next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1 &
    # Wait for server to start
    sleep 10
    # Trigger compilation
    curl -s --max-time 120 http://127.0.0.1:3000/ > /dev/null 2>&1
    echo "[$(date)] Server started and compiled" >> /home/z/my-project/dev-alive.log
  fi
  sleep 10
done
