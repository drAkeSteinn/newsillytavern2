#!/bin/bash
cd /home/z/my-project
echo "[$(date)] Starting Next.js..." > dev.log

# Trap signals
trap 'echo "[$(date)] Received signal!" >> dev.log' SIGHUP SIGINT SIGTERM SIGKILL

NODE_OPTIONS="--max-old-space-size=1536" node node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0 >> dev.log 2>&1
EXIT=$?
echo "[$(date)] Exited with code: $EXIT" >> dev.log
