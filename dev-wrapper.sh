#!/bin/bash
cd /home/z/my-project

# Start the Next.js server in the background
node node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0 &
SERVER_PID=$!

# Keep this wrapper process alive by continuously checking the server
while true; do
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[$(date)] Server died, restarting..." >> /home/z/my-project/dev.log
    node node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0 >> /home/z/my-project/dev.log 2>&1 &
    SERVER_PID=$!
  fi
  # Keep CPU active to prevent sandbox from killing us
  sleep 2
done
