#!/bin/bash
cd /home/z/my-project
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "[$(date)] Starting server..." >> /home/z/my-project/dev-alive.log
    node /home/z/my-project/node_modules/next/dist/bin/next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1 &
    disown
    sleep 15
    # Pre-compile the app
    curl -s --max-time 120 http://127.0.0.1:3000/ > /dev/null 2>&1
    echo "[$(date)] Server started and pre-compiled" >> /home/z/my-project/dev-alive.log
  fi
  curl -s --max-time 10 http://127.0.0.1:3000/ > /dev/null 2>&1
  sleep 5
done
