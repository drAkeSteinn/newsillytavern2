#!/bin/bash
cd /home/z/my-project
while true; do
  # Check if server is running
  if ! ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "[$(date)] Starting server..." >> /home/z/my-project/dev-alive.log
    npx next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1 &
    disown
    sleep 10
    # Pre-compile
    curl -s --max-time 120 http://127.0.0.1:3000/ > /dev/null 2>&1
    echo "[$(date)] Server started and pre-compiled" >> /home/z/my-project/dev-alive.log
  fi
  # Ping server every 5 seconds to keep it alive
  curl -s --max-time 10 http://127.0.0.1:3000/ > /dev/null 2>&1
  sleep 5
done
